import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentCard } from "./agent-card";

describe("AgentCard", () => {
  it("renders Chinese labels, status, and expandable payload", () => {
    render(
      <AgentCard
        card={{
          agent: "planner",
          status: "completed",
          startedAt: 1_000,
          finishedAt: 2_500,
          payload: { title: "中文待办清单" },
        }}
      />,
    );

    expect(screen.getByText("规划师")).toBeTruthy();
    expect(screen.getByTestId("agent-card-planner").textContent).toContain("已完成 · 1s");
    expect(screen.getByTestId("agent-card-planner").textContent).not.toContain("0s");

    fireEvent.click(screen.getByRole("button", { name: "展开详情" }));
    expect(screen.getByText(/中文待办清单/)).toBeTruthy();
  });

  it("shows an honest label instead of 0s when duration was not recorded", () => {
    render(
      <AgentCard
        card={{
          agent: "engineer",
          status: "completed",
          durationLabel: "示例项目，无真实耗时",
        }}
      />,
    );
    expect(screen.getByText(/示例项目，无真实耗时/)).toBeTruthy();
    expect(screen.queryByText(/0s/)).toBeNull();
  });

  it("labels sub-second timings instead of 0s", () => {
    render(
      <AgentCard
        card={{
          agent: "architect",
          status: "completed",
          startedAt: 1_000,
          finishedAt: 1_200,
        }}
      />,
    );
    expect(screen.getByText(/不到 1 秒/)).toBeTruthy();
  });
});
