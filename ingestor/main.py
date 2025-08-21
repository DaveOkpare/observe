from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from ingestor.database import (
    close_db_pool,
    init_db_pool,
    serialize_spans_for_db,
    insert_spans_batch,
)
from ingestor.models import TraceRequest

origins = [
    "http://localhost",
    "http://localhost:8080",
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
