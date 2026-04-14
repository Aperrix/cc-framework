export class WorkflowCancelledError extends Error {
  constructor(public readonly reason: string) {
    super(`Workflow cancelled: ${reason}`);
    this.name = "WorkflowCancelledError";
  }
}

export function runCancel(reason: string): never {
  throw new WorkflowCancelledError(reason);
}
