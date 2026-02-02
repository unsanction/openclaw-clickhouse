export type AllowedOperation =
  | "select"
  | "insert"
  | "listDatabases"
  | "listTables"
  | "describeTable";

export interface ClickHousePluginConfig {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  secure?: boolean;
  readonly?: boolean;
  allowedOperations?: AllowedOperation[];
  queryTimeout?: number;
}

export interface ClickHousePluginConfigResolved {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  secure: boolean;
  readonly: boolean;
  allowedOperations: AllowedOperation[] | null;
  queryTimeout: number;
}

export function resolveConfig(config: ClickHousePluginConfig): ClickHousePluginConfigResolved {
  return {
    host: config.host ?? "localhost",
    port: config.port ?? 8123,
    username: config.username ?? "default",
    password: config.password ?? "",
    database: config.database ?? "default",
    secure: config.secure ?? false,
    readonly: config.readonly ?? true,
    allowedOperations: config.allowedOperations ?? null,
    queryTimeout: config.queryTimeout ?? 30000,
  };
}

export interface DatabaseInfo {
  name: string;
}

export interface TableInfo {
  name: string;
  database: string;
  engine: string;
  total_rows: string | null;
  total_bytes: string | null;
}

export interface ColumnInfo {
  name: string;
  type: string;
  default_kind: string;
  default_expression: string;
  comment: string;
  is_in_partition_key: number;
  is_in_sorting_key: number;
  is_in_primary_key: number;
}

export interface QueryResult<T = Record<string, unknown>> {
  data: T[];
  rows: number;
  statistics?: {
    elapsed: number;
    rows_read: number;
    bytes_read: number;
  };
}

export interface ToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}
