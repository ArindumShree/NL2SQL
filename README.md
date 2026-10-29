# NL2SQL — Natural Language Database Query Interface

Ask questions in plain English, get structured results from a PostgreSQL database — powered by **Google Gemini**, the **Model Context Protocol (MCP)**, and the **Northwind ERP dataset**.

---

## Architecture

```
Browser (React + Vite, served via Nginx)
     │  POST /chat/stream { question, history }  (SSE)
     ▼
FastAPI Backend
     │  Spawns MCP stdio subprocess per request
     ▼
MCP Server (Python)   ◄──► PostgreSQL (Northwind)
     │  get_schema tool
     │  execute_query tool
     ▼
Google Gemini 2.5 Flash
  (MCP client, function-calling)
```

**Request flow:**

1. User types a natural-language question in the React chat UI.
2. Frontend calls `POST /chat/stream` (SSE) with the question plus recent conversation history.
3. Backend spawns the MCP server as a stdio subprocess and opens a `ClientSession` for this request.
4. Gemini is given the two MCP tools as function declarations and runs in a tool-calling loop.
5. Gemini calls **`get_schema`** → MCP server queries `information_schema` and returns the full Northwind schema.
6. Gemini generates a SELECT statement and calls **`execute_query`** with it.
7. MCP server validates the SQL (whitelist + injection checks) and runs it read-only.
8. Once Gemini stops requesting tools, the backend streams progress events (schema → query → execute → insight) over SSE, followed by the final answer, the SQL used, and the result rows.
9. React renders the answer as a chat message with a sortable/filterable results table; the SQL is shown via a collapsible panel. Three AI-generated follow-up questions are included with the response.

