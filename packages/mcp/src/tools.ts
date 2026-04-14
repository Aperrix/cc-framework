/** MCP tool definitions for cc-framework. */

import {
  initProject,
  discoverWorkflows,
  findWorkflow,
  parseWorkflow,
  WorkflowExecutor,
  WorkflowEventBus,
} from "@cc-framework/core";

import type { McpContext } from "./context.ts";

// ---- Tool Definitions ----
// Each definition pairs a description with a JSON Schema inputSchema.
// We use raw JSON Schema because Zod v4 types are not directly assignable
// to the MCP SDK's ZodRawShapeCompat (which expects zod/v4/core.$ZodType).

export interface ToolDef {
  description: string;
  inputSchema?: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export const toolDefs: Record<string, ToolDef> = {
  ccf_init: {
    description:
      "Initialize .cc-framework/ directory in the current project with config, workflows, prompts, and scripts directories.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Project path (defaults to current directory)" },
      },
    },
  },
  ccf_run: {
    description:
      "Run a workflow by name. Discovers the workflow, parses it, and executes the full DAG. Returns the run status and node outputs.",
    inputSchema: {
      type: "object",
      properties: {
        workflow: {
          type: "string",
          description: "Workflow name (e.g., 'fix-issue', 'review')",
        },
        args: { type: "string", description: "Arguments passed as $ARGUMENTS variable" },
      },
      required: ["workflow"],
    },
  },
  ccf_list: {
    description:
      "List all available workflows from embedded defaults, global directory, and project directory.",
  },
  ccf_status: {
    description: "Get the status of a specific run or list recent runs in the current session.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Run ID. If omitted, lists recent runs." },
      },
    },
  },
  ccf_resume: {
    description:
      "Resume a paused (approval) or failed run from the last checkpoint. Completed nodes are skipped.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Run ID to resume" },
      },
      required: ["runId"],
    },
  },
  ccf_approve: {
    description: "Approve a pending approval node in a paused workflow run.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Run ID" },
        nodeId: { type: "string", description: "Node ID to approve" },
      },
      required: ["runId", "nodeId"],
    },
  },
  ccf_reject: {
    description: "Reject a pending approval node in a paused workflow run.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Run ID" },
        nodeId: { type: "string", description: "Node ID to reject" },
        reason: { type: "string", description: "Rejection reason" },
      },
      required: ["runId", "nodeId"],
    },
  },
  ccf_logs: {
    description:
      "Show the event timeline for a workflow run — node starts, completions, errors, retries.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Run ID" },
      },
      required: ["runId"],
    },
  },
};

// ---- Formatters (same as CLI, inlined for simplicity) ----

const STATUS_ICONS: Record<string, string> = {
  completed: "\u2713",
  failed: "\u2717",
  cancelled: "\u2298",
  paused: "\u23F8",
  running: "\u27F3",
  pending: "\u25CB",
  skipped: "\u2013",
};

function fmtRun(run: {
  id: string;
  status: string;
  startedAt: number;
  finishedAt?: number | null;
}): string {
  const icon = STATUS_ICONS[run.status] ?? "?";
  const dur = run.finishedAt
    ? `${Math.round((run.finishedAt - run.startedAt) / 1000)}s`
    : "in progress";
  return `${icon} Run ${run.id.slice(0, 8)} \u2014 ${run.status} (${dur})`;
}

function fmtEvent(e: {
  type: string;
  nodeId?: string | null;
  timestamp: number;
  payload?: string | null;
}): string {
  const t = new Date(e.timestamp).toISOString().slice(11, 19);
  const n = e.nodeId ? `[${e.nodeId}]` : "";
  const p = e.payload ? ` \u2014 ${e.payload.slice(0, 200)}` : "";
  return `${t} ${e.type} ${n}${p}`;
}

// ---- Response helpers ----

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

function error(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true as const,
  };
}

// ---- Handlers ----

