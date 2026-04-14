/** Converts the WorkflowSchema into a JSON Schema (draft-2020-12) for external tooling. */

import { z } from "zod";

import { WorkflowSchema } from "./workflow.ts";

/** Generate a JSON Schema representation of the workflow definition. */
export function generateWorkflowJsonSchema(): unknown {
  return z.toJSONSchema(WorkflowSchema, {
    target: "draft-2020-12",
    reused: "inline",
  });
}
