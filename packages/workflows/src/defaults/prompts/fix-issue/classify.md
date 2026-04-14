Classify the GitHub issue for this request.

## Request

$ARGUMENTS

## Instructions

1. Extract the GitHub issue number from the request
2. Fetch the issue details: `gh issue view <number> --json title,body,labels,state`
3. Classify the issue type based on title, body, and labels:
   - `bug` — Something is broken or behaving incorrectly
   - `feature` — New functionality to implement
   - `enhancement` — Improvement to existing functionality
   - `chore` — Maintenance, refactoring, dependencies
4. Assess complexity: `simple`, `moderate`, or `complex`

Provide your classification as structured JSON output.
