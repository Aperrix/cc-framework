Analyze test coverage and identify gaps.

## Coverage Baseline

$coverage-baseline.output

## Target

$ARGUMENTS

## Instructions

1. Parse the coverage output to extract per-file coverage percentages
2. Identify files with low or no coverage
3. For each uncovered file, read the source to understand what needs testing
4. Prioritize by:
   - Critical business logic (highest priority)
   - Error handling paths
   - Edge cases and boundary conditions
   - Utility functions

Write your analysis to `$ARTIFACTS_DIR/coverage-analysis.md` with:

- Current overall coverage percentage
- List of files sorted by priority (lowest coverage, highest impact first)
- For each file: what functions/branches are untested

Provide structured output with current coverage and gap count.
