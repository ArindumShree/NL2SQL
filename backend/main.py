"""
NL2SQL Backend API  (Chat Edition — Production)
------------------------------------------------
REST API that:
  1. Accepts a conversation history + new question from the frontend
  2. Spins up an MCP client session to the MCP server (stdio subprocess)
  3. Uses Google Gemini (function-calling mode) as the AI engine via google-genai SDK
  4. Returns structured results + generated SQL + 3 follow-up suggestions to the frontend
  5. Supports SSE streaming via /chat/stream for real-time progress feedback

Endpoints:
  POST /query        – legacy single-turn NL->SQL->results pipeline
  POST /chat         – multi-turn chatbot pipeline with history + follow-up suggestions
  POST /chat/stream  – same as /chat but streams SSE progress events
  GET  /schema       – returns full Northwind schema for the frontend explorer
  GET  /health       – liveness check
  GET  /metrics      – request counters and average response times
"""

import asyncio
import json
import logging
import os
import re
import time
import uuid
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from google import genai
from google.genai import types as gtypes
from google.genai.errors import ServerError, ClientError
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from pydantic import BaseModel

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nl2sql-backend")

GEMINI_API_KEY   = os.getenv("GEMINI_API_KEY", "")
MCP_SERVER_CMD   = os.getenv("MCP_SERVER_CMD", "python")
MCP_SERVER_SCRIPT = os.getenv("MCP_SERVER_SCRIPT", "/mcp_server/server.py")
DATABASE_URL     = os.getenv(
    "DATABASE_URL",
    "postgresql://northwind:northwind@postgres:5432/northwind",
)

GEMINI_MAX_RETRIES    = 3
GEMINI_RETRY_BASE_DELAY = 2.0

if not GEMINI_API_KEY:
    logger.warning("GEMINI_API_KEY not set – /query and /chat will fail at runtime")

# ---------------------------------------------------------------------------
# Module-level metrics counters
# ---------------------------------------------------------------------------

_metrics: dict[str, int | float] = {
    "total_requests": 0,
    "total_response_time_ms": 0.0,
    "errors": 0,
}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class QueryRequest(BaseModel):
    question: str
    max_rows: int = 500


class QueryResponse(BaseModel):
    question: str
    sql: str
    columns: list[str]
    rows: list[list[Any]]
    row_count: int
    error: str | None = None


class ChatMessage(BaseModel):
    role: str      # "user" | "assistant"
    content: str   # plain-text summary / question


class ChatRequest(BaseModel):
    history: list[ChatMessage] = []
    question: str
    max_rows: int = 500


class ChatResponse(BaseModel):
    question: str
    sql: str
    columns: list[str]
    rows: list[list[Any]]
    row_count: int
    model_text: str
    follow_ups: list[str]
    error: str | None = None


# ---------------------------------------------------------------------------
# Gemini helpers
# ---------------------------------------------------------------------------

def build_system_prompt(max_rows: int) -> str:
    return f"""You are QueryMind, an expert data analyst assistant embedded in a Northwind ERP intelligence platform. You communicate like a senior analyst presenting findings to a non-technical business stakeholder: clear, confident, structured, and insight-driven.

WORKFLOW (mandatory — follow exactly):
1. Call get_schema to inspect the live database schema.
2. Construct a precise PostgreSQL SELECT query based on the user's question and conversation context.
3. Call execute_query with your SQL. The system caps results at {max_rows} rows — do NOT add a LIMIT unless the user asks for a specific count.
4. After receiving results, compose your response following the RESPONSE FORMAT below.

SQL RULES:
- Use only SELECT. Never INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or any DDL.
- Use proper JOINs based on actual column names discovered from get_schema.
- Use double-quotes for identifiers only when necessary (mixed case, reserved words).
- If a question is ambiguous, make the most reasonable business interpretation and state your assumption.
- If a question truly cannot be answered from the schema, explain why clearly — do not fabricate data.

RESPONSE FORMAT — every answer must follow this structure:

**[One-line direct answer to the question]**

[2–4 sentences of natural English explanation. Write like you are briefing a manager. No jargon. No mention of SQL, tables, or JOIN — just business meaning. Example: "Across the 91 customers in the database, QUICK-Stop in Germany leads with $110,277 in total order value, nearly double the second-ranked customer."]

**Key findings:**
- [Specific insight with a number] — [what it means in plain English]
- [Specific insight with a number] — [what it means in plain English]
- [Add a third finding if the data supports it]

**What to watch:** [One actionable observation or anomaly the data reveals. Keep it to 1–2 sentences.]

STRICT FORMATTING RULES:
- Use **bold** only for the direct-answer headline and section labels.
- Use plain bullet points (- ) for key findings. No nested bullets.
- Never use raw asterisks as decoration. Never output JSON. Never show SQL in your text response.
- Never start a sentence with "I" or "The data shows". Be direct: "Revenue peaked in Q4..." not "I can see that revenue peaked..."
- Numbers should always be formatted: $1,234.56 not 1234.5678. Percentages to one decimal: 34.7%.
- If results are empty, say so plainly: "No orders match that filter in the current dataset."
- Keep the total response under 250 words. Concise is professional.
"""


