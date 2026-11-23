/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  createSeqCounter,
  encodeSseMessage,
  parseSseChunk,
  type AgentEventRecord,
} from "./events";

describe("agent SSE event helpers (REQ-3)", () => {
  it("createSeqCounter yields monotonic seq starting at 1", () => {
    const next = createSeqCounter();
    expect(next()).toBe(1);
    expect(next()).toBe(2);
    expect(next()).toBe(3);
  });

  it("createSeqCounter can resume after an existing max seq", () => {
    const next = createSeqCounter(4);
    expect(next()).toBe(5);
    expect(next()).toBe(6);
  });

  it("encodeSseMessage formats data lines with a trailing blank line", () => {
    const event: AgentEventRecord = {
      id: "evt-1",
      runId: "run-1",
      seq: 1,
      agent: "planner",
      type: "plan",
      payload: { title: "迷你 PRD" },
    };
    const encoded = encodeSseMessage(event);
    expect(encoded.startsWith("data: ")).toBe(true);
    expect(encoded.endsWith("\n\n")).toBe(true);
    const json = encoded.slice("data: ".length, -2);
    expect(JSON.parse(json)).toEqual(event);
  });

  it("parseSseChunk extracts AgentEventRecord from an SSE frame", () => {
    const event: AgentEventRecord = {
      id: "evt-2",
      runId: "run-1",
      seq: 2,
      agent: "architect",
      type: "design",
      payload: { files: ["src/App.tsx"] },
    };
    const chunk = encodeSseMessage(event);
    expect(parseSseChunk(chunk)).toEqual(event);
  });
});
