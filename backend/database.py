import os
import asyncpg
import json
import re

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


def resolve_span_name(span_name: str, attributes: dict) -> str:
    """Resolve template variables in span names using attribute values"""
    if not attributes:
        return span_name

    # Generic approach: resolve any {variable} patterns using available attributes
    template_vars = re.findall(r"\{(\w+)\}", span_name)
    resolved_name = span_name

    for var in template_vars:
        if var in attributes:
            resolved_name = resolved_name.replace(f"{{{var}}}", str(attributes[var]))

    return resolved_name


def serialize_spans_for_db(trace_request: TraceRequest) -> list[dict]:
    """Extract and transform spans from OTLP nested structure to flat database format"""
    spans_data = []

    for resource_spans in trace_request.resource_spans:
        for scope_spans in resource_spans.scope_spans:
            for span in scope_spans.spans:
                # Flatten attributes first
                flattened_attrs = flatten_attributes(span.attributes)

                # Resolve span name using attributes
                resolved_name = resolve_span_name(span.name, flattened_attrs)

                spans_data.append(
                    {
                        "trace_id": span.trace_id,
                        "span_id": span.span_id,
                        "parent_span_id": span.parent_span_id,
                        "name": resolved_name,
                        "start_time_unix_nano": span.start_time_unix_nano,
                        "end_time_unix_nano": span.end_time_unix_nano,
                        "kind": span.kind,
                        "attributes": json.dumps(flattened_attrs),
                    }
                )

    return spans_data


async def insert_spans_batch(spans_data: list[dict]):
    """Bulk insert spans into PostgreSQL for performance"""
    if not spans_data:
        return

    columns = [
        "trace_id",
        "span_id",
        "parent_span_id",
        "name",
        "start_time_unix_nano",
        "end_time_unix_nano",
        "kind",
        "attributes",
    ]
    records = [tuple(d[col] for col in columns) for d in spans_data]

    try:
        async with pool.acquire() as conn:
            await conn.copy_records_to_table("spans", records=records, columns=columns)
            print(f"Inserted {len(spans_data)} spans successfully")
    except Exception as e:
        # Log error but don't crash - telemetry ingestion should be resilient
        print(f"Database error inserting spans: {e}")
        # OTel Collector expects success response even on partial failures
