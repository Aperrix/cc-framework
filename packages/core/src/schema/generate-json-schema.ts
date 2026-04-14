import { zodToJsonSchema } from "zod-to-json-schema";
import { WorkflowSchema } from "./workflow.ts";

export function generateWorkflowJsonSchema(): Record<string, unknown> {
  return zodToJsonSchema(WorkflowSchema, {
    name: "CCFrameworkWorkflow",
    $refStrategy: "none",
  });
}
