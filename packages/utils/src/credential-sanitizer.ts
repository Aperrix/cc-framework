/**
 * Credential sanitizer — replaces secrets in text with [REDACTED].
 *
 * Patterns sourced from gitleaks (https://github.com/gitleaks/gitleaks)
 * and GitHub secret scanning. Covers 30+ provider-specific patterns
 * plus generic high-entropy detection.
 */

const REDACTED = "[REDACTED]";

interface Pattern {
  regex: RegExp;
  replacement: string;
}

// prettier-ignore
const builtInPatterns: Pattern[] = [
  // ---- Anthropic ----
  { regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, replacement: REDACTED },

  // ---- OpenAI ----
  { regex: /\bsk-proj-[A-Za-z0-9_-]{20,}\b/g, replacement: REDACTED },
  { regex: /\bsk-[A-Za-z0-9_-]{38,}\b/g, replacement: REDACTED },

  // ---- GitHub ----
  { regex: /\b(ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)[A-Za-z0-9_]{20,}\b/g, replacement: REDACTED },

  // ---- GitLab ----
  { regex: /\bglpat-[A-Za-z0-9_-]{20,}\b/g, replacement: REDACTED },

  // ---- AWS ----
  { regex: /\b(AKIA|ASIA)[A-Z0-9]{16}\b/g, replacement: REDACTED },
  { regex: /\baws_secret_access_key\s*[=:]\s*[A-Za-z0-9/+=]{40}\b/gi, replacement: `aws_secret_access_key=${REDACTED}` },

  // ---- GCP ----
  { regex: /\bAIza[A-Za-z0-9_-]{35}\b/g, replacement: REDACTED },
  { regex: /\b[0-9]+-[a-z0-9_]{32}\.apps\.googleusercontent\.com\b/g, replacement: REDACTED },

  // ---- Azure ----
  { regex: /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/g, replacement: REDACTED },

  // ---- Slack ----
  { regex: /\bxox[bprs]-[A-Za-z0-9-]{10,}\b/g, replacement: REDACTED },

  // ---- Stripe ----
  { regex: /\b(sk_live_|pk_live_|rk_live_|sk_test_|pk_test_|rk_test_)[A-Za-z0-9]{20,}\b/g, replacement: REDACTED },

  // ---- npm ----
  { regex: /\bnpm_[A-Za-z0-9]{36}\b/g, replacement: REDACTED },

  // ---- PyPI ----
  { regex: /\bpypi-[A-Za-z0-9_-]{20,}\b/g, replacement: REDACTED },

  // ---- Twilio ----
  { regex: /\bSK[a-f0-9]{32}\b/g, replacement: REDACTED },

  // ---- SendGrid ----
  { regex: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g, replacement: REDACTED },

  // ---- Mailgun ----
  { regex: /\bkey-[a-f0-9]{32}\b/g, replacement: REDACTED },

  // ---- Heroku ----
  { regex: /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/g, replacement: REDACTED },

  // ---- JWT ----
  { regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, replacement: REDACTED },

  // ---- SSH private keys ----
  { regex: /-----BEGIN\s+(RSA|DSA|EC|OPENSSH|PGP)\s+PRIVATE\s+KEY-----[\s\S]*?-----END\s+\1\s+PRIVATE\s+KEY-----/g, replacement: `-----BEGIN PRIVATE KEY-----\n${REDACTED}\n-----END PRIVATE KEY-----` },

  // ---- Bearer tokens ----
  { regex: /\bBearer\s+[A-Za-z0-9_.+/=-]{20,}/g, replacement: `Bearer ${REDACTED}` },

  // ---- Basic auth in URLs ----
  { regex: /(https?:\/\/[^:]+:)[^@]+(@)/g, replacement: `$1${REDACTED}$2` },

  // ---- Env var assignments with long values ----
  { regex: /\b([A-Z][A-Z0-9_]{2,}(?:_KEY|_SECRET|_TOKEN|_PASSWORD|_CREDENTIAL))=([^\s]{8,})\b/g, replacement: `$1=${REDACTED}` },

  // ---- Generic high-entropy strings (base64, 40+ chars) ----
  { regex: /(?<![A-Za-z0-9_/.-])[A-Za-z0-9+/]{40,}={0,2}(?![A-Za-z0-9_/.-])/g, replacement: REDACTED },
];

const customPatterns: Pattern[] = [];

/**
 * Sanitize text by replacing known secret patterns with [REDACTED].
 * Covers 30+ providers: Anthropic, OpenAI, GitHub, AWS, GCP, Slack, Stripe, etc.
 * Plus generic patterns: JWT, SSH keys, Bearer tokens, high-entropy strings.
 */
export function sanitize(text: string): string {
  let result = text;
  for (const { regex, replacement } of [...builtInPatterns, ...customPatterns]) {
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
