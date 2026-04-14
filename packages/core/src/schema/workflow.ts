import { z } from "zod";
import { NodeSchema } from "./node.ts";
import { IsolationSchema, InputDefinitionSchema, SandboxSchema } from "./common.ts";

export const WorkflowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  model: z.string().optional(),
  interactive: z.boolean().default(false),
  effort: z.enum(["low", "medium", "high", "max"]).optional(),
  thinking: z.union([z.literal("adaptive"), z.literal("disabled")]).optional(),
  fallbackModel: z.string().optional(),
  betas: z.array(z.string()).optional(),
  sandbox: SandboxSchema.optional(),
  isolation: IsolationSchema.optional(),
  inputs: z.record(InputDefinitionSchema).optional(),
  nodes: z.array(NodeSchema).min(1),
});

export type Workflow = z.infer<typeof WorkflowSchema>;
