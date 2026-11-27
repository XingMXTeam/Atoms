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

  it("renders interactive Playwright/Vitest review evidence, screenshot, SHA badge, and coverage pill", () => {
    const reviewEvents: AgentEventRecord[] = [
      {
        id: "review-0",
        runId: "run-2",
        seq: 5,
        agent: "qa",
        type: "review",
        payload: {
          round: 0,
          backend: "cloudflare-sandbox",
          isolated: true,
          artifactSha256: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          ok: true,
          durationMs: 1420,
          cases: [
            {
              criterion: "AC-1: 方向键移动合并",
              strategy: "playwright",
              status: "passed",
              summary: "Playwright 真浏览器执行 2 步均通过",
              steps: [
                { stepIndex: 0, action: "按键 ArrowLeft", ok: true, changed: true, durationMs: 85 },
              ],
              screenshotDataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
              screenshotLabel: "交互验收通过快照",
              consoleErrors: [],
              pageErrors: [],
              durationMs: 620,
            },
            {
              criterion: "AC-3: 满盘触发游戏结束弹窗",
              strategy: "vitest",
              status: "passed",
              summary: "Vitest 隔离边界单测通过 (800ms)",
              steps: [],
              vitestCommand: {
                command: "vitest run __atoms_review__/boundary.test.tsx",
                exitCode: 0,
                stdout: "✓ AC-3 Game Over boundary (1)",
                stderr: "",
                durationMs: 800,
              },
              consoleErrors: [],
              pageErrors: [],
              durationMs: 800,
            },
          ],
          commands: [],
          errors: [],
        },
      },
      {
        id: "verdict-review-0",
        runId: "run-2",
        seq: 6,
        agent: "qa",
        type: "verdict",
        payload: {
          round: 0,
          qa_score: 100,
          verdicts: [
            {
              criterion: "AC-1: 方向键移动合并",
              verdict: "pass",
              reason: "按左键后方块成功合并",
              verifiedBy: "playwright-review",
            },
            {
              criterion: "AC-3: 满盘触发游戏结束弹窗",
              verdict: "pass",
              reason: "死局边界单测通过",
              verifiedBy: "vitest-review",
            },
          ],
        },
      },
    ];

    const { container } = render(
      <QaTimelineCard events={reviewEvents} status="completed" />,
    );

    expect(within(container).getByTestId("qa-coverage-pill").textContent).toContain("自动实测 2/2");
    fireEvent.click(within(container).getByRole("button", { name: "展开质检详情" }));

    expect(within(container).getByText("智能复核 · 第 0 轮")).toBeTruthy();
    expect(within(container).getByText("SHA abcdef12")).toBeTruthy();
    expect(within(container).getByText("Playwright 真浏览器")).toBeTruthy();
    expect(within(container).getByText("Vitest 边界单测")).toBeTruthy();
    expect(within(container).getByText("Playwright 实测")).toBeTruthy();
    expect(within(container).getByText("Vitest 边界实测")).toBeTruthy();
    expect(within(container).getByText(/vitest run __atoms_review__/)).toBeTruthy();
    expect(within(container).getByAltText("交互验收通过快照")).toBeTruthy();
  });
});
