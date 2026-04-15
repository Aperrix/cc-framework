#!/usr/bin/env node
/** cc-framework CLI — deterministic workflow engine for AI-assisted development. */

import { toError } from "@cc-framework/utils";
import { createCliContext, destroyCliContext } from "./shared/context.ts";
import { formatError } from "./shared/format.ts";
import { commandInit } from "./commands/init.ts";
import { commandList } from "./commands/list.ts";
import { commandRun } from "./commands/run.ts";
import { commandStatus } from "./commands/status.ts";
import { commandResume } from "./commands/resume.ts";
import { commandApprove } from "./commands/approve.ts";
import { commandReject } from "./commands/reject.ts";
import { commandLogs } from "./commands/logs.ts";
import { commandAbandon } from "./commands/abandon.ts";
import { commandComplete } from "./commands/complete.ts";

// ---- Arg Parsing ----

function parseArgs(argv: string[]): {
  command: string;
  positional: string[];
  flags: Record<string, string>;
} {
  const args = argv.slice(2); // skip node + script
  const command = args[0] ?? "help";
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
      flags[key] = value;
    } else {
      positional.push(args[i]);
    }
  }

  return { command, positional, flags };
}

const HELP = `
cc-framework — deterministic workflow engine for AI-assisted development

Usage: ccf <command> [options]

Commands:
  init                          Initialize .cc-framework/ in current project
  run <workflow> [--arg value]  Run a workflow
  list                          List available workflows
  status [runId]                Show run status
  resume <runId>                Resume a paused or failed run
  approve <runId> <nodeId>      Approve a pending approval node
  reject <runId> <nodeId>       Reject with optional --reason "..."
  logs <runId>                  Show event timeline for a run
  abandon <runId>               Abandon (cancel) a non-terminal run
  complete <branch> [--remote]  Remove worktree + branches after merge
  help                          Show this help message
`.trim();

// ---- Main ----

async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv);

  if (command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(`${HELP}\n`);
    return;
  }

  // Init doesn't need full context (no DB yet potentially)
  if (command === "init") {
    const result = await commandInit(process.cwd());
    process.stdout.write(`${result}\n`);
    return;
  }

  // All other commands need the full context
  const ctx = await createCliContext(process.cwd());

  try {
    let output: string;

    switch (command) {
      case "run":
        if (!positional[0]) throw new Error("Usage: ccf run <workflow-name>");
        output = await commandRun(
          positional[0],
          flags.arg ?? flags.args ?? undefined,
          ctx.config,
          ctx.store,
          ctx.sessionId,
          ctx.cwd,
        );
        break;

      case "list":
        output = await commandList(ctx.config);
        break;

      case "status":
        output = await commandStatus(positional[0], ctx.store, ctx.sessionId);
        break;

      case "resume":
        if (!positional[0]) throw new Error("Usage: ccf resume <runId>");
        output = await commandResume(positional[0], ctx.config, ctx.store, ctx.cwd);
        break;

      case "approve":
        if (!positional[0] || !positional[1])
          throw new Error("Usage: ccf approve <runId> <nodeId>");
        output = await commandApprove(positional[0], positional[1], ctx.store);
        break;

      case "reject":
        if (!positional[0] || !positional[1]) throw new Error("Usage: ccf reject <runId> <nodeId>");
        output = await commandReject(positional[0], positional[1], flags.reason, ctx.store);
        break;

      case "logs":
        if (!positional[0]) throw new Error("Usage: ccf logs <runId>");
        output = await commandLogs(positional[0], ctx.store);
        break;

      case "abandon":
        if (!positional[0]) throw new Error("Usage: ccf abandon <runId>");
        output = await commandAbandon(positional[0], ctx.store);
        break;

      case "complete":
        if (!positional[0]) throw new Error("Usage: ccf complete <branch> [--remote]");
        output = await commandComplete(positional[0], ctx.cwd, flags.remote === "true");
        break;

      default:
        output = `Unknown command: "${command}". Run 'ccf help' for usage.`;
    }

    process.stdout.write(`${output}\n`);
  } catch (error) {
    console.error(formatError(toError(error).message));
    process.exitCode = 1;
  } finally {
    destroyCliContext(ctx);
  }
}

void main();
