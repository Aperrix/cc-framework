Review the implementation for code quality before creating a PR.

This is a read-only review — do not modify any files.

## Instructions

1. Read `$ARTIFACTS_DIR/plan.md` to understand the original requirements
2. Review all changed files: `git diff main...HEAD --name-only`
3. Check for:
   - Code quality and consistency with existing patterns
   - Missing error handling
   - Missing or inadequate tests
   - Security concerns (input validation, injection risks)
   - Performance issues
   - Unnecessary complexity or dead code
4. Write your review to `$ARTIFACTS_DIR/self-review.md` with findings categorized by severity (critical, high, medium, low)
