import { createClient, ClickHouseClient } from "@clickhouse/client";
import {
  ClickHousePluginConfigResolved,
  AllowedOperation,
} from "./types";

let clientInstance: ClickHouseClient | null = null;
let currentConfig: ClickHousePluginConfigResolved | null = null;

export function initClient(config: ClickHousePluginConfigResolved): ClickHouseClient {
  if (clientInstance) {
    return clientInstance;
  }

  const protocol = config.secure ? "https" : "http";
  const url = `${protocol}://${config.host}:${config.port}`;

  clientInstance = createClient({
    url,
    username: config.username,
    password: config.password,
    database: config.database,
    request_timeout: config.queryTimeout,
    clickhouse_settings: {
      readonly: config.readonly ? "1" : "0",
    },
  });

  currentConfig = config;
  return clientInstance;
}

export function getClient(): ClickHouseClient {
  if (!clientInstance) {
    throw new Error("ClickHouse client not initialized. Call initClient first.");
  }
  return clientInstance;
}

export function getConfig(): ClickHousePluginConfigResolved {
  if (!currentConfig) {
    throw new Error("ClickHouse client not initialized. Call initClient first.");
  }
  return currentConfig;
}

export async function closeClient(): Promise<void> {
  if (clientInstance) {
    await clientInstance.close();
    clientInstance = null;
    currentConfig = null;
  }
}

export function isOperationAllowed(operation: AllowedOperation): boolean {
  const config = getConfig();

  // If allowedOperations is not set, allow based on readonly setting
  if (!config.allowedOperations) {
    if (operation === "insert") {
      return !config.readonly;
    }
    return true;
  }

  return config.allowedOperations.includes(operation);
}

export function isReadonly(): boolean {
  return getConfig().readonly;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  database?: string
): Promise<{ data: T[]; rows: number; statistics?: { elapsed: number; rows_read: number; bytes_read: number } }> {
  const client = getClient();
  const config = getConfig();

  const result = await client.query({
    query: sql,
    format: "JSONEachRow",
    clickhouse_settings: database
      ? { database }
      : { database: config.database },
  });

  const data = await result.json<T>();

  return {
    data: data as T[],
    rows: Array.isArray(data) ? data.length : 0,
    statistics: {
      elapsed: 0,
      rows_read: 0,
      bytes_read: 0,
    },
  };
}

export async function insert<T extends Record<string, unknown>>(
  table: string,
  values: T[],
  database?: string
): Promise<void> {
  const client = getClient();
  const config = getConfig();

  if (config.readonly) {
    throw new Error("Cannot insert in readonly mode");
  }

  await client.insert({
    table: database ? `${database}.${table}` : table,
    values,
    format: "JSONEachRow",
  });
}
