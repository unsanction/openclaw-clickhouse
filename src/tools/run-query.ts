import { query, isOperationAllowed, isReadonly } from "../client";
import { ToolResult } from "../types";

export const runQueryToolDefinition = {
  name: "clickhouse_run_query",
  description:
    "Execute a SQL query against ClickHouse. In readonly mode, only SELECT queries are allowed. Returns query results as JSON.",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "SQL query to execute",
      },
      database: {
        type: "string",
        description:
          "Database to run the query against. Uses default database if not specified.",
      },
    },
    required: ["query"],
  },
};

interface RunQueryInput {
  query: string;
  database?: string;
}

// Patterns that indicate a modifying query
const MODIFYING_PATTERNS = [
  /^\s*INSERT\s+/i,
  /^\s*UPDATE\s+/i,
  /^\s*DELETE\s+/i,
  /^\s*DROP\s+/i,
  /^\s*CREATE\s+/i,
  /^\s*ALTER\s+/i,
  /^\s*TRUNCATE\s+/i,
  /^\s*RENAME\s+/i,
  /^\s*ATTACH\s+/i,
  /^\s*DETACH\s+/i,
  /^\s*OPTIMIZE\s+/i,
  /^\s*KILL\s+/i,
  /^\s*GRANT\s+/i,
  /^\s*REVOKE\s+/i,
];

function isModifyingQuery(sql: string): boolean {
  return MODIFYING_PATTERNS.some((pattern) => pattern.test(sql));
}

export async function runQuery(input: RunQueryInput): Promise<ToolResult> {
  if (!isOperationAllowed("select")) {
    return {
      content: [
        {
          type: "text",
          text: "Error: select operation is not allowed by configuration",
        },
      ],
      isError: true,
    };
  }

  const sql = input.query.trim();

  // Check if query is modifying and we're in readonly mode
  if (isReadonly() && isModifyingQuery(sql)) {
    return {
      content: [
        {
          type: "text",
          text: `Error: Modifying queries are not allowed in readonly mode. Only SELECT queries are permitted.`,
        },
      ],
      isError: true,
    };
  }

  try {
    const result = await query<Record<string, unknown>>(sql, input.database);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              data: result.data,
              rows: result.rows,
              statistics: result.statistics,
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
          text: `Error executing query: ${message}`,
        },
      ],
      isError: true,
    };
  }
}
