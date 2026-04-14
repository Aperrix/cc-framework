/** Credential sanitizer — replaces secrets in text with [REDACTED]. */

const REDACTED = "[REDACTED]";

interface Pattern {
  regex: RegExp;
  replacement: string;
}

const builtInPatterns: Pattern[] = [
  // Anthropic API keys: sk-ant-...
  { regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, replacement: REDACTED },
  // OpenAI project keys: sk-proj-...
  { regex: /\bsk-proj-[A-Za-z0-9_-]{20,}\b/g, replacement: REDACTED },
  // Generic sk- keys (OpenAI legacy, etc.): sk-... (40+ chars)
  { regex: /\bsk-[A-Za-z0-9_-]{38,}\b/g, replacement: REDACTED },
  // GitHub PATs
  { regex: /\b(ghp_|gho_|github_pat_)[A-Za-z0-9_-]{20,}\b/g, replacement: REDACTED },
  // Bearer tokens
  { regex: /\bBearer\s+[A-Za-z0-9_.+/=-]{20,}\b/g, replacement: `Bearer ${REDACTED}` },
  // URLs with passwords: https://user:password@host
  {
    regex: /(https?:\/\/[^:]+:)[^@]+(@)/g,
    replacement: `$1${REDACTED}$2`,
  },
  // Environment variable patterns: KEY=<long-secret-value>
  {
    regex: /\b([A-Z][A-Z0-9_]{2,})=([A-Za-z0-9+/_.=-]{40,})\b/g,
    replacement: `$1=${REDACTED}`,
  },
  // Generic base64-encoded tokens (40+ alphanumeric chars, standalone)
  {
    regex: /(?<![A-Za-z0-9_/-])[A-Za-z0-9+/]{40,}={0,2}(?![A-Za-z0-9_/-])/g,
    replacement: REDACTED,
  },
];

const customPatterns: Pattern[] = [];

/**
 * Sanitize text by replacing known secret patterns with [REDACTED].
 */
export function sanitize(text: string): string {
  let result = text;
  for (const { regex, replacement } of [...builtInPatterns, ...customPatterns]) {
    // Reset lastIndex for global regexes
    regex.lastIndex = 0;
    result = result.replace(regex, replacement);
  }
  return result;
}

/**
 * Add a custom pattern to the sanitizer.
 */
export function addPattern(regex: RegExp, replacement: string = REDACTED): void {
  customPatterns.push({ regex, replacement });
}
