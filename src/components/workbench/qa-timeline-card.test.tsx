import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AgentEventRecord } from "@/lib/agents/events";
import { QaTimelineCard } from "./qa-timeline-card";

const events: AgentEventRecord[] = [
  {
    id: "probe-0",
    runId: "run-1",
    seq: 4,
    agent: "qa",
    type: "probe",
    payload: { round: 0, report: { blankScreen: true } },
  },
  {
    id: "verdict-0",
    runId: "run-1",
    seq: 5,
    agent: "qa",
    type: "verdict",
    payload: {
      round: 0,
      verdicts: [
        { criterion: "显示标题", verdict: "fail", reason: "标题缺失" },
        { criterion: "显示列表", verdict: "pass", reason: "列表正常" },
      ],
      qa_score: 50,
    },
  },
  {
    id: "fix-1",
    runId: "run-1",
    seq: 6,
    agent: "qa",
    type: "fix",
    payload: { round: 1, fixInstruction: "补上标题", files: ["src/App.tsx"] },
  },
  {
    id: "verdict-1",
    runId: "run-1",
    seq: 7,
    agent: "qa",
    type: "verdict",
    payload: {
      round: 1,
      verdicts: [{ criterion: "显示标题", verdict: "pass", reason: "标题已显示" }],
      qa_score: 100,
    },
  },
];

describe("QaTimelineCard", () => {
  it("streams the latest status and expands criterion resolution with fix round", () => {
    render(<QaTimelineCard events={events} status="completed" />);

    expect(screen.getByText("质检")).toBeTruthy();
    expect(screen.getByText(/已完成/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "展开质检详情" }));

    expect(screen.getByText("显示标题")).toBeTruthy();
    expect(screen.getByText("已由第 1 轮修复")).toBeTruthy();
    expect(screen.getByText("显示列表")).toBeTruthy();
    expect(screen.getByText("第 0 轮通过")).toBeTruthy();
    expect(screen.getByText("补上标题")).toBeTruthy();
    expect(screen.getByText("探测 · 第 0 轮")).toBeTruthy();
  });

  it("marks failed criteria exhausted when the repair cap is reached", () => {
    const exhaustedEvents: AgentEventRecord[] = [
      events[1]!,
      {
        id: "exhausted",
        runId: "run-1",
        seq: 8,
        agent: "qa",
        type: "fix",
        payload: { round: 3, exhausted: true, messageZh: "已达修复上限" },
      },
    ];
    const { container } = render(
      <QaTimelineCard events={exhaustedEvents} status="completed" />,
    );
    fireEvent.click(
      within(container).getByRole("button", { name: "展开质检详情" }),
    );

    expect(within(container).getByText("已达修复上限（第 3 轮）")).toBeTruthy();
  });
});
