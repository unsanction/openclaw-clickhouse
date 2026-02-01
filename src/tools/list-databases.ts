import { query, isOperationAllowed } from "../client";
import { DatabaseInfo, ToolResult } from "../types";

export const listDatabasesToolDefinition = {
  name: "clickhouse_list_databases",
  description:
    "List all available databases in the ClickHouse server. Returns the name of each database.",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export async function listDatabases(): Promise<ToolResult> {
  if (!isOperationAllowed("listDatabases")) {
    return {
      content: [
        {
          type: "text",
          text: "Error: listDatabases operation is not allowed by configuration",
        },
      ],
      isError: true,
    };
  }

  try {
    const result = await query<DatabaseInfo>("SHOW DATABASES");

    const databases = result.data.map((row) => row.name);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              databases,
              count: databases.length,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error listing databases: ${message}`,
        },
      ],
      isError: true,
    };
  }
}
