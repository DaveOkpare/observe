from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import Optional, List
from ingestor.database import (
    close_db_pool,
    init_db_pool,
    serialize_spans_for_db,
    insert_spans_batch,
    fetch_traces,
    fetch_logs,
    fetch_trace_detail,
)
from ingestor.models import TraceRequest
import json

origins = [
    "http://localhost",
    "http://localhost:8080",
    "http://localhost:3000",  # Next.js dev server
]


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


@app.post("/v1/traces")
async def receive_traces(trace_request: TraceRequest):
    # Transform OTLP -> Database format
    serialized_trace_request = serialize_spans_for_db(trace_request)

    # Insert into PostgreSQL
    await insert_spans_batch(serialized_trace_request)

    return {"partialSuccess": {}}


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.get("/api/traces")
async def get_traces(
    limit: int = Query(50, le=1000),
    service: Optional[str] = Query(None),
    operation: Optional[str] = Query(None),
):
    """Get list of traces with optional filtering"""
    traces = await fetch_traces(limit=limit, service=service, operation=operation)
    return {"traces": traces}


@app.get("/api/logs") 
async def get_logs(
    limit: int = Query(50, le=1000),
    level: Optional[str] = Query(None),
    service: Optional[str] = Query(None),
):
    """Get list of log entries with optional filtering"""
    logs = await fetch_logs(limit=limit, level=level, service=service)
    return {"logs": logs}


@app.get("/api/traces/{trace_id}")
async def get_trace_detail(trace_id: str):
    """Get detailed trace with all spans and associated logs"""
    trace_detail = await fetch_trace_detail(trace_id)
    if not trace_detail:
        return {"error": "Trace not found"}, 404
    return trace_detail
