import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { WorkflowSchema, type Workflow } from "../schema/workflow.ts";
import { resolvePrompt } from "./resolve-prompt.ts";

export async function parseWorkflow(filePath: string, projectRoot: string): Promise<Workflow> {
  const raw = await readFile(filePath, "utf-8");
  const data = parseYaml(raw);
  const workflow = WorkflowSchema.parse(data);

  for (const node of workflow.nodes) {
    if (node.prompt !== undefined) {
      node.prompt = await resolvePrompt(node.prompt, projectRoot);
    }
    if (node.loop?.prompt !== undefined) {
      node.loop.prompt = await resolvePrompt(node.loop.prompt, projectRoot);
    }
  }

  return workflow;
}