def compact_history_for_prompt(history: list[ChatMessage] | None, limit: int = 6) -> str:
    if not history:
        return "No prior conversation."

    lines = []
    for msg in history[-limit:]:
        role = "User" if msg.role == "user" else "Assistant"
        content = re.sub(r"\s+", " ", msg.content).strip()
        if len(content) > 220:
            content = content[:217] + "..."
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


def build_followup_prompt(
    question: str,
    sql: str,
    columns: list[str],
    row_sample: list,
    prior_history: list[ChatMessage] | None = None,
) -> str:
    col_preview = ", ".join(columns[:8])
    row_preview = str(row_sample[:3])
    return f"""You are a data analyst suggesting follow-up questions to a business user who just queried the Northwind ERP database.

Recent conversation:
{compact_history_for_prompt(prior_history)}

Original question: "{question}"
SQL generated: {sql}
Result columns: {col_preview}
Sample data: {row_preview}

Generate exactly 3 follow-up questions that:
1. Directly build on the user's current question and recent conversation context
2. Reveal a business insight not yet surfaced (e.g., trend over time, comparison, breakdown)
3. Suggest an actionable next step (e.g., "Which of these have declined vs last year?")

Rules:
- Each question must be specific and answerable from the Northwind schema
- Maximum 12 words per question
- Do NOT repeat the original question
- Do NOT repeat earlier user questions from the recent conversation
- Start each question with a strong action verb: "Show", "Compare", "Break down", "Which", "How many", "What percentage"
- Return ONLY a JSON array of 3 strings. No markdown. No preamble. No trailing text.

Example output: ["Show monthly revenue trend for the top 3 customers", "Which product categories drive the most orders?", "Compare this year's order volume to last year"]"""


def parse_followup_response(raw: str) -> list[str] | None:
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\[[\s\S]*\]", raw)
        if not match:
            return None
        try:
            parsed = json.loads(match.group(0))
        except json.JSONDecodeError:
            return None

    if not isinstance(parsed, list):
        return None

    suggestions = []
    seen = set()
    for item in parsed:
        suggestion = re.sub(r"\s+", " ", str(item)).strip().strip('"')
        if not suggestion:
            continue
        key = suggestion.casefold()
        if key in seen:
            continue
        seen.add(key)
        suggestions.append(suggestion)
    return suggestions[:3] if len(suggestions) >= 3 else None


def contextual_followup_fallback(
    question: str,
    columns: list[str],
    rows: list,
    prior_history: list[ChatMessage] | None = None,
) -> list[str]:
    text = " ".join(
        [question] + [m.content for m in (prior_history or [])[-4:] if m.role == "user"]
    ).lower()
    column_text = " ".join(columns).lower()

    suggestions: list[str] = []

    def add(value: str):
        if value.casefold() not in {s.casefold() for s in suggestions}:
            suggestions.append(value)

    if any(word in text or word in column_text for word in ["customer", "client", "company"]):
        add("Show monthly orders for these customers")
        add("Break down revenue by customer country")
    if any(word in text or word in column_text for word in ["product", "category", "stock", "inventory"]):
        add("Compare product revenue by category")
        add("Which products need inventory attention")
    if any(word in text or word in column_text for word in ["employee", "salesperson", "staff"]):
        add("Compare employee revenue by quarter")
        add("Show each employee's strongest customer segment")
    if any(word in text or word in column_text for word in ["order", "ship", "freight"]):
        add("Break down orders by shipping country")
        add("Show late shipments by month")
    if any(word in text or word in column_text for word in ["revenue", "sales", "value", "total", "amount", "price"]):
        add("Compare revenue trend by month")
        add("Which records contribute most to the total")

    if rows:
        add("Show the top contributors in this result")
    add("Break this result down by month")
    add("Compare this result across countries")
    add("Which related records changed the most")

    return suggestions[:3]


