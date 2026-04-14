Review security aspects of this PR.

## PR Scope

$gather-scope.output

## Instructions

Read the diff from `$ARTIFACTS_DIR/pr-diff.patch` and review for:

1. **Injection**: SQL injection, command injection, XSS, path traversal
2. **Authentication/Authorization**: Missing auth checks, privilege escalation
3. **Secrets**: Hardcoded credentials, API keys, tokens
4. **Input validation**: Missing or insufficient validation at system boundaries
5. **Dependencies**: New dependencies with known vulnerabilities

For each finding, provide severity (CRITICAL findings must block merge), location, and remediation.

Write findings to `$ARTIFACTS_DIR/review-security.md`
