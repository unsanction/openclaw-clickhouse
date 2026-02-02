import { query, isOperationAllowed, getConfig } from "../client";
import { ColumnInfo, ToolResult } from "../types";

export const describeTableToolDefinition = {
  name: "clickhouse_describe_table",
  description:
    "Get the schema/structure of a ClickHouse table. Returns column names, types, default values, comments, and key information.",
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
        description: "Table name to describe",
      },
    },
    required: ["table"],
    additionalProperties: false,
  },
};

interface DescribeTableInput {
  database?: string;
  table: string;
}

export async function describeTable(
  input: DescribeTableInput | unknown
): Promise<ToolResult> {
  if (!isOperationAllowed("describeTable")) {
    return {
      content: [
        {
          type: "text",
          text: "Error: describeTable operation is not allowed by configuration",
        },
      ],
      isError: true,
    };
  }

  try {
    const params = input as Record<string, unknown>;
    const config = getConfig();
    const database = (params?.database as string) || config.database;
    const table = params?.table as string;

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

    // Escape single quotes
    const escapedDatabase = database.replace(/'/g, "''");
    const escapedTable = table.replace(/'/g, "''");

    const sql = `
      SELECT
        name,
        type,
        default_kind,
        default_expression,
        comment,
        is_in_partition_key,
        is_in_sorting_key,
        is_in_primary_key
      FROM system.columns
      WHERE database = '${escapedDatabase}' AND table = '${escapedTable}'
      ORDER BY position
    `;

    const result = await query<ColumnInfo>(sql);

    if (result.data.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `Table '${database}.${table}' not found or has no columns`,
          },
        ],
        isError: true,
      };
    }

    const columns = result.data.map((col) => ({
      name: col.name,
      type: col.type,
      default_kind: col.default_kind || null,
      default_expression: col.default_expression || null,
      comment: col.comment || null,
      is_partition_key: col.is_in_partition_key === 1,
      is_sorting_key: col.is_in_sorting_key === 1,
      is_primary_key: col.is_in_primary_key === 1,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              database,
              table,
              columns,
              column_count: columns.length,
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
          text: `Error describing table: ${message}`,
        },
      ],
      isError: true,
    };
  }
}
