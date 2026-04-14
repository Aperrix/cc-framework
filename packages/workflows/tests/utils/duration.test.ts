import { describe, expect, it } from "vite-plus/test";
import { formatDuration, parseDbTimestamp } from "../../src/utils/duration.ts";

describe("formatDuration", () => {
  it("formats 0ms as 1s (minimum 1s)", () => {
    expect(formatDuration(0)).toBe("1s");
  });

  it("formats 500ms as 1s", () => {
    expect(formatDuration(500)).toBe("1s");
  });

  it("formats 1500ms as 1s", () => {
    expect(formatDuration(1500)).toBe("1s");
  });

  it("formats 65000ms as 1m 5s", () => {
    expect(formatDuration(65000)).toBe("1m 5s");
  });

  it("formats 3700000ms as 1h 1m", () => {
    expect(formatDuration(3700000)).toBe("1h 1m");
  });

  it("formats negative values as 0s", () => {
    expect(formatDuration(-100)).toBe("0s");
  });

  it("formats NaN as 0s", () => {
    expect(formatDuration(NaN)).toBe("0s");
  });

  it("formats exact hour without trailing minutes", () => {
    expect(formatDuration(3600000)).toBe("1h");
  });

  it("formats exact minute without trailing seconds", () => {
    expect(formatDuration(60000)).toBe("1m");
  });
});

describe("parseDbTimestamp", () => {
  it("handles Date objects", () => {
    const date = new Date("2024-01-15T10:30:00Z");
    expect(parseDbTimestamp(date)).toBe(date.getTime());
  });

  it("handles ISO strings with Z suffix", () => {
    const isoString = "2024-01-15T10:30:00Z";
    expect(parseDbTimestamp(isoString)).toBe(new Date(isoString).getTime());
  });

  it("handles SQLite strings without Z suffix", () => {
    const sqliteString = "2024-01-15 10:30:00";
    // Should be parsed as UTC, not local time
    expect(parseDbTimestamp(sqliteString)).toBe(new Date("2024-01-15T10:30:00Z").getTime());
  });

  it("handles ISO strings with timezone offset", () => {
    const offsetString = "2024-01-15T10:30:00+05:00";
    expect(parseDbTimestamp(offsetString)).toBe(new Date(offsetString).getTime());
  });
});
