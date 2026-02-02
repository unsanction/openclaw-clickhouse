import { ClickHousePluginConfig, resolveConfig } from "./src/types";
import { initClient, closeClient, isOperationAllowed, isReadonly } from "./src/client";
import {
  listDatabasesToolDefinition,
  listDatabases,
  listTablesToolDefinition,
  listTables,
  describeTableToolDefinition,
  describeTable,
  runQueryToolDefinition,
  runQuery,
  insertDataToolDefinition,
  insertData,
} from "./src/tools";

interface PluginAPI {
  registerTool(definition: {
    name: string;
    description: string;
    parameters: object;
    execute: (...args: unknown[]) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;
  }): void;
  on(event: string, handler: () => void | Promise<void>): void;
  log(level: "info" | "warn" | "error", message: string): void;
}

export interface PluginContext {
  config: ClickHousePluginConfig;
  api: PluginAPI;
}

export async function activate(...args: unknown[]): Promise<void> {
  // Extract config and api from OpenClaw plugin context
  // OpenClaw passes: { id, name, version, config, pluginConfig, logger, registerTool, on, ... }
  const ctx = args[0] as Record<string, unknown> | undefined;

  // pluginConfig contains the user's plugin configuration from openclaw.json
  const config: ClickHousePluginConfig = (ctx?.pluginConfig as ClickHousePluginConfig) || {};

  // The context itself has API methods like registerTool, on, logger
  const api: PluginAPI | undefined = ctx as unknown as PluginAPI;

  // Helper for safe logging
  const log = (level: "info" | "warn" | "error", message: string) => {
    if (api?.log) {
      api.log(level, message);
    } else {
      console.log(`[clickhouse] [${level}] ${message}`);
    }
  };

  // Resolve config with defaults
  const resolvedConfig = resolveConfig(config);

  // Initialize ClickHouse client
  try {
    initClient(resolvedConfig);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("error", `Failed to initialize ClickHouse client: ${message}`);
    throw error;
  }

  // Helper to extract params from OpenClaw execute args
  // OpenClaw passes: (toolCallId, params, context, callback)
  const extractParams = (...args: unknown[]): Record<string, unknown> => {
    // If first arg is string (toolCallId), params are in second arg
    if (typeof args[0] === "string" && args.length > 1) {
      return (args[1] as Record<string, unknown>) || {};
    }
    // If first arg is object, it's the params
    if (typeof args[0] === "object" && args[0] !== null) {
      return args[0] as Record<string, unknown>;
    }
    return {};
  };

  // Register tools based on allowed operations
  const tools = [
    {
      definition: listDatabasesToolDefinition,
      handler: async (...args: unknown[]) => {
        extractParams(...args);
        return listDatabases();
      },
      operation: "listDatabases" as const,
    },
    {
      definition: listTablesToolDefinition,
      handler: async (...args: unknown[]) => listTables(extractParams(...args)),
      operation: "listTables" as const,
    },
    {
      definition: describeTableToolDefinition,
      handler: async (...args: unknown[]) => describeTable(extractParams(...args)),
      operation: "describeTable" as const,
    },
    {
      definition: runQueryToolDefinition,
      handler: async (...args: unknown[]) => runQuery(extractParams(...args)),
      operation: "select" as const,
    },
    {
      definition: insertDataToolDefinition,
      handler: async (...args: unknown[]) => insertData(extractParams(...args)),
      operation: "insert" as const,
    },
  ];

  for (const tool of tools) {
    // Skip insert tool if in readonly mode
    if (tool.operation === "insert" && isReadonly()) {
      continue;
    }

    // Check if operation is allowed by configuration
    if (!isOperationAllowed(tool.operation)) {
      continue;
    }

    if (api?.registerTool) {
      api.registerTool({
        name: tool.definition.name,
        description: tool.definition.description,
        parameters: tool.definition.inputSchema,
        execute: tool.handler,
      });
    }
  }

  // Register cleanup handler
  if (api?.on) {
    api.on("session_end", async () => {
      await closeClient();
    });
  }
}

export async function deactivate(): Promise<void> {
  await closeClient();
}

// Export types for consumers
export { ClickHousePluginConfig } from "./src/types";
