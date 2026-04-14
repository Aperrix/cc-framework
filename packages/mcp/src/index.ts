#!/usr/bin/env node
/** cc-framework MCP server — exposes workflow tools to Claude Code. */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createMcpContext, destroyMcpContext } from "./context.ts";
import { toolDefs, createHandlers, type ToolDef } from "./tools.ts";

type Handlers = ReturnType<typeof createHandlers>;

/** Register a single tool, bridging our ToolDef + handler to the McpServer API. */
function register(
  server: McpServer,
  name: string,
  def: ToolDef,
  handler: Handlers[keyof Handlers],
) {
  if (def.inputSchema) {
    // Use the deprecated but simpler `tool(name, description, jsonSchema, cb)` overload.
    // The MCP SDK accepts raw JSON Schema objects at runtime even though the types expect Zod.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    server.tool(name, def.description, def.inputSchema as any, handler as any);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    server.tool(name, def.description, handler as any);
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
