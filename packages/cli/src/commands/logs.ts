/** ccf logs <runId> — show event timeline for a run. */

import type { StoreQueries } from "@cc-framework/core";
import { formatEvent, formatRunStatus } from "../shared/format.ts";

export async function commandLogs(runId: string, store: StoreQueries): Promise<string> {
  const run = store.getRun(runId);
  if (!run) throw new Error(`Run "${runId}" not found.`);

  const events = store.getEvents(runId);
  if (events.length === 0) return `No events for run ${runId.slice(0, 8)}.`;

  const header = formatRunStatus(run);
  const eventLines = events.map(formatEvent);
  return [header, "", ...eventLines].join("\n");
}
