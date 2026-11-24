import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FollowUpForm } from "./follow-up-form";

describe("FollowUpForm", () => {
  it("disables send while a run is active or pending", async () => {
    const onSubmit = vi.fn(async () => undefined);
    const { rerender } = render(
      <FollowUpForm disabled pending={false} onSubmit={onSubmit} />,
    );

    const input = screen.getByRole("textbox", { name: "后续需求" });
    fireEvent.change(input, { target: { value: "加入优先级标签" } });
    expect(
      (screen.getByTestId("follow-up-send") as HTMLButtonElement).disabled,
    ).toBe(true);

    rerender(<FollowUpForm disabled={false} pending onSubmit={onSubmit} />);
    expect(
      (screen.getByTestId("follow-up-send") as HTMLButtonElement).disabled,
    ).toBe(true);

    rerender(<FollowUpForm disabled={false} pending={false} onSubmit={onSubmit} />);
    const send = screen.getByTestId("follow-up-send") as HTMLButtonElement;
    expect(send.disabled).toBe(false);
    fireEvent.click(send);
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith("加入优先级标签");
    });
  });
});
