/** Custom error types for cc-framework. */

export class CcfError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "CcfError";
  }
}

export class WorkflowNotFoundError extends CcfError {
  constructor(name: string) {
    super(`Workflow "${name}" not found`, "WORKFLOW_NOT_FOUND");
  }
}

export class NodeExecutionError extends CcfError {
  constructor(nodeId: string, cause: string) {
    super(`Node "${nodeId}" failed: ${cause}`, "NODE_EXECUTION_ERROR");
  }
}

export class ConfigError extends CcfError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
  }
}

export class ValidationError extends CcfError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
  }
}

/** Format an error for user-friendly display. */
export function formatError(error: unknown): string {
  if (error instanceof CcfError) {
    return `[${error.code}] ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
