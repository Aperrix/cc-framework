/**
 * Credential sanitizer — detects and redacts secrets in text.
 *
 * Uses @secretlint/core with the recommended preset (15 rules covering
 * AWS, GCP, GitHub, GitLab, Slack, npm, SendGrid, private keys, basic auth,
 * generic secrets, and more) for detection, then replaces matches with [REDACTED].
 *
 * Falls back to built-in regex patterns when secretlint finds nothing
 * (covers Anthropic, OpenAI, Stripe, JWT, Bearer tokens, etc.).
 */

import { lintSource } from "@secretlint/core";
import { creator as presetCreator } from "@secretlint/secretlint-rule-preset-recommend";

const REDACTED = "[REDACTED]";

// ---- Secretlint-based detection ----

const SECRETLINT_CONFIG = {
  rules: [
    {
      id: "@secretlint/secretlint-rule-preset-recommend",
      rule: presetCreator,
    },
  ],
};

/**
 * Detect secret ranges in text using secretlint.
 * Returns an array of [start, end] ranges.
 */
async function detectSecretRanges(text: string): Promise<Array<[number, number]>> {
  try {
    const result = await lintSource({
      source: { content: text, filePath: "input.txt", contentType: "text" },
      options: { config: SECRETLINT_CONFIG },
    });
    return result.messages.map((m) => m.range as [number, number]);
  } catch {
    return [];
  }
}

// ---- Built-in regex patterns (complement secretlint) ----

interface Pattern {
  regex: RegExp;
  replacement: string;
}

// prettier-ignore
const builtInPatterns: Pattern[] = [
  // Anthropic
  { regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, replacement: REDACTED },
  // OpenAI
  { regex: /\bsk-proj-[A-Za-z0-9_-]{20,}\b/g, replacement: REDACTED },
  { regex: /\bsk-[A-Za-z0-9_-]{38,}\b/g, replacement: REDACTED },
  // GitHub PATs
  { regex: /\b(ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)[A-Za-z0-9_]{20,}\b/g, replacement: REDACTED },
  // GitLab PATs
  { regex: /\bglpat-[A-Za-z0-9_-]{20,}\b/g, replacement: REDACTED },
  // AWS access keys
  { regex: /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g, replacement: REDACTED },
  // Slack tokens
  { regex: /\bxox[bprs]-[A-Za-z0-9-]{10,}\b/g, replacement: REDACTED },
  // npm tokens
  { regex: /\bnpm_[A-Za-z0-9]{36}\b/g, replacement: REDACTED },
  // Stripe
  { regex: /\b(sk_live_|pk_live_|rk_live_|sk_test_|pk_test_|rk_test_)[A-Za-z0-9]{20,}\b/g, replacement: REDACTED },
  // JWT
  { regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, replacement: REDACTED },
  // Bearer tokens
  { regex: /\bBearer\s+[A-Za-z0-9_.+/=-]{20,}/g, replacement: `Bearer ${REDACTED}` },
  // Basic auth in URLs
  { regex: /(https?:\/\/[^:]+:)[^@]+(@)/g, replacement: `$1${REDACTED}$2` },
  // Env var assignments with secret-like names
  { regex: /\b([A-Z][A-Z0-9_]{2,}(?:_KEY|_SECRET|_TOKEN|_PASSWORD|_CREDENTIAL))=([^\s]{8,})\b/g, replacement: `$1=${REDACTED}` },
];

const customPatterns: Pattern[] = [];

function applyRegexPatterns(text: string): string {
  let result = text;
  for (const { regex, replacement } of [...builtInPatterns, ...customPatterns]) {
    regex.lastIndex = 0;
    result = result.replace(regex, replacement);
  }
  return result;
}

// ---- Public API ----

/**
 * Sanitize text by detecting and replacing secrets with [REDACTED].
 *
 * Uses secretlint (15 rules, 20+ providers) for comprehensive detection,
 * plus built-in regex patterns for providers not covered by secretlint
 * (Anthropic, OpenAI, Stripe, JWT, Bearer).
 */
export async function sanitize(text: string): Promise<string> {
  // Step 1: Detect secrets with secretlint
  const ranges = await detectSecretRanges(text);

  // Step 2: Replace detected ranges (process in reverse to preserve indices)
  let result = text;
  for (const [start, end] of [...ranges].sort((a, b) => b[0] - a[0])) {
    result = result.slice(0, start) + REDACTED + result.slice(end);
  }

  // Step 3: Apply built-in regex patterns for additional coverage
  result = applyRegexPatterns(result);

  return result;
}

/**
 * Synchronous sanitization using only built-in regex patterns.
 * Use when async is not available (e.g., in log handlers).
 */
export function sanitizeSync(text: string): string {
  return applyRegexPatterns(text);
}

/**
 * Add a custom regex pattern to the sanitizer.
 */
export function addPattern(regex: RegExp, replacement: string = REDACTED): void {
  customPatterns.push({ regex, replacement });
}
