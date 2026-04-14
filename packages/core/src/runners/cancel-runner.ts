/** Cancel node runner that halts workflow execution with a reason. */

/** Thrown to signal intentional workflow cancellation (not an error). */
export class WorkflowCancelledError extends Error {
  constructor(public readonly reason: string) {
    super(`Workflow cancelled: ${reason}`);
    this.name = "WorkflowCancelledError";
  }
}

/** Immediately cancel the current workflow run by throwing WorkflowCancelledError. */
export function runCancel(reason: string): never {
  throw new WorkflowCancelledError(reason);
}
