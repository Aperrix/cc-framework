/** ccf init — initialize .cc-framework/ in the current project. */

import { initProject } from "@cc-framework/workflows";

export async function commandInit(cwd: string): Promise<string> {
  await initProject(cwd);
  return `Initialized .cc-framework/ in ${cwd}\nCreated: config.yaml, workflows/, prompts/, scripts/`;
}
