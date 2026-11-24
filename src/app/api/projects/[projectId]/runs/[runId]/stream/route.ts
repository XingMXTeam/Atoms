import { cookies } from "next/headers";
import { encodeSseMessage } from "@/lib/agents/events";
import type { GeneratedFile } from "@/lib/agents/fixtures";
import { defaultProbe, runAgentPipeline } from "@/lib/agents/pipeline";
import { DEVICE_ID_COOKIE, getOrMintDeviceId } from "@/lib/auth/device-id";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { utcDay } from "@/lib/limits/rate-limit";
import { createLlmProvider } from "@/lib/llm/provider";
import { previewProbeReportSchema } from "@/lib/preview/probe";
import { parseVersionFiles } from "@/lib/versions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ projectId: string; runId: string }>;
};

function parseStageDelayMs(request: Request): number | undefined {
  const url = new URL(request.url);
  const raw = url.searchParams.get("stageDelayMs");
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  // Cap so a rogue client cannot stall the worker forever.
  return Math.min(Math.floor(value), 5_000);
}

/**
 * SSE stream for Planner → Architect → Engineer → QA.
 * OpenNext/Workers may buffer; we enqueue discrete SSE frames as events persist.
 * Disconnect → run marked `interrupted`; UI surfaces 「继续」 (REQ-9 known limitation).
 */
export async function GET(request: Request, context: RouteContext) {
  const { projectId, runId } = await context.params;
  const cookieStore = await cookies();
  const existing = cookieStore.get(DEVICE_ID_COOKIE)?.value;
  const { deviceId } = getOrMintDeviceId(
    existing ? `${DEVICE_ID_COOKIE}=${existing}` : null,
  );

  const repo = getDb();
  const provider = createLlmProvider();
  const project = await repo.getProject(projectId, deviceId);
  if (!project) {
    return new Response(JSON.stringify({ messageZh: "项目不存在" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const run = await repo.getRun(runId);
  if (!run || run.projectId !== projectId) {
    return new Response(JSON.stringify({ messageZh: "运行不存在" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const existingEvents = await repo.listAgentEvents(runId);
  const encoder = new TextEncoder();
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => {
    abort.abort();
  });
  const url = new URL(request.url);
  const stageDelayMs = parseStageDelayMs(request);
  const clientProbe = url.searchParams.get("clientProbe") === "1";
  const forceClientProbe = url.searchParams.get("forceClientProbe") === "1";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };

      for (const event of existingEvents) {
        send(encodeSseMessage(event));
      }

      const hasEngineerFile = existingEvents.some(
        (e) => e.agent === "engineer" && e.type === "file",
      );
      if (hasEngineerFile || run.status === "completed") {
        controller.close();
        return;
      }

      // Mid-run reconnect without 「继续」: do not double-fire the pipeline.
      // Documented known limitation (REQ-9) — full checkpoint resume is not supported.
      if (existingEvents.length > 0) {
        send(
          `data: ${JSON.stringify({
            id: crypto.randomUUID(),
            runId,
            seq: existingEvents.at(-1)?.seq ?? 0,
            agent: "engineer",
            type: "error",
            payload: {
              messageZh:
                "连接已中断。请点击「继续」重新生成（已知限制：不会从断点精确恢复）。",
            },
          })}\n\n`,
        );
        controller.close();
        return;
      }

      try {
        const messages = await repo.listMessages(projectId);
        const userPrompt =
          messages.filter((m) => m.role === "user").at(-1)?.content ?? project.title;
        const currentVersion = project.currentVersionId
          ? await repo.getVersion(project.currentVersionId)
          : null;
        if (project.currentVersionId && !currentVersion) {
          throw new Error("Current version snapshot is missing");
        }
        if (currentVersion && currentVersion.projectId !== projectId) {
          throw new Error("Current version does not belong to this project");
        }

        let effectiveProvider = provider;
        if (provider.mode === "gemini" && !currentVersion) {
          const env = getEnv();
          const day = utcDay();
          const [usageSnapshot, globalTokens] = await Promise.all([
            repo.getUsage(deviceId, day),
            repo.getGlobalTokens(day),
          ]);
          const overRuns =
            (usageSnapshot?.runs ?? 0) > env.DEVICE_DAILY_RUN_LIMIT;
          const overTokens = globalTokens >= env.DAILY_TOKEN_CAP;
          if (overRuns || overTokens) {
            effectiveProvider = createLlmProvider({ mode: "replay" });
          }
        }

        const useClientProbe =
          (clientProbe && effectiveProvider.mode !== "mock") || forceClientProbe;
        const probePreview = useClientProbe
          ? async (files: GeneratedFile[], round: number) => {
              const timeoutMs = round === 0 ? 12_000 : 6_000;
              const deadline = Date.now() + timeoutMs;
              while (!abort.signal.aborted && Date.now() < deadline) {
                const raw = await repo.getPreviewProbe(runId, round);
                const parsed = previewProbeReportSchema.safeParse(raw);
                if (parsed.success) return parsed.data;
                await new Promise((resolve) => setTimeout(resolve, 300));
              }
              return defaultProbe(files);
            }
          : undefined;

        await runAgentPipeline({
          repo,
          provider: effectiveProvider,
          projectId,
          runId,
          deviceId,
          prompt: userPrompt,
          history: messages.slice(-10).map(({ role, content }) => ({ role, content })),
          ...(currentVersion
            ? {
                currentVersion: {
                  id: currentVersion.id,
                  files: parseVersionFiles(currentVersion.files),
                },
              }
            : {}),
          signal: abort.signal,
          stageDelayMs,
          ...(probePreview ? { probePreview } : {}),
          onEvent: (event) => {
            send(encodeSseMessage(event));
          },
        });
        controller.close();
      } catch {
        if (abort.signal.aborted) {
          try {
            await repo.updateRun(runId, {
              status: "interrupted",
              finishedAt: new Date(),
            });
          } catch {
            // best-effort on disconnect
          }
          controller.close();
          return;
        }
        controller.close();
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
