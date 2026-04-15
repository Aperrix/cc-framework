#!/usr/bin/env node
/** cc-framework MCP server — exposes workflow tools to Claude Code. */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createMcpContext, destroyMcpContext } from "./context.ts";
import { toolDefs, createHandlers, type ToolDef } from "./tools.ts";

type Handlers = ReturnType<typeof createHandlers>;

/**
 * Register a single tool, bridging our ToolDef + handler to the McpServer API.
 *
 * The MCP SDK's .tool() method expects Zod v4 schemas, but we use raw JSON Schema
 * objects (because Zod v4 types aren't directly assignable to the SDK's ZodRawShapeCompat).
 * The SDK accepts raw JSON Schema at runtime — this bridge function isolates the
 * type incompatibility to a single location.
 */
function register(
  server: McpServer,
  name: string,
  def: ToolDef,
  handler: Handlers[keyof Handlers],
) {
  // SDK boundary: McpServer.tool() accepts raw JSON Schema at runtime but types expect Zod.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schema = def.inputSchema as unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cb = handler as unknown;
  if (def.inputSchema) {
    (server.tool as Function)(name, def.description, schema, cb);
  } else {
    (server.tool as Function)(name, def.description, cb);
  }
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const ctx = await createMcpContext(cwd);
  const handlers = createHandlers(ctx);

  const server = new McpServer({
    name: "cc-framework",
    version: "0.0.1",
  });

  // Register all 8 tools
  register(server, "ccf_init", toolDefs.ccf_init, handlers.ccf_init);
  register(server, "ccf_run", toolDefs.ccf_run, handlers.ccf_run);
  register(server, "ccf_list", toolDefs.ccf_list, handlers.ccf_list);
  register(server, "ccf_status", toolDefs.ccf_status, handlers.ccf_status);
  register(server, "ccf_resume", toolDefs.ccf_resume, handlers.ccf_resume);
  register(server, "ccf_approve", toolDefs.ccf_approve, handlers.ccf_approve);
  register(server, "ccf_reject", toolDefs.ccf_reject, handlers.ccf_reject);
  register(server, "ccf_logs", toolDefs.ccf_logs, handlers.ccf_logs);

  // Cleanup on exit
  process.on("SIGINT", () => {
    destroyMcpContext(ctx);
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    destroyMcpContext(ctx);
    process.exit(0);
  });

  // Start stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

void main();
