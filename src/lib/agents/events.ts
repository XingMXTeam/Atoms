export type AgentName = "planner" | "architect" | "engineer" | "qa";

export type AgentEventType =
  | "plan"
  | "design"
  | "file"
  | "probe"
  | "review"
  | "verdict"
  | "fix"
  | "error";

export type AgentEventRecord = {
  id: string;
  runId: string;
  seq: number;
  agent: AgentName;
  type: AgentEventType;
  payload: unknown;
};

/** Monotonic seq generator; pass maxExistingSeq to resume after persisted events. */
export function createSeqCounter(maxExistingSeq = 0): () => number {
  let current = maxExistingSeq;
  return () => {
    current += 1;
    return current;
  };
}

export function encodeSseMessage(event: AgentEventRecord): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function parseSseChunk(chunk: string): AgentEventRecord | null {
  const trimmed = chunk.trim();
  if (!trimmed.startsWith("data:")) return null;
  const json = trimmed.slice("data:".length).trim();
  if (!json) return null;
  try {
    return JSON.parse(json) as AgentEventRecord;
  } catch {
    return null;
  }
}