> A legacy `POST /query` endpoint (single-turn, no streaming, no history) is also available for compatibility, but the chat UI uses `/chat/stream` exclusively.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Database | PostgreSQL 16 + Northwind ERP dataset |
| MCP Server | Python 3.11, `mcp` SDK, `asyncpg`, `sqlparse` |
| AI Engine | Google Gemini 2.5 Flash (via `google-genai`) |
| Backend API | FastAPI + Uvicorn |
| Frontend | React 18, Vite, Tailwind CSS, Axios |
| Orchestration | Docker Compose (Postgres + FastAPI backend + Nginx-served frontend) |

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/install/) v2+
- A **Google Gemini API key** — get one free at [aistudio.google.com](https://aistudio.google.com/app/apikey)

---

## Setup & Running

### 1. Clone / unpack the project

```bash
git clone <your-repo-url>
cd nl2sql
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and set:

```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

Everything else has working defaults.

### 3. Start all services

```bash
docker compose up --build
```

First run downloads ~500 MB of images and seeds the Northwind database. Subsequent starts are fast.

### 4. Open the app

| Service | URL |
|---------|-----|
| Frontend (React UI) | http://localhost:3000 |
| Backend API (FastAPI docs) | http://localhost:8000/docs |
| PostgreSQL | localhost:5433 (user: `northwind`, pass: `northwind`) — mapped from container port 5432 |

### 5. Tear down

```bash
docker compose down            # stop containers
docker compose down -v         # also delete the postgres volume
```

---

## MCP Tool Definitions

The MCP server (`mcp_server/server.py`) exposes two tools:

### Tool 1: `get_schema`

| Property | Value |
|----------|-------|
| Name | `get_schema` |
| Transport | stdio |
| Description | Returns full database schema for all Northwind tables — table names, column names, data types, nullability, and primary key flags. Must be called before generating SQL. |

**Input schema:**
```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```

**Output schema:**
```json
{
  "table_name": [
    {
      "column": "string",
      "type": "string",
      "nullable": "boolean",
      "primary_key": "boolean"
    }
  ]
}
```

**Example output (excerpt):**
```json
{
  "orders": [
    { "column": "order_id",    "type": "smallint", "nullable": false, "primary_key": true },
    { "column": "customer_id", "type": "character varying", "nullable": true, "primary_key": false },
    { "column": "order_date",  "type": "date", "nullable": true, "primary_key": false }
  ]
}
```

---

### Tool 2: `execute_query`

| Property | Value |
|----------|-------|
| Name | `execute_query` |
| Transport | stdio |
| Description | Executes a read-only PostgreSQL SELECT query. Rejects non-SELECT statements and dangerous patterns. Runs in a read-only transaction. |

**Input schema:**
```json
{
  "type": "object",
  "properties": {
    "sql": {
      "type": "string",
      "description": "A valid PostgreSQL SELECT statement."
    }
  },
  "required": ["sql"]
}
```

**Success output:**
```json
{
  "columns": ["order_id", "customer_id", "total"],
  "rows": [["10248", "VINET", "440.00"], ["10249", "TOMSP", "1863.40"]],
  "row_count": 2
}
```

**Error output:**
```json
{
  "error": "Query rejected by security validator: Only SELECT statements are allowed. Got: DROP."
}
```

**Security validations applied:**
- Statement type must be `SELECT` (via `sqlparse`)
- Single statement only (no `;` chaining)
- Max query length: 4,000 characters
- Blocked patterns: `DROP`, `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `CREATE`, `GRANT`, `REVOKE`, `EXEC`, `pg_sleep`, `COPY`, `--` (inline comments), `/*` (block comments)
- Executed inside a `BEGIN READ ONLY` transaction

---

## Northwind Schema Overview

| Table | Description |
|-------|-------------|
| `customers` | Customer company names, contacts, countries |
| `orders` | Order headers — dates, ship info, customer |
| `order_details` | Line items — product, quantity, unit price, discount |
| `products` | Product catalogue with pricing and stock levels |
| `categories` | Product category groupings |
| `employees` | Staff records with hierarchy (reports_to) |
| `suppliers` | Supplier company info |
| `shippers` | Shipping companies |
| `territories` / `region` | Sales territory hierarchy |

---

## Example Queries to Try

| Natural language | What it does |
|-----------------|--------------|
| Show me the top 10 customers by total order value | JOIN customers + orders + order_details, aggregate |
| Which products are below reorder level? | Filter products table |
| List all orders shipped to Germany in 1997 | Filter orders by ship_country and year |
| Who are the top 5 employees by revenue generated? | JOIN employees + orders + order_details |
| What is the average order value by country? | GROUP BY + AVG |
| Show me all discontinued products | Filter products.discontinued |

---

## Development

### Running services individually (without Docker)

**Database** (if running Postgres outside Docker entirely):
```bash
psql -U northwind -d northwind -f db/northwind.sql
```
If instead you want to connect to the *Dockerized* Postgres from your host (e.g. with a GUI client or `psql`), use the mapped host port:
```bash
psql -h localhost -p 5433 -U northwind -d northwind
```

**MCP Server:**
```bash
cd mcp_server
pip install -r requirements.txt
DATABASE_URL=postgresql://northwind:northwind@localhost:5433/northwind python server.py
```

**Backend:**
```bash
cd backend
pip install -r requirements.txt
GEMINI_API_KEY=... DATABASE_URL=postgresql://northwind:northwind@localhost:5433/northwind MCP_SERVER_SCRIPT=../mcp_server/server.py uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

---

## Functional Requirements Coverage

| ID | Requirement | Status |
|----|-------------|--------|
| FR-01 | Plain English → DB results | ✅ Gemini translates NL to SQL |
| FR-02 | AI uses MCP schema introspection before SQL | ✅ System prompt enforces `get_schema` first |
| FR-03 | AI issues query via MCP `execute_query` | ✅ No direct DB access from AI layer |
| FR-04 | Structured tabular results | ✅ React sortable/filterable table |
| FR-05 | Graceful error handling | ✅ Error states in UI + categorized backend error messages |
| FR-06 | Generated SQL optionally visible | ✅ Collapsible SQL panel with copy button |
| FR-07 | Multi-session chat history | ✅ Persisted client-side (localStorage), sidebar with rename/delete |
| FR-08 | Filtering/sorting of results | ✅ Client-side sortable/filterable results table, CSV export |
| FR-09 | Live progress feedback | ✅ SSE-streamed step indicator instead of a blank spinner |
| FR-10 | Schema exploration | ✅ Dedicated schema explorer panel (`GET /schema`) |

---

## Troubleshooting

**`GEMINI_API_KEY` errors:** Ensure your key is set in `.env` and not the example file.

**Backend can't reach postgres:** Wait ~10 seconds after `docker compose up` for PostgreSQL to finish seeding. The backend has a health-check dependency.

**`execute_query` rejected:** The MCP security layer blocked a non-SELECT statement. This is expected for DDL/DML.

**Slow first query:** Gemini cold-start + MCP subprocess spawn can take 5–10 seconds on the first request. Subsequent requests are faster.

**Frontend can't reach the backend on a remote deployment:** Confirm `VITE_API_URL` (not `REACT_APP_API_URL`) is set correctly at build time — Vite bakes this in when the image is built, so changing `.env` alone after the fact requires a rebuild (`docker compose build frontend`), not just a restart.

**Port conflicts:** Change `"3000:3000"` / `"8000:8000"` / `"5433:5432"` in `docker-compose.yml` if those ports are in use.