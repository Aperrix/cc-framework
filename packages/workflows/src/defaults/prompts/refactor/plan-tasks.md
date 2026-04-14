Create an ordered refactoring plan. This is a read-only planning step — do not modify any files.

## Impact Analysis

$analyze-impact.output

## Refactoring Goal

$ARGUMENTS

## Principles

- **Behavior preservation**: The refactoring must NOT change any behavior — only structure
- **Incremental**: Each step must leave the codebase in a compilable state
- **Reversible**: Each step can be independently reverted
- **No mixed concerns**: Do not combine refactoring with bug fixes or improvements
- **Preserve public API**: All existing exports must remain accessible from the same import paths

## Instructions

1. Read the impact analysis from `$ARTIFACTS_DIR/impact-analysis.md`
2. Read the target files to understand current structure
3. Design the decomposition — group related functions into cohesive modules
4. Order tasks so each step compiles independently
5. Write the plan to `$ARTIFACTS_DIR/refactor-plan.md` with numbered steps, each containing:
   - What to move/rename/extract
   - Source and destination files
   - Import updates needed
   - Verification command

Provide structured output with task count and API preservation status.
