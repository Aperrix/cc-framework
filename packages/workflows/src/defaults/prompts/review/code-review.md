Perform a code quality review of this PR.

## PR Scope

$gather-scope.output

## Instructions

Read the diff from `$ARTIFACTS_DIR/pr-diff.patch` and review for:

1. **Correctness**: Logic errors, off-by-one, race conditions
2. **Code quality**: Readability, naming, duplication, complexity
3. **Patterns**: Consistency with existing codebase conventions
4. **Performance**: Unnecessary allocations, N+1 queries, missing caching
5. **Maintainability**: Coupling, cohesion, abstraction level

For each finding, provide:

- Severity: CRITICAL / HIGH / MEDIUM / LOW
- File and line range
- Description and suggested fix

Write findings to `$ARTIFACTS_DIR/review-code.md`
