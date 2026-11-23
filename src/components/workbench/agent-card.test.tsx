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
    expect(screen.getByText(/已完成/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "展开详情" }));
    expect(screen.getByText(/中文待办清单/)).toBeTruthy();
  });
});
