import os
import asyncpg

from backend.models import TraceRequest, OLTPAttribute

pool: asyncpg.Pool | None = None
DATABASE_URL: str = os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:6432/observability"
)


async def init_db_pool():
    """Initialize connection pool on startup"""
    global pool
    pool = await asyncpg.create_pool(
        DATABASE_URL,
        min_size=10,
        max_size=50,
        max_queries=50000,
        max_inactive_connection_lifetime=300,
        command_timeout=60,
    )
    print("Database pool initialize")


async def close_db_pool():
    """Close pool on shutdown"""
    global pool
    if pool:
        await pool.close()
        print("Database pool closed")


def flatten_attributes(attributes: list[OLTPAttribute]) -> dict:
    """Convert OTLP attributes array to flat dict for JSONB storage"""
    result = {}
    for attr in attributes:
        # Extract actual value from structured OTLP format
        if attr.value.stringValue is not None:
            result[attr.key] = attr.value.stringValue
        elif attr.value.intValue is not None:
            result[attr.key] = int(attr.value.intValue)
        elif attr.value.doubleValue is not None:
            result[attr.key] = attr.value.doubleValue
        elif attr.value.boolValue is not None:
            result[attr.key] = attr.value.boolValue
        else:
            result[attr.key] = str(attr.value)
    return result


def serialize_spans_for_db(trace_request: TraceRequest) -> list[dict]:
    """Extract and transform spans from OTLP nested structure to flat database format"""
    spans_data = []

    for resource_spans in trace_request.resource_spans:
        for scope_spans in resource_spans.scope_spans:
            for span in scope_spans.spans:
                spans_data.append(
                    {
                        "trace_id": span.trace_id,
                        "span_id": span.span_id,
                        "parent_span_id": span.parent_span_id,
                        "name": span.name,
                        "start_time_unix_nano": span.start_time_unix_nano,
                        "end_time_unix_nano": span.end_time_unix_nano,
                        "kind": span.kind,
                        "attributes": flatten_attributes(span.attributes),
                        "events": span.events,
                    }
                )

    return spans_data