def mcp_tools_to_gemini(mcp_tools) -> list[gtypes.Tool]:
    """Convert MCP tool definitions to Gemini Tool objects."""
    declarations = []
    for tool in mcp_tools:
        props = {}
        schema = tool.inputSchema or {}
        for prop_name, prop_def in (schema.get("properties") or {}).items():
            props[prop_name] = gtypes.Schema(
                type=prop_def.get("type", "string").upper(),
                description=prop_def.get("description", ""),
            )
        declarations.append(
            gtypes.FunctionDeclaration(
                name=tool.name,
                description=tool.description,
                parameters=gtypes.Schema(
                    type="OBJECT",
                    properties=props,
                    required=schema.get("required", []),
                ) if props else gtypes.Schema(type="OBJECT"),
            )
        )
    return [gtypes.Tool(function_declarations=declarations)]


# ---------------------------------------------------------------------------
# Gemini call with retry on 503 / 429
# ---------------------------------------------------------------------------

def gemini_generate_with_retry(client, model, contents, config):
    delay = GEMINI_RETRY_BASE_DELAY
    for attempt in range(1, GEMINI_MAX_RETRIES + 1):
        try:
            return client.models.generate_content(
                model=model,
                contents=contents,
                config=config,
            )
        except (ServerError, ClientError) as exc:
            err_str = str(exc)
            is_503 = "503" in err_str or "UNAVAILABLE" in err_str
            is_429 = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str

            if (is_503 or is_429) and attempt < GEMINI_MAX_RETRIES:
                retry_delay = delay
                match = re.search(r"retry in (\d+(?:\.\d+)?)s", err_str)
                if match:
                    retry_delay = float(match.group(1)) + 1
                logger.warning(
                    "Gemini %s on attempt %d/%d — retrying in %.0fs...",
                    "429 rate-limit" if is_429 else "503 overload",
                    attempt, GEMINI_MAX_RETRIES, retry_delay,
                )
                time.sleep(retry_delay)
                delay *= 2
            else:
                raise


# ---------------------------------------------------------------------------
# Follow-up suggestion generator
# ---------------------------------------------------------------------------

async def generate_follow_ups(
    client,
    question: str,
    sql: str,
    columns: list[str],
    rows: list,
    prior_history: list[ChatMessage] | None = None,
) -> list[str]:
    """Returns 3 follow-up question strings, with history-aware fallback."""
    try:
        prompt = build_followup_prompt(question, sql, columns, rows, prior_history)
        response = await asyncio.to_thread(
            gemini_generate_with_retry,
            client,
            "gemini-2.5-flash",
            [gtypes.Content(role="user", parts=[gtypes.Part.from_text(text=prompt)])],
            gtypes.GenerateContentConfig(max_output_tokens=256),
        )
        suggestions = parse_followup_response(response.text)
        if suggestions:
            return suggestions
    except Exception as exc:
        logger.warning("follow-up generation failed: %s", exc)

    return contextual_followup_fallback(question, columns, rows, prior_history)


# ---------------------------------------------------------------------------
# MCP pipeline (shared by /query, /chat, /chat/stream)
# ---------------------------------------------------------------------------

