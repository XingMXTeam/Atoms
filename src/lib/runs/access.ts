import type { AppEnv, ProviderMode } from "@/lib/env";
import type { AppRepository, RunBilling } from "@/lib/db/repository";
import {
  decidePlatformAccess,
  type DemoDecision,
} from "@/lib/limits/demo-policy";
import { utcDay, utcMonth } from "@/lib/limits/rate-limit";
import { verifyTurnstile } from "@/lib/limits/turnstile";
import type { ParsedByok } from "@/lib/llm/byok";
import { REPLAY_LABEL } from "@/lib/llm/modes/replay";

export type AccessDenial = {
  ok: false;
  status: number;
  code: string;
  messageZh: string;
  replayAvailable: boolean;
};

export type AccessGrant = {
  ok: true;
  projectId: string;
  runId: string;
  mode: ProviderMode;
  billing: RunBilling;
  label?: typeof REPLAY_LABEL;
};

export type ContinueGrant = {
  ok: true;
  runId: string;
  mode: ProviderMode;
  billing: RunBilling;
  label?: typeof REPLAY_LABEL;
};

function titleFromPrompt(prompt: string): string {
  const compact = prompt.replace(/\s+/g, " ").trim();
  if (compact.length <= 32) return compact;
  return `${compact.slice(0, 32)}…`;
}

function denialFromDecision(decision: Extract<DemoDecision, { ok: false }>): AccessDenial {
  return {
    ok: false,
    status: decision.status,
    code: decision.code,
    messageZh: decision.messageZh,
    replayAvailable: decision.replayAvailable,
  };
}

function invalidByok(byok: ParsedByok): AccessDenial | null {
  if (byok.attempted && !byok.credentials) {
    return {
      ok: false,
      status: 400,
      code: "byok_invalid",
      messageZh: byok.errorZh,
      replayAvailable: false,
    };
  }
  return null;
}

async function loadPlatformMeters(repo: AppRepository, deviceId: string, day: string) {
  const [deviceGenerations, platformTokensToday, platformTokensMonth] =
    await Promise.all([
      repo.getDevicePlatformGenerations(deviceId),
      repo.getGlobalPlatformTokens(day),
      repo.getMonthlyPlatformTokens(utcMonth(new Date(`${day}T00:00:00.000Z`))),
    ]);
  return { deviceGenerations, platformTokensToday, platformTokensMonth };
}

function metersFor(env: AppEnv, byok: ParsedByok, loaded: {
  deviceGenerations: number;
  platformTokensToday: number;
  platformTokensMonth: number;
}) {
  return {
    providerMode: env.LLM_PROVIDER,
    hasByok: Boolean(byok.credentials),
    demoGenerationLimit: env.PLATFORM_DEMO_GENERATIONS,
    platformDailyCap: env.PLATFORM_DAILY_TOKEN_CAP,
    platformMonthlyCap: env.PLATFORM_MONTHLY_TOKEN_CAP,
    ...loaded,
  };
}

export async function beginInitialRun(input: {
  repo: AppRepository;
  deviceId: string;
  prompt: string;
  env: AppEnv;
  byok: ParsedByok;
  useReplay?: boolean;
  turnstileToken?: string | null;
  remoteIp?: string | null;
  day?: string;
  fetchImpl?: typeof fetch;
}): Promise<AccessGrant | AccessDenial> {
  const invalid = invalidByok(input.byok);
  if (invalid) return invalid;

  const day = input.day ?? utcDay();
  const loaded = await loadPlatformMeters(input.repo, input.deviceId, day);
  let decision = decidePlatformAccess({
    kind: "initial",
    useReplay: input.useReplay === true,
    turnstileOk: true,
    ...metersFor(input.env, input.byok, loaded),
  });

  if (!decision.ok) return denialFromDecision(decision);

  if (decision.billing === "platform") {
    const turnstile = await verifyTurnstile({
      token: input.turnstileToken,
      secret: input.env.TURNSTILE_SECRET_KEY,
      remoteIp: input.remoteIp,
      fetchImpl: input.fetchImpl,
    });
    if (!turnstile.ok) {
      return {
        ok: false,
        status: 403,
        code: "turnstile_required",
        messageZh: turnstile.messageZh,
        replayAvailable: false,
      };
    } else {
      const reserved = await input.repo.reservePlatformGeneration(
        input.deviceId,
        input.env.PLATFORM_DEMO_GENERATIONS,
      );
      if (!reserved) {
        decision = decidePlatformAccess({
          kind: "initial",
          useReplay: false,
          turnstileOk: true,
          ...metersFor(input.env, input.byok, {
            ...loaded,
            deviceGenerations: input.env.PLATFORM_DEMO_GENERATIONS,
          }),
        });
        if (!decision.ok) return denialFromDecision(decision);
      }
    }
  }

  if (!decision.ok) return denialFromDecision(decision);

  const project = await input.repo.createProject({
    deviceId: input.deviceId,
    title: titleFromPrompt(input.prompt),
  });
  const run = await input.repo.createRun({
    projectId: project.id,
    status: "running",
    billing: decision.billing,
  });
  await input.repo.addMessage({
    projectId: project.id,
    role: "user",
    content: input.prompt,
  });

  // BYOK must not consume the platform token budget. Run counters stay for
  // mock/replay/platform observability only.
  if (decision.billing !== "byok") {
    await input.repo.incrementUsage(input.deviceId, day, {
      runs: 1,
      ...(decision.billing === "platform" ? { platformRuns: 1 } : {}),
    });
  }

  return {
    ok: true,
    projectId: project.id,
    runId: run.id,
    mode: decision.mode,
    billing: decision.billing,
    ...(decision.label ? { label: decision.label } : {}),
  };
}

export async function beginContinuation(input: {
  repo: AppRepository;
  deviceId: string;
  projectId: string;
  runId: string;
  prompt?: string;
  env: AppEnv;
  byok: ParsedByok;
  day?: string;
}): Promise<ContinueGrant | AccessDenial> {
  const invalid = invalidByok(input.byok);
  if (invalid) return invalid;

  const project = await input.repo.getProject(input.projectId, input.deviceId);
  if (!project) {
    return {
      ok: false,
      status: 404,
      code: "not_found",
      messageZh: "项目不存在",
      replayAvailable: false,
    };
  }

  const previous = await input.repo.getRun(input.runId);
  if (!previous || previous.projectId !== input.projectId) {
    return {
      ok: false,
      status: 404,
      code: "not_found",
      messageZh: "运行不存在",
      replayAvailable: false,
    };
  }

  const day = input.day ?? utcDay();
  const loaded = await loadPlatformMeters(input.repo, input.deviceId, day);
  const decision = decidePlatformAccess({
    kind: "continue",
    useReplay: false,
    turnstileOk: true,
    ...metersFor(input.env, input.byok, loaded),
  });
  if (!decision.ok) return denialFromDecision(decision);

  if (previous.status === "running") {
    await input.repo.updateRun(input.runId, {
      status: "interrupted",
      finishedAt: new Date(),
    });
  }

  const nextRun = await input.repo.createRun({
    projectId: input.projectId,
    status: "running",
    billing: decision.billing,
  });
  if (input.prompt) {
    await input.repo.addMessage({
      projectId: input.projectId,
      role: "user",
      content: input.prompt,
    });
  }

  if (decision.billing !== "byok") {
    await input.repo.incrementUsage(input.deviceId, day, { runs: 1 });
  }

  return {
    ok: true,
    runId: nextRun.id,
    mode: decision.mode,
    billing: decision.billing,
    ...(decision.label ? { label: decision.label } : {}),
  };
}
