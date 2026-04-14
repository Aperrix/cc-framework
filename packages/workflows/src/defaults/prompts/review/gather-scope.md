Gather the scope and metadata of the PR to review.

## Request

$ARGUMENTS

## Instructions

1. Extract the PR number from the request
2. Fetch PR metadata: `gh pr view <number> --json number,title,body,baseRefName,headRefName,changedFiles,additions,deletions`
3. Get the diff: `gh pr diff <number>`
4. Save the diff to `$ARTIFACTS_DIR/pr-diff.patch`
5. Summarize the scope: which areas of the codebase are affected, how many files changed

Provide structured JSON output with PR metadata.
