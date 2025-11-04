from contextlib import asynccontextmanager
from asyncpg import Pool
from fastapi import Depends, FastAPI

from db.connection import close_db, get_db, init_db
from utils import serialize_spans
from models import TraceRequest


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    yield
    await close_db()


app = FastAPI(lifespan=lifespan)


@app.post("/v1/traces")
async def insert_traces(request: TraceRequest, db: Pool = Depends(get_db)):
    async with db.acquire() as conn:
        spans_data = serialize_spans(request)
        columns = [
            "trace_id",
            "span_id",
            "parent_span_id",
            "name",
            "start_time_unix_nano",
            "end_time_unix_nano",
            "kind",
            "attributes",
            "resource_attributes",
        ]
        await conn.copy_records_to_table("spans", records=spans_data, columns=columns)
    return {"partialSuccess": {}}
