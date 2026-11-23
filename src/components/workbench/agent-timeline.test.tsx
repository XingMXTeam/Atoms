import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentEventRecord } from "@/lib/agents/events";
import { AgentTimeline } from "./agent-timeline";

class MockEventSource {
  static current: MockEventSource;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(_url: string) {
    MockEventSource.current = this;
  }

  close() {
    this.closed = true;
  }

  send(event: AgentEventRecord) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AgentTimeline QA stream", () => {
  it("keeps SSE open after Engineer files and streams QA events into its card", async () => {
    vi.stubGlobal("EventSource", MockEventSource);
    render(<AgentTimeline projectId="project-1" initialRunId="run-1" />);

    await waitFor(() => expect(MockEventSource.current).toBeTruthy());
    const source = MockEventSource.current;
    const send = (event: AgentEventRecord) =>
      act(() => source.send(event));

    send({
      id: "engineer-file",
      runId: "run-1",
      seq: 3,
      agent: "engineer",
      type: "file",
      payload: { files: [{ path: "src/App.tsx", content: "export default () => null" }] },
    });
    expect(source.closed).toBe(false);

    send({
      id: "probe",
      runId: "run-1",
      seq: 4,
      agent: "qa",
      type: "probe",
      payload: { round: 0, report: { blankScreen: true } },
    });
    send({
      id: "verdict",
      runId: "run-1",
      seq: 5,
      agent: "qa",
      type: "verdict",
      payload: {
        round: 0,
        verdicts: [{ criterion: "显示页面", verdict: "fail", reason: "页面为空" }],
        qa_score: 0,
      },
    });

    const qaCard = screen.getByTestId("agent-card-qa");
    fireEvent.click(within(qaCard).getByRole("button", { name: "展开质检详情" }));
    expect(within(qaCard).getByText("探测 · 第 0 轮")).toBeTruthy();
    expect(within(qaCard).getByText("显示页面")).toBeTruthy();
    expect(source.closed).toBe(false);
  });
});