export function createHandlers(ctx: McpContext) {
  return {
    ccf_init: async (args: { path?: string }) => {
      try {
        const target = args.path ?? ctx.cwd;
        await initProject(target);
        return text(
          `Initialized .cc-framework/ in ${target}\nCreated: config.yaml, workflows/, prompts/, scripts/`,
        );
      } catch (e) {
        return error(e instanceof Error ? e.message : String(e));
      }
    },

    ccf_run: async (args: { workflow: string; args?: string }) => {
      try {
        const discovered = await findWorkflow(args.workflow, ctx.config);
        if (!discovered) {
          return error(
            `Workflow "${args.workflow}" not found. Use ccf_list to see available workflows.`,
          );
        }

        const workflow = await parseWorkflow(discovered.path, ctx.config);
        const eventBus = new WorkflowEventBus();
        const executor = new WorkflowExecutor(ctx.store, eventBus);
        const result = await executor.run(workflow, ctx.cwd, args.args, ctx.config, ctx.sessionId);

        const lines = [fmtRun({ id: result.runId, status: result.status, startedAt: Date.now() })];
        const outputs = ctx.store.getNodeOutputs(result.runId);
        for (const [nodeId, out] of Object.entries(outputs)) {
          lines.push(`  ${nodeId}: ${out.output.split("\n")[0].slice(0, 100)}`);
        }
        return text(lines.join("\n"));
      } catch (e) {
        return error(e instanceof Error ? e.message : String(e));
      }
    },

    ccf_list: async () => {
      try {
        const workflows = await discoverWorkflows(ctx.config);
        if (workflows.length === 0) return text("No workflows found.");
        const lines = ["Available workflows:", ""];
        for (const wf of workflows) {
          const tag =
            wf.source === "embedded"
              ? "[built-in]"
              : wf.source === "global"
                ? "[global]"
                : "[project]";
          lines.push(`  ${wf.name} ${tag}`);
        }
        return text(lines.join("\n"));
      } catch (e) {
        return error(e instanceof Error ? e.message : String(e));
      }
    },

    ccf_status: async (args: { runId?: string }) => {
      try {
        if (args.runId) {
          const run = ctx.store.getRun(args.runId);
          if (!run) return error(`Run "${args.runId}" not found.`);
          return text(fmtRun(run));
        }
        const runs = ctx.store.getSessionRuns(ctx.sessionId);
        if (runs.length === 0) return text("No runs in current session.");
        return text(runs.map(fmtRun).join("\n"));
      } catch (e) {
        return error(e instanceof Error ? e.message : String(e));
      }
    },

    ccf_resume: async (args: { runId: string }) => {
      try {
        const run = ctx.store.getRun(args.runId);
        if (!run) return error(`Run "${args.runId}" not found.`);
        if (run.status !== "failed" && run.status !== "paused") {
          return error(`Run is ${run.status} \u2014 can only resume failed or paused runs.`);
        }

        const wf = ctx.store.getWorkflow(run.workflowId);
        if (!wf) return error("Workflow not found in database.");

        const discovered = await findWorkflow(wf.name, ctx.config);
        if (!discovered) return error(`Workflow "${wf.name}" no longer exists on disk.`);

        const workflow = await parseWorkflow(discovered.path, ctx.config);
        const eventBus = new WorkflowEventBus();
        const executor = new WorkflowExecutor(ctx.store, eventBus);
        const result = await executor.resume(
          workflow,
          args.runId,
          ctx.cwd,
          run.arguments ?? undefined,
          ctx.config,
        );
        return text(fmtRun({ id: result.runId, status: result.status, startedAt: Date.now() }));
      } catch (e) {
        return error(e instanceof Error ? e.message : String(e));
      }
    },

    ccf_approve: async (args: { runId: string; nodeId: string }) => {
      try {
        const run = ctx.store.getRun(args.runId);
        if (!run) return error(`Run "${args.runId}" not found.`);
        if (run.status !== "paused") return error(`Run is ${run.status} \u2014 not paused.`);
        ctx.store.recordEvent(args.runId, args.nodeId, "approval:approved");
        ctx.store.resumeRun(args.runId);
        return text(`Approved node "${args.nodeId}". Use ccf_resume to continue execution.`);
      } catch (e) {
        return error(e instanceof Error ? e.message : String(e));
      }
    },

    ccf_reject: async (args: { runId: string; nodeId: string; reason?: string }) => {
      try {
        const run = ctx.store.getRun(args.runId);
        if (!run) return error(`Run "${args.runId}" not found.`);
        if (run.status !== "paused") return error(`Run is ${run.status} \u2014 not paused.`);
        ctx.store.recordEvent(args.runId, args.nodeId, "approval:rejected", args.reason);
        return text(
          `Rejected node "${args.nodeId}".${args.reason ? ` Reason: ${args.reason}` : ""}`,
        );
      } catch (e) {
        return error(e instanceof Error ? e.message : String(e));
      }
    },

    ccf_logs: async (args: { runId: string }) => {
      try {
        const run = ctx.store.getRun(args.runId);
        if (!run) return error(`Run "${args.runId}" not found.`);
        const events = ctx.store.getEvents(args.runId);
        if (events.length === 0) return text(`No events for run ${args.runId.slice(0, 8)}.`);
        return text([fmtRun(run), "", ...events.map(fmtEvent)].join("\n"));
      } catch (e) {
        return error(e instanceof Error ? e.message : String(e));
      }
    },
  };
}
