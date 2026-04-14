/** ccf list — list available workflows. */

import { discoverWorkflows, type ResolvedConfig } from "@cc-framework/core";
import { formatWorkflowList } from "../shared/format.ts";

export async function commandList(config: ResolvedConfig): Promise<string> {
  const workflows = await discoverWorkflows(config);
  return formatWorkflowList(workflows);
}
