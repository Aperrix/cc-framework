import { z } from "zod";
import { WorkflowSchema } from "./workflow.ts";

export function generateWorkflowJsonSchema(): unknown {
  return z.toJSONSchema(WorkflowSchema, {
    target: "draft-2020-12",
    reused: "inline",
  });
}