async def run_mcp_pipeline(
    question: str,
    max_rows: int,
    prior_history: list[ChatMessage] | None = None,
) -> dict:
    server_params = StdioServerParameters(
        command=MCP_SERVER_CMD,
        args=[MCP_SERVER_SCRIPT],
        env={
            "DATABASE_URL": DATABASE_URL,
            "PYTHONUNBUFFERED": "1",
        },
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            mcp_tools_result = await session.list_tools()
            gemini_tools = mcp_tools_to_gemini(mcp_tools_result.tools)

            client = genai.Client(api_key=GEMINI_API_KEY)
            config = gtypes.GenerateContentConfig(
                system_instruction=build_system_prompt(max_rows),
                tools=gemini_tools,
            )

            history: list[gtypes.Content] = []
            if prior_history:
                for msg in prior_history:
                    role = "user" if msg.role == "user" else "model"
                    history.append(
                        gtypes.Content(
                            role=role,
                            parts=[gtypes.Part.from_text(text=msg.content)],
                        )
                    )

            history.append(
                gtypes.Content(
                    role="user",
                    parts=[gtypes.Part.from_text(text=question)],
                )
            )

            generated_sql = ""
            final_result: dict = {}
            response = None

            for _ in range(10):
                response = await asyncio.to_thread(
                    gemini_generate_with_retry,
                    client,
                    "gemini-2.5-flash",
                    history,
                    config,
                )

                history.append(response.candidates[0].content)

                fn_calls = [
                    part.function_call
                    for part in response.candidates[0].content.parts
                    if part.function_call is not None
                ]

                if not fn_calls:
                    break

                tool_response_parts = []
                for fc in fn_calls:
                    tool_name = fc.name
                    tool_args = dict(fc.args) if fc.args else {}

                    logger.info("Gemini → tool: %s | args: %s", tool_name, str(tool_args)[:300])

                    mcp_result = await session.call_tool(tool_name, tool_args)
                    result_text = (
                        mcp_result.content[0].text if mcp_result.content else "{}"
                    )
                    result_data = json.loads(result_text)

                    if tool_name == "execute_query":
                        generated_sql = tool_args.get("sql", "")
                        final_result = result_data

                    tool_response_parts.append(
                        gtypes.Part.from_function_response(
                            name=tool_name,
                            response={"result": result_data},
                        )
                    )

                history.append(
                    gtypes.Content(role="user", parts=tool_response_parts)
                )

            model_text = ""
            if response:
                try:
                    model_text = response.text
                except Exception:
                    for part in response.candidates[0].content.parts:
                        if hasattr(part, "text") and part.text:
                            model_text += part.text

            return {
                "sql": generated_sql,
                "result": final_result,
                "model_text": model_text,
                "gemini_client": client,
            }


# ---------------------------------------------------------------------------
# Error categorization helper
# ---------------------------------------------------------------------------

def categorize_error(exc: Exception) -> str:
    err = str(exc)
    if "GEMINI" in err or "google" in err.lower() or "gemini" in err.lower():
        return "The AI service is temporarily unavailable. Please try again in a moment."
    elif "asyncpg" in err or "postgres" in err.lower() or "psycopg" in err.lower():
        return "Could not connect to the database. Check that PostgreSQL is running."
    elif "mcp" in err.lower():
        return "The database tool server encountered an error. The query may be too complex."
    elif "timeout" in err.lower():
        return "Query timed out after 90 seconds. Try a more specific question."
    else:
        return f"Unexpected error: {err}"


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="NL2SQL Chat API",
    description="Natural Language to SQL via MCP + Gemini — Chat Edition",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Middleware: Cache-Control + request timing
# ---------------------------------------------------------------------------

@app.middleware("http")
async def add_cache_and_timing(request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed_ms = (time.time() - start) * 1000
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Response-Time-Ms"] = f"{elapsed_ms:.1f}"
    return response


# ---------------------------------------------------------------------------
# Health + Metrics
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "service": "nl2sql-backend"}


@app.get("/metrics")
async def metrics():
    total = _metrics["total_requests"]
    avg_ms = (
        _metrics["total_response_time_ms"] / total if total > 0 else 0.0
    )
    return {
        "total_requests": total,
        "avg_response_time_ms": round(avg_ms, 1),
        "errors": _metrics["errors"],
    }


# ---------------------------------------------------------------------------
# Schema endpoint — used by SchemaPanel.jsx
# ---------------------------------------------------------------------------

@app.get("/schema")
async def get_full_schema():
    """Returns the full Northwind schema for the frontend explorer."""
    server_params = StdioServerParameters(
        command=MCP_SERVER_CMD,
        args=[MCP_SERVER_SCRIPT],
        env={"DATABASE_URL": DATABASE_URL, "PYTHONUNBUFFERED": "1"},
    )
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool("get_schema", {})
            raw = result.content[0].text if result.content else "{}"
            return JSONResponse(content=json.loads(raw))


# ---------------------------------------------------------------------------
# Legacy single-turn endpoint
# ---------------------------------------------------------------------------

@app.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    req_id = str(uuid.uuid4())[:8]
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    if len(question) > 1000:
        raise HTTPException(status_code=400, detail="Question too long (max 1000 chars).")

    _metrics["total_requests"] += 1
    t0 = time.time()
    logger.info("[%s] /query: %s", req_id, question)

    try:
        pipeline_result = await asyncio.wait_for(
            run_mcp_pipeline(question, request.max_rows),
            timeout=90.0,
        )
    except asyncio.TimeoutError:
        _metrics["errors"] += 1
        raise HTTPException(status_code=504, detail="Query timed out after 90 seconds. Try a more specific question.")
    except Exception as exc:
        _metrics["errors"] += 1
        logger.error("[%s] Pipeline error: %s", req_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail=categorize_error(exc))
    finally:
        elapsed_ms = (time.time() - t0) * 1000
        _metrics["total_response_time_ms"] += elapsed_ms
        logger.info("[%s] /query completed in %.0fms", req_id, elapsed_ms)

    sql = pipeline_result.get("sql", "")
    result = pipeline_result.get("result", {})

    if "error" in result and result["error"]:
        return QueryResponse(question=question, sql=sql, columns=[], rows=[], row_count=0, error=result["error"])

    columns = result.get("columns", [])
    rows = result.get("rows", [])
    row_count = result.get("row_count", len(rows))

    if len(rows) > request.max_rows:
        rows = rows[: request.max_rows]
        row_count = len(rows)

    if not columns and not sql:
        return QueryResponse(
            question=question, sql="", columns=[], rows=[], row_count=0,
            error=pipeline_result.get("model_text") or "Could not generate a query for that question.",
        )

    return QueryResponse(question=question, sql=sql, columns=columns, rows=rows, row_count=row_count, error=None)


# ---------------------------------------------------------------------------
# Multi-turn chat endpoint (non-streaming)
# ---------------------------------------------------------------------------

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    req_id = str(uuid.uuid4())[:8]
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    if len(question) > 1000:
        raise HTTPException(status_code=400, detail="Question too long (max 1000 chars).")

    trimmed_history = request.history[-10:] if request.history else []
    _metrics["total_requests"] += 1
    t0 = time.time()
    logger.info("[%s] /chat: %s | history turns: %d", req_id, question, len(trimmed_history))

    try:
        pipeline_result = await asyncio.wait_for(
            run_mcp_pipeline(question, request.max_rows, prior_history=trimmed_history),
            timeout=90.0,
        )
    except asyncio.TimeoutError:
        _metrics["errors"] += 1
        raise HTTPException(status_code=504, detail="Query timed out after 90 seconds. Try a more specific question.")
    except Exception as exc:
        _metrics["errors"] += 1
        logger.error("[%s] Chat pipeline error: %s", req_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail=categorize_error(exc))
    finally:
        elapsed_ms = (time.time() - t0) * 1000
        _metrics["total_response_time_ms"] += elapsed_ms
        logger.info("[%s] /chat completed in %.0fms", req_id, elapsed_ms)

    sql = pipeline_result.get("sql", "")
    result = pipeline_result.get("result", {})
    model_text = pipeline_result.get("model_text", "")
    gemini_client = pipeline_result.get("gemini_client")

    if "error" in result and result["error"]:
        return ChatResponse(
            question=question, sql=sql, columns=[], rows=[], row_count=0,
            model_text=model_text, follow_ups=[], error=result["error"],
        )

    columns = result.get("columns", [])
    rows = result.get("rows", [])
    row_count = result.get("row_count", len(rows))

    if len(rows) > request.max_rows:
        rows = rows[: request.max_rows]
        row_count = len(rows)

    if not columns and not sql:
        return ChatResponse(
            question=question, sql="", columns=[], rows=[], row_count=0,
            model_text=model_text or "Could not generate a query for that question.",
            follow_ups=[],
            error=model_text or "Could not generate a query for that question.",
        )

    follow_ups = await generate_follow_ups(
        gemini_client, question, sql, columns, rows, trimmed_history
    )

    return ChatResponse(
        question=question,
        sql=sql,
        columns=columns,
        rows=rows,
        row_count=row_count,
        model_text=model_text,
        follow_ups=follow_ups,
        error=None,
    )


# ---------------------------------------------------------------------------
# Streaming chat endpoint — SSE
# ---------------------------------------------------------------------------

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    Same as /chat but streams progress events as SSE so the frontend
    can show live step indicators while Gemini is working.

    Event format: data: {"type": "progress"|"result"|"error", ...}
    """
    req_id = str(uuid.uuid4())[:8]
    question = request.question.strip()

    if not question:
        async def err_gen():
            yield f'data: {json.dumps({"type": "error", "message": "Question cannot be empty."})}\n\n'
        return StreamingResponse(err_gen(), media_type="text/event-stream")

    trimmed_history = request.history[-10:] if request.history else []

    async def event_generator():
        _metrics["total_requests"] += 1
        t0 = time.time()
        logger.info("[%s] /chat/stream: %s | history turns: %d", req_id, question, len(trimmed_history))

        try:
            # Emit first step immediately so the user sees activity right away
            yield f'data: {json.dumps({"type": "progress", "step": "schema", "label": "Reading database schema..."})}\n\n'
            await asyncio.sleep(0)  # yield to event loop so bytes actually flush

            # Run the full pipeline (this is the long-running step)
            pipeline_result = await asyncio.wait_for(
                run_mcp_pipeline(question, request.max_rows, prior_history=trimmed_history),
                timeout=90.0,
            )

            # Emit remaining steps quickly once we have the result
            yield f'data: {json.dumps({"type": "progress", "step": "query", "label": "Generating SQL query..."})}\n\n'
            await asyncio.sleep(0)

            yield f'data: {json.dumps({"type": "progress", "step": "execute", "label": "Running query on database..."})}\n\n'
            await asyncio.sleep(0)

            yield f'data: {json.dumps({"type": "progress", "step": "insight", "label": "Composing analysis..."})}\n\n'
            await asyncio.sleep(0)

            # Unpack results
            sql = pipeline_result.get("sql", "")
            db_result = pipeline_result.get("result", {})
            model_text = pipeline_result.get("model_text", "")
            gemini_client = pipeline_result.get("gemini_client")
            columns = db_result.get("columns", [])
            rows = db_result.get("rows", [])
            row_count = db_result.get("row_count", len(rows))

            follow_ups = await generate_follow_ups(
                gemini_client, question, sql, columns, rows, trimmed_history
            )

            elapsed_ms = (time.time() - t0) * 1000
            _metrics["total_response_time_ms"] += elapsed_ms
            logger.info("[%s] /chat/stream completed in %.0fms", req_id, elapsed_ms)

            payload = {
                "type": "result",
                "question": question,
                "sql": sql,
                "columns": columns,
                "rows": rows,
                "row_count": row_count,
                "model_text": model_text,
                "follow_ups": follow_ups,
                "error": db_result.get("error"),
            }
            yield f'data: {json.dumps(payload)}\n\n'

        except asyncio.TimeoutError:
            _metrics["errors"] += 1
            logger.error("[%s] /chat/stream timeout", req_id)
            yield f'data: {json.dumps({"type": "error", "message": "Query timed out after 90 seconds. Try a more specific question."})}\n\n'
        except Exception as exc:
            _metrics["errors"] += 1
            logger.error("[%s] /chat/stream error: %s", req_id, exc, exc_info=True)
            yield f'data: {json.dumps({"type": "error", "message": categorize_error(exc)})}\n\n'

    return StreamingResponse(event_generator(), media_type="text/event-stream")
