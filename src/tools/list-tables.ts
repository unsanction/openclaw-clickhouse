import { query, isOperationAllowed, getConfig } from "../client";
import { TableInfo, ToolResult } from "../types";

export const listTablesToolDefinition = {
  name: "clickhouse_list_tables",
  description:
    "List tables in a ClickHouse database. Returns table name, engine, row count, and size. Can filter tables using a LIKE pattern.",
  inputSchema: {
    type: "object" as const,
    properties: {
      database: {
        type: "string",
        description:
          "Database name to list tables from. Uses default database if not specified.",
      },
      like: {
        type: "string",
        description:
          "Optional LIKE pattern to filter table names (e.g., '%logs%')",
      },
    },
    required: [],
  },
};

interface ListTablesInput {
  database?: string;
  like?: string;
}

export async function listTables(input: ListTablesInput): Promise<ToolResult> {
  if (!isOperationAllowed("listTables")) {
    return {
      content: [
        {
          type: "text",
          text: "Error: listTables operation is not allowed by configuration",
        },
      ],
      isError: true,
    };
  }

  try {
    const config = getConfig();
    const database = input.database || config.database;

    let sql = `
      SELECT
        name,
        database,
        engine,
        toString(total_rows) as total_rows,
        toString(total_bytes) as total_bytes
      FROM system.tables
      WHERE database = '${database}'
    `;

    if (input.like) {
      // Escape single quotes in the pattern
      const escapedLike = input.like.replace(/'/g, "''");
      sql += ` AND name LIKE '${escapedLike}'`;
    }

    sql += " ORDER BY name";

    const result = await query<TableInfo>(sql);

    const tables = result.data.map((row) => ({
      name: row.name,
      engine: row.engine,
      total_rows: row.total_rows,
      total_bytes: row.total_bytes,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              database,
              tables,
              count: tables.length,
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
          text: `Error listing tables: ${message}`,
        },
      ],
      isError: true,
    };
  }
}
