import { insert, isOperationAllowed, isReadonly } from "../client";
import { ToolResult } from "../types";

export const insertDataToolDefinition = {
  name: "clickhouse_insert",
  description:
    "Insert data into a ClickHouse table. Only available when readonly mode is disabled. Data should be provided as an array of objects where keys match column names.",
  inputSchema: {
    type: "object",
    properties: {
      database: {
        type: "string",
        description:
          "Database name. Uses default database if not specified.",
      },
      table: {
        type: "string",
        description: "Table name to insert data into",
      },
      data: {
        type: "array",
        items: {
          type: "object",
        },
        description:
          "Array of objects to insert. Each object's keys should match the table's column names.",
      },
    },
    required: ["table", "data"],
    additionalProperties: false,
  },
};

interface InsertDataInput {
  database?: string;
  table: string;
  data: Record<string, unknown>[];
}

export async function insertData(input: InsertDataInput | unknown): Promise<ToolResult> {
  // Check readonly mode first
  if (isReadonly()) {
    return {
      content: [
        {
          type: "text",
          text: "Error: Insert operation is not allowed in readonly mode. Set readonly: false in the plugin configuration to enable writes.",
        },
      ],
      isError: true,
    };
  }

  // Check if insert operation is allowed
  if (!isOperationAllowed("insert")) {
    return {
      content: [
        {
          type: "text",
          text: "Error: insert operation is not allowed by configuration",
        },
      ],
      isError: true,
    };
  }

  const params = input as Record<string, unknown>;
  const table = params?.table as string;
  const data = params?.data as Record<string, unknown>[];
  const database = params?.database as string | undefined;

  if (!table) {
    return {
      content: [
        {
          type: "text",
          text: "Error: table parameter is required",
        },
      ],
      isError: true,
    };
  }

  // Validate input
  if (!Array.isArray(data) || data.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: "Error: data must be a non-empty array of objects",
        },
      ],
      isError: true,
    };
  }

  try {
    await insert(table, data, database);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              table,
              database: database || "default",
              rows_inserted: data.length,
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
          text: `Error inserting data: ${message}`,
        },
      ],
      isError: true,
    };
  }
}
