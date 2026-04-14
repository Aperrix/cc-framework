Synthesize all review findings into a unified report.

## Review Findings

- Code review: $code-review.output
- Error handling: $error-handling.output
- Test coverage: $test-coverage.output
- Security: $security-review.output

## Instructions

1. Read all review artifacts from `$ARTIFACTS_DIR/review-*.md`
2. Deduplicate findings across reviewers
3. Prioritize by severity: CRITICAL > HIGH > MEDIUM > LOW
4. Produce a unified report with:
   - **Verdict**: APPROVE / REQUEST_CHANGES / COMMENT
   - **Critical findings**: Must fix before merge
   - **High findings**: Should fix before merge
   - **Medium/Low findings**: Nice to fix
   - **Positive observations**: What the PR does well

Provide structured output with verdict and counts.
