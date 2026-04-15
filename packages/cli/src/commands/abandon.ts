/** ccf abandon <runId> — abandon (cancel) a non-terminal workflow run. */

import { abandonWorkflow } from "@cc-framework/core";
import type { StoreQueries } from "@cc-framework/workflows";

export async function commandAbandon(runId: string, store: StoreQueries): Promise<string> {
  abandonWorkflow(runId, store);
  return `Abandoned run ${runId.slice(0, 8)}.`;
}
