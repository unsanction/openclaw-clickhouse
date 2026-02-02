# OpenClaw ClickHouse Plugin

Connect your AI agent to ClickHouse databases. List databases, explore tables, run queries, and insert data.

## Installation

### Option 1: From npm (Recommended)

```bash
openclaw plugins install @unsanction/openclaw-clickhouse
```

### Option 2: From GitHub

```bash
openclaw plugins install github:unsanction/openclaw-clickhouse
```

### Option 3: Local Development

```bash
git clone https://github.com/unsanction/openclaw-clickhouse.git
cd openclaw-clickhouse
npm install
npm run build
openclaw plugins install -l ./openclaw-clickhouse
```

## Configuration

Add to your `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "clickhouse": {
        "enabled": true,
        "config": {
          "host": "localhost",
          "port": 8123,
          "username": "default",
          "password": "",
          "database": "default",
          "secure": false,
          "readonly": true
        }
      }
    }
  }
}
```

### Configuration Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `host` | string | **required** | ClickHouse server host |
| `port` | number | `8123` | Server port (8123 HTTP, 8443 HTTPS) |
| `username` | string | `"default"` | Database username |
| `password` | string | `""` | Database password |
| `database` | string | `"default"` | Default database |
| `secure` | boolean | `false` | Use HTTPS connection |
| `readonly` | boolean | `true` | Enable read-only mode |
| `allowedOperations` | string[] | all | Restrict to specific operations |
| `queryTimeout` | number | `30000` | Query timeout in milliseconds |

### Allowed Operations

You can restrict which operations are available:

- `"select"` - Execute SELECT queries
- `"insert"` - Insert data (requires `readonly: false`)
- `"listDatabases"` - List all databases
- `"listTables"` - List tables in a database
- `"describeTable"` - Get table schema

Example restricting to read-only exploration:

```json
{
  "config": {
    "host": "localhost",
    "readonly": true,
    "allowedOperations": ["listDatabases", "listTables", "describeTable"]
  }
}
```

## Available Tools

### `clickhouse_list_databases`

List all available databases on the server.

**Input:** None required

**Output:**
```json
{
  "databases": ["default", "system", "mydb"],
  "count": 3
}
```

### `clickhouse_list_tables`

List tables in a database with metadata.

**Input:**
- `database` (optional): Database name, defaults to configured database
- `like` (optional): LIKE pattern to filter tables (e.g., `%logs%`)

**Output:**
```json
{
  "database": "default",
  "tables": [
    {
      "name": "events",
      "engine": "MergeTree",
      "total_rows": "1000000",
      "total_bytes": "52428800"
    }
  ],
  "count": 1
}
```

### `clickhouse_describe_table`

Get the schema of a table.

**Input:**
- `table` (required): Table name
- `database` (optional): Database name

**Output:**
```json
{
  "database": "default",
  "table": "events",
  "columns": [
    {
      "name": "id",
      "type": "UInt64",
      "is_primary_key": true,
      "is_sorting_key": true
    },
    {
      "name": "event_time",
      "type": "DateTime",
      "is_partition_key": true
    }
  ],
  "column_count": 2
}
```

### `clickhouse_run_query`

Execute a SQL query. Only SELECT queries are allowed in readonly mode.

**Input:**
- `query` (required): SQL query to execute
- `database` (optional): Database context

**Output:**
```json
{
  "data": [
    {"version()": "24.1.1.1"}
  ],
  "rows": 1,
  "statistics": {
    "elapsed": 0.001,
    "rows_read": 1,
    "bytes_read": 8
  }
}
```

### `clickhouse_insert`

Insert data into a table. Only available when `readonly: false`.

**Input:**
- `table` (required): Target table name
- `data` (required): Array of objects to insert
- `database` (optional): Database name

**Output:**
```json
{
  "success": true,
  "table": "events",
  "database": "default",
  "rows_inserted": 10
}
```

## Examples

### Basic Read-Only Setup

```json
{
  "plugins": {
    "entries": {
      "clickhouse": {
        "enabled": true,
        "config": {
          "host": "localhost",
          "readonly": true
        }
      }
    }
  }
}
```

Prompt your agent:
- "List all databases in ClickHouse"
- "What tables are in the system database?"
- "Describe the query_log table"
- "Show me the last 10 queries from system.query_log"

### Production with HTTPS

```json
{
  "config": {
    "host": "clickhouse.example.com",
    "port": 8443,
    "username": "analyst",
    "password": "secret",
    "database": "analytics",
    "secure": true,
    "readonly": true,
    "queryTimeout": 60000
  }
}
```

### Write-Enabled for ETL

```json
{
  "config": {
    "host": "localhost",
    "readonly": false,
    "allowedOperations": ["select", "insert", "listTables", "describeTable"]
  }
}
```

## Local Development

```bash
# Clone the repository
git clone https://github.com/unsanction/openclaw-clickhouse.git
cd openclaw-clickhouse

# Install dependencies
npm install

# Build
npm run build

# Start ClickHouse for testing
docker run -d -p 8123:8123 -p 9000:9000 clickhouse/clickhouse-server

# Install locally
openclaw plugins install -l .

# Verify
openclaw plugins list
```

## Security Considerations

1. **Use readonly mode** in production to prevent accidental data modification
2. **Restrict allowedOperations** to only what the agent needs
3. **Use a dedicated read-only user** in ClickHouse for additional safety
4. **Set appropriate queryTimeout** to prevent long-running queries
5. **Use HTTPS** (`secure: true`) when connecting over networks

## License

MIT
