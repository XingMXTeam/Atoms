import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  cleanup();
  vi.unstubAllGlobals();
});

describe("AgentTimeline QA stream", () => {
  it("keeps SSE open and sends the latest QA score to the workbench header", async () => {
    vi.stubGlobal("EventSource", MockEventSource);
    const onQaScoreChange = vi.fn();
    render(
      <AgentTimeline
        projectId="project-1"
        initialRunId="run-1"
        onQaScoreChange={onQaScoreChange}
      />,
    );

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
    expect(onQaScoreChange).toHaveBeenCalledWith(0);
    expect(within(qaCard).queryByText("0 分")).toBeNull();
    fireEvent.click(within(qaCard).getByRole("button", { name: "展开质检详情" }));
    expect(within(qaCard).getByText("探测 · 第 0 轮")).toBeTruthy();
    expect(within(qaCard).getByText("显示页面")).toBeTruthy();
    expect(source.closed).toBe(false);
  });

  it("hydrates completed runs with all agent cards marked 已完成 even with empty SSE replay", async () => {
    vi.stubGlobal("EventSource", MockEventSource);
    render(
      <AgentTimeline
        projectId="seed-project"
        initialRunId="seed-run"
        initialRunStatus="completed"
      />,
    );

    for (const role of ["planner", "architect", "engineer"] as const) {
      const card = screen.getByTestId(`agent-card-${role}`);
      expect(card.getAttribute("data-status")).toBe("completed");
      expect(within(card).getByText("已完成")).toBeTruthy();
      expect(within(card).queryByText("进行中")).toBeNull();
      expect(within(card).queryByText("等待中")).toBeNull();
    }

    await waitFor(() => expect(MockEventSource.current).toBeTruthy());
    act(() => MockEventSource.current.onerror?.());

    expect(
      screen.getByTestId("agent-timeline").getAttribute("data-run-status"),
    ).toBe("completed");
    expect(screen.queryByTestId("ux-banner-interrupted")).toBeNull();
  });

  it("forwards providerLabel 演示回放 from streamed SSE events", async () => {
    vi.stubGlobal("EventSource", MockEventSource);
    const onProviderLabel = vi.fn();
    render(
      <AgentTimeline
        projectId="project-replay"
        initialRunId="run-replay"
        onProviderLabel={onProviderLabel}
      />,
    );

    await waitFor(() => expect(MockEventSource.current).toBeTruthy());
    act(() =>
      MockEventSource.current.send({
        id: "plan-replay",
        runId: "run-replay",
        seq: 1,
        agent: "planner",
        type: "plan",
        payload: {
          title: "演示",
          prd: "prd",
          acceptance: ["AC-1"],
          providerLabel: "演示回放",
        },
      }),
    );

    expect(onProviderLabel).toHaveBeenCalledWith("演示回放");
  });

  it("automatically dispatches a self-heal run on preview error with zero clicks", async () => {
    vi.stubGlobal("EventSource", MockEventSource);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ runId: "run-auto-heal-2" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const onRunIdChange = vi.fn();

    render(
      <AgentTimeline
        projectId="project-auto"
        initialRunId="run-1"
        initialRunStatus="completed"
        onRunIdChange={onRunIdChange}
        autoRepairRequest={{
          id: 1,
          prompt: "自动修复预览编译/运行时错误：TypeError: Cannot read properties of undefined",
        }}
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/project-auto/runs/run-1/continue",
      expect.objectContaining({ method: "POST" }),
    );
    await waitFor(() =>
      expect(onRunIdChange).toHaveBeenCalledWith("run-auto-heal-2"),
    );
    expect(screen.getByTestId("ux-banner-auto-repair").textContent).toContain("自动触发工程师修复");
  });
});
