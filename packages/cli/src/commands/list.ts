/** ccf list — list available workflows. */

import type { ResolvedConfig } from "@cc-framework/core";
import { discoverWorkflows } from "@cc-framework/workflows";
import { formatWorkflowList } from "../shared/format.ts";

export async function commandList(config: ResolvedConfig): Promise<string> {
  const workflows = await discoverWorkflows(config);
  return formatWorkflowList(workflows);
}
