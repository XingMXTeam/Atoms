/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { formatShanghaiDateTime } from "./shanghai";

describe("formatShanghaiDateTime", () => {
  it("renders UTC timestamps in Asia/Shanghai", () => {
    expect(formatShanghaiDateTime("2026-11-24T01:04:00.000Z")).toBe("2026/11/24 09:04");
  });
});
