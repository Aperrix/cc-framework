import { z } from "zod";
import { WorkflowSchema } from "./workflow.ts";

export function generateWorkflowJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(WorkflowSchema, {
    target: "draft-2020-12",
    reused: "inline",
  }) as Record<string, unknown>;
}
