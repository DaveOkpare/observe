from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ai.agent import text_to_sql, SQLSyntax
from backend.database import (
    close_db_pool,
    execute_custom_query,
    get_trace_detail,
    get_traces_paginated,
    init_db_pool,
    serialize_spans_for_db,
    insert_spans_batch,
)
from backend.models import TraceRequest

origins = ["http://localhost", "http://localhost:8080", "http://localhost:3000"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    await init_db_pool()
    yield
    # shutdown
    await close_db_pool()


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    query: str


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post("/v1/traces")
async def receive_traces(trace_request: TraceRequest):
    # Transform OTLP -> Database format
    serialized_trace_request = serialize_spans_for_db(trace_request)

    # Insert into PostgreSQL
    await insert_spans_batch(serialized_trace_request)
    return {"partialSuccess": {}}


@app.get("/v1/traces")
async def fetch_traces(offset: int = 0, limit: int = 50):
    traces = await get_traces_paginated(offset=offset, limit=limit)
    return traces


@app.get("/v1/traces/{trace_id}")
async def retrieve_trace(trace_id: str):
    trace = await get_trace_detail(trace_id)
    return trace


@app.post("/v1/traces/query")
async def query_traces(query_request: QueryRequest):
    output: SQLSyntax = await text_to_sql(query_request.query)
    result = await execute_custom_query(output.syntax)
    return result
