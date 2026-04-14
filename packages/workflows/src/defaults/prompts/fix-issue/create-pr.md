Create a pull request for the completed refactoring.

## Context

- Impact analysis: Read `$ARTIFACTS_DIR/impact-analysis.md`
- Refactoring plan: Read `$ARTIFACTS_DIR/refactor-plan.md`
- Validation: Read `$ARTIFACTS_DIR/refactor-validation.md`
- Behavior verification: Read `$ARTIFACTS_DIR/behavior-verification.md`

## Instructions

1. Ensure all changes are committed (each refactoring step should already be a separate commit)
2. Push the branch: `git push -u origin HEAD`
3. Create a PR:

   ```
   gh pr create
   ```

   - Title: "refactor: <concise description>"
   - Body: before/after structure comparison, behavior verification results
   - Note: "Each commit represents one extraction step. Review commits individually."

4. Save the PR URL to `$ARTIFACTS_DIR/.pr-url`
