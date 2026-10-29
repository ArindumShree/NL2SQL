"""
NL2SQL MCP Server
-----------------
Exposes two MCP tools:
  1. get_schema         – returns table/column/type metadata for all Northwind tables
  2. execute_query      – executes a READ-ONLY SQL query with injection prevention

Security measures:
  - Only SELECT statements allowed (whitelist)
  - sqlparse-based statement validation
  - Query length cap
  - No multiple statements (semicolon injection)
  - Runs queries with a read-only transaction
"""

import asyncio
import logging
import os
import re
from typing import Any

import asyncpg
import sqlparse
from dotenv import load_dotenv
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nl2sql-mcp")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://northwind:northwind@postgres:5432/northwind",
)

# ---------------------------------------------------------------------------
# Security helpers
# ---------------------------------------------------------------------------

ALLOWED_STATEMENT_TYPES = {"SELECT"}
MAX_QUERY_LENGTH = 4000

# Tables that exist in the Northwind schema (allowlist for schema introspection)
NORTHWIND_TABLES = {
    "categories",
    "customer_customer_demo",
    "customer_demographics",
    "customers",
    "employees",
    "employee_territories",
    "order_details",
    "orders",
    "products",
    "region",
    "shippers",
    "suppliers",
    "territories",
    "us_states",
}


def validate_sql(query: str) -> tuple[bool, str]:
    """
    Returns (is_valid, reason).
    Validates that the query is a single, safe SELECT statement.
    """
    query = query.strip()

    if not query:
        return False, "Empty query."

    if len(query) > MAX_QUERY_LENGTH:
        return False, f"Query too long (max {MAX_QUERY_LENGTH} chars)."

    # Parse with sqlparse
    parsed = sqlparse.parse(query)
    if len(parsed) != 1:
        return False, "Only a single SQL statement is allowed."

    statement = parsed[0]
    stmt_type = statement.get_type()

    if stmt_type not in ALLOWED_STATEMENT_TYPES:
        return False, f"Only SELECT statements are allowed. Got: {stmt_type or 'UNKNOWN'}."

    # Reject dangerous keywords even inside SELECT (e.g. stored-proc calls)
    lowered = query.lower()
    dangerous_patterns = [
        r"\bexec\b",
        r"\bexecute\b",
        r"\bdrop\b",
        r"\btruncate\b",
        r"\binsert\b",
        r"\bupdate\b",
        r"\bdelete\b",
        r"\balter\b",
        r"\bcreate\b",
        r"\bgrant\b",
        r"\brevoke\b",
        r"\bpg_sleep\b",
        r"\bcopy\b",
        r"--",          # inline comment used for injection
        r"/\*",         # block comment
    ]
    for pattern in dangerous_patterns:
        if re.search(pattern, lowered):
            return False, f"Query contains disallowed keyword/pattern: '{pattern}'."

    return True, "OK"


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    return _pool


async def fetch_schema() -> dict[str, Any]:
    """
    Returns a structured dict: { table_name: [ {column, type, nullable, pk}, ... ] }
    Covers only the tables we care about.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                t.table_name,
                c.column_name,
                c.data_type,
                c.is_nullable,
                CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key
            FROM information_schema.tables t
            JOIN information_schema.columns c
                ON t.table_name = c.table_name AND t.table_schema = c.table_schema
            LEFT JOIN (
                SELECT ku.table_name, ku.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage ku
                    ON tc.constraint_name = ku.constraint_name
                    AND tc.table_schema = ku.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_schema = 'public'
            ) pk ON pk.table_name = c.table_name AND pk.column_name = c.column_name
            WHERE t.table_schema = 'public'
              AND t.table_type = 'BASE TABLE'
            ORDER BY t.table_name, c.ordinal_position
            """
        )

    schema: dict[str, list[dict]] = {}
    for row in rows:
        tbl = row["table_name"]
        if tbl not in schema:
            schema[tbl] = []
        schema[tbl].append(
            {
                "column": row["column_name"],
                "type": row["data_type"],
                "nullable": row["is_nullable"] == "YES",
                "primary_key": row["is_primary_key"],
            }
        )
    return schema


async def run_query(sql: str) -> dict[str, Any]:
    """
    Runs the validated SELECT query inside a read-only transaction.
    Returns { columns: [...], rows: [[...], ...], row_count: int }
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction(readonly=True):
            try:
                records = await conn.fetch(sql)
            except asyncpg.PostgresError as exc:
                return {"error": str(exc)}

    if not records:
        return {"columns": [], "rows": [], "row_count": 0}

    columns = list(records[0].keys())
    rows = [
        [str(v) if v is not None else None for v in record.values()]
        for record in records
    ]
    return {"columns": columns, "rows": rows, "row_count": len(rows)}


# ---------------------------------------------------------------------------
# MCP Server definition
# ---------------------------------------------------------------------------

server = Server("nl2sql-mcp")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="get_schema",
            description=(
                "Returns the full database schema for the Northwind ERP dataset. "
                "Call this BEFORE generating any SQL to understand available tables, "
                "columns, data types, and primary keys. "
                "Returns: { table_name: [ { column, type, nullable, primary_key } ] }"
            ),
            inputSchema={
                "type": "object",
                "properties": {},
                "required": [],
            },
        ),
        Tool(
            name="execute_query",
            description=(
                "Executes a READ-ONLY SQL SELECT query against the Northwind PostgreSQL database. "
                "Only SELECT statements are permitted. "
                "Returns: { columns: [str], rows: [[values]], row_count: int } "
                "or { error: str } on failure."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "sql": {
                        "type": "string",
                        "description": "A valid PostgreSQL SELECT statement.",
                    }
                },
                "required": ["sql"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    import json

    if name == "get_schema":
        logger.info("Tool called: get_schema")
        try:
            schema = await fetch_schema()
            return [TextContent(type="text", text=json.dumps(schema, indent=2))]
        except Exception as exc:
            logger.error("get_schema failed: %s", exc)
            return [TextContent(type="text", text=json.dumps({"error": str(exc)}))]

    elif name == "execute_query":
        sql = arguments.get("sql", "").strip()
        logger.info("Tool called: execute_query | SQL: %s", sql[:200])

        valid, reason = validate_sql(sql)
        if not valid:
            result = {"error": f"Query rejected by security validator: {reason}"}
            return [TextContent(type="text", text=json.dumps(result))]

        try:
            result = await run_query(sql)
        except Exception as exc:
            logger.error("execute_query failed: %s", exc)
            result = {"error": str(exc)}

        return [TextContent(type="text", text=json.dumps(result, default=str))]

    else:
        return [TextContent(type="text", text=json.dumps({"error": f"Unknown tool: {name}"}))]


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main():
    logger.info("Starting NL2SQL MCP server (stdio transport)...")
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
