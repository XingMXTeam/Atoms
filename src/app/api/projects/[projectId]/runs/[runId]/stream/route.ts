import { cookies } from "next/headers";
import { encodeSseMessage } from "@/lib/agents/events";
import { runAgentPipeline } from "@/lib/agents/pipeline";
import { DEVICE_ID_COOKIE, getOrMintDeviceId } from "@/lib/auth/device-id";
import { getDb } from "@/lib/db";
import { createLlmProvider } from "@/lib/llm/provider";

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
 * SSE stream for Planner → Architect → Engineer.
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
  const stageDelayMs = parseStageDelayMs(request);

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
          messages.find((m) => m.role === "user")?.content ?? project.title;
        const provider = createLlmProvider();

        await runAgentPipeline({
          repo,
          provider,
          projectId,
          runId,
          prompt: userPrompt,
          signal: abort.signal,
          stageDelayMs,
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
