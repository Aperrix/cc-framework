/**
 * Parse structured validation output from AI agents.
 *
 * Agents that run validation checks (test suites, lint, type-check) may
 * output results as a markdown table. This parser extracts structured
 * pass/fail/warn results from that format.
 *
 * Expected format:
 * ```
 * # Validation Results
 * | Check | Result |
 * |-------|--------|
 * | Tests | ✅ All pass |
 * | Lint  | ❌ 3 errors |
 * ```
 */

export interface ValidationResult {
  check: string;
  result: "pass" | "fail" | "warn" | "unknown";
  error?: string;
}

const HEADER_REGEX = /^#\s+Validation Results\s*$/m;
const TABLE_HEADER_REGEX = /^\|\s*Check\s*\|\s*Result\s*\|$/;
const SEPARATOR_ROW_REGEX = /^\|?\s*[-:]+\s*\|\s*[-:]+\s*\|?/;

function parseResultCell(raw: string): { result: ValidationResult["result"]; error?: string } {
  const trimmed = raw.trim();
  const hasPass = trimmed.includes("\u2705");
  const hasFail = trimmed.includes("\u274C");
  const hasWarn = trimmed.includes("\u26A0\uFE0F") || /skipped|not run/i.test(trimmed);

  let result: ValidationResult["result"] = "unknown";
  if (hasPass) result = "pass";
  else if (hasFail) result = "fail";
  else if (hasWarn) result = "warn";

  const cleaned = trimmed
    .replace(/\u2705/g, "")
    .replace(/\u274C/g, "")
    .replace(/\u26A0\uFE0F/g, "")
    .replace(/\u23ED\uFE0F/g, "")
    .trim();
  const error = cleaned ? cleaned.replace(/^[-\u2013\u2014]\s*/, "") : undefined;

  return { result, ...(error ? { error } : {}) };
}

/**
 * Parse validation results from markdown content.
 * Returns empty array if no "# Validation Results" header or table found.
 */
export function parseValidationResults(content: string): ValidationResult[] {
  if (!HEADER_REGEX.test(content)) return [];

  const lines = content.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => TABLE_HEADER_REGEX.test(line.trim()));
  if (headerIndex === -1) return [];

  const results: ValidationResult[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("|")) break;
    if (SEPARATOR_ROW_REGEX.test(line)) continue;

    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (cells.length < 2) continue;

    const check = cells[0]
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
    const { result, error } = parseResultCell(cells[1]);
    results.push({ check, result, ...(error ? { error } : {}) });
  }

  return results;
}
