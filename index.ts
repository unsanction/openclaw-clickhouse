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
    inputSchema: object;
    handler: (input: unknown) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;
  }): void;
  on(event: string, handler: () => void | Promise<void>): void;
  log(level: "info" | "warn" | "error", message: string): void;
}

export interface PluginContext {
  config: ClickHousePluginConfig;
  api: PluginAPI;
}

export async function activate(context: PluginContext): Promise<void> {
  const { config, api } = context || {};

  // Helper for safe logging
  const log = (level: "info" | "warn" | "error", message: string) => {
    if (api?.log) {
      api.log(level, message);
    } else {
      console.log(`[clickhouse] [${level}] ${message}`);
    }
  };

  // Resolve config with defaults
  const resolvedConfig = resolveConfig(config || {});

  // Initialize ClickHouse client
  try {
    initClient(resolvedConfig);
    log("info", `Connected to ClickHouse at ${resolvedConfig.host}:${resolvedConfig.port}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("error", `Failed to initialize ClickHouse client: ${message}`);
    throw error;
  }

  // Register tools based on allowed operations
  const tools = [
    {
      definition: listDatabasesToolDefinition,
      handler: async () => listDatabases(),
      operation: "listDatabases" as const,
    },
    {
      definition: listTablesToolDefinition,
      handler: async (input: unknown) => listTables(input as { database?: string; like?: string }),
      operation: "listTables" as const,
    },
    {
      definition: describeTableToolDefinition,
      handler: async (input: unknown) => describeTable(input as { database?: string; table: string }),
      operation: "describeTable" as const,
    },
    {
      definition: runQueryToolDefinition,
      handler: async (input: unknown) => runQuery(input as { query: string; database?: string }),
      operation: "select" as const,
    },
    {
      definition: insertDataToolDefinition,
      handler: async (input: unknown) =>
        insertData(input as { database?: string; table: string; data: Record<string, unknown>[] }),
      operation: "insert" as const,
    },
  ];

  for (const tool of tools) {
    // Skip insert tool if in readonly mode
    if (tool.operation === "insert" && isReadonly()) {
      log("info", `Skipping ${tool.definition.name} tool (readonly mode)`);
      continue;
    }

    // Check if operation is allowed by configuration
    if (!isOperationAllowed(tool.operation)) {
      log("info", `Skipping ${tool.definition.name} tool (not in allowedOperations)`);
      continue;
    }

    if (api?.registerTool) {
      api.registerTool({
        name: tool.definition.name,
        description: tool.definition.description,
        inputSchema: tool.definition.inputSchema,
        handler: tool.handler,
      });
    }

    log("info", `Registered tool: ${tool.definition.name}`);
  }

  // Register cleanup handler
  if (api?.on) {
    api.on("session_end", async () => {
      await closeClient();
      log("info", "ClickHouse client closed");
    });
  }

  log("info", `OpenClaw ClickHouse plugin activated (readonly: ${resolvedConfig.readonly})`);
}

export async function deactivate(): Promise<void> {
  await closeClient();
}

// Export types for consumers
export { ClickHousePluginConfig } from "./src/types";
