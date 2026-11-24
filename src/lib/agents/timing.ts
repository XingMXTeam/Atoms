export type StageTiming = {
  startedAt: number;
  finishedAt: number;
};

export const EXAMPLE_DURATION_LABEL = "示例项目，无真实耗时";
export const UNRECORDED_DURATION_LABEL = "耗时未记录";

export function stageTiming(startedAt: number, finishedAt = Date.now()): StageTiming {
  return {
    startedAt,
    finishedAt: Math.max(startedAt, finishedAt),
  };
}

export function formatElapsed(ms: number): string {
  const safe = Math.max(0, Math.floor(ms));
  if (safe < 1000) return "不到 1 秒";
  const totalSec = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function readStageTiming(payload: unknown): StageTiming | null {
  if (!payload || typeof payload !== "object") return null;
  const timing = (payload as { timing?: unknown }).timing;
  if (!timing || typeof timing !== "object") return null;
  const startedAt = (timing as { startedAt?: unknown }).startedAt;
  const finishedAt = (timing as { finishedAt?: unknown }).finishedAt;
  if (typeof startedAt !== "number" || typeof finishedAt !== "number") return null;
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt)) return null;
  return { startedAt, finishedAt: Math.max(startedAt, finishedAt) };
}

export function readDurationLabel(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const timing = (payload as { timing?: { durationLabel?: unknown } }).timing;
  const label = timing?.durationLabel;
  return typeof label === "string" && label.trim().length > 0 ? label.trim() : null;
}

/** Span across recorded stage timings, ignoring unlabeled preset rows. */
export function aggregateTiming(payloads: unknown[]): StageTiming | null {
  const timings = payloads
    .map((payload) => readStageTiming(payload))
    .filter((timing): timing is StageTiming => timing !== null);
  if (timings.length === 0) return null;
  return {
    startedAt: Math.min(...timings.map((timing) => timing.startedAt)),
    finishedAt: Math.max(...timings.map((timing) => timing.finishedAt)),
  };
}
