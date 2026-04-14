Analyze the impact of the proposed refactoring. This is a read-only analysis — do not modify any files.

## Scan Results

$scan-scope.output

## Refactoring Target

$ARGUMENTS

## Instructions

1. Read the target files identified in the scan
2. Map all imports and exports — who depends on these files?
3. Identify the public API surface that must be preserved
4. List all test files that exercise this code
5. Assess risk areas where refactoring could break behavior

Write your analysis to `$ARTIFACTS_DIR/impact-analysis.md` with:

- **Public API**: Exports that must remain accessible from the same paths
- **Internal dependencies**: Files that import from the target
- **External consumers**: Packages or modules that depend on this
- **Test coverage**: Existing tests and gaps
- **Risk areas**: Code paths most likely to break
