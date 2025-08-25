import os
from typing import Optional
import asyncpg
import json
from dotenv import load_dotenv

from ingestor.models import TraceRequest, flatten_attributes

load_dotenv()

# Module-level configuration
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@postgres:5432/observe"
)
pool: Optional[asyncpg.Pool] = None


async def init_db_pool():
    """Initialize connection pool on startup"""
    global pool
    pool = await asyncpg.create_pool(
        DATABASE_URL,
        min_size=5,  # Smaller pool for development
        max_size=10,  # Can be increased for production
        command_timeout=60,
    )
    print(f"Database pool initialized: {DATABASE_URL}")


async def close_db_pool():
    """Close pool on shutdown"""
    global pool
    if pool:
        await pool.close()
        print("Database pool closed")


def serialize_spans_for_db(trace_request: TraceRequest) -> list[dict]:
    """Extract and transform spans from OTLP nested structure to flat database format"""
    spans_data = []

    # Walk through the OTLP nested structure:
    # TraceRequest -> ResourceSpans[] -> ScopeSpans[] -> Span[]
    for resource_spans in trace_request.resource_spans:
        # Flatten resource attributes (service.name, etc.)
        resource_attrs = flatten_attributes(resource_spans.resource.attributes)

        for scope_spans in resource_spans.scope_spans:
            for span in scope_spans.spans:
                # Extract span_type from Logfire attributes (defaults to 'span')
                span_attrs = flatten_attributes(span.attributes)
                span_type = span_attrs.get("logfire.span_type", "span")

                # Transform each span to match our database schema
                span_data = {
                    "trace_id": span.trace_id,
                    "span_id": span.span_id,
                    "parent_span_id": span.parent_span_id,
                    "operation_name": span.name,
                    "service_name": resource_attrs.get("service.name", "unknown"),
                    "span_type": span_type,
                    "start_time": span.start_time_unix_nano,
                    "end_time": span.end_time_unix_nano,
                    "status_code": span.status.get("code", 0) if span.status else 0,
                    "attributes": span_attrs,
                    "resource_attributes": resource_attrs,
                }
                spans_data.append(span_data)

    return spans_data


async def insert_spans_batch(spans_data: list[dict]):
    """Bulk insert spans into PostgreSQL for performance"""
    if not spans_data:
        return

    # SQL query with parameter placeholders
    query = """
        INSERT INTO spans (trace_id, span_id, parent_span_id, operation_name, service_name, span_type,
                          start_time, end_time, status_code, attributes, resource_attributes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    """

    try:
        async with pool.acquire() as conn:
            # Convert dict data to tuples matching SQL parameter order
            rows = [
                (
                    span["trace_id"],
                    span["span_id"],
                    span["parent_span_id"],
                    span["operation_name"],
                    span["service_name"],
                    span["span_type"],
                    span["start_time"],
                    span["end_time"],
                    span["status_code"],
                    json.dumps(span["attributes"]),  # Convert dict to JSON string
                    json.dumps(
                        span["resource_attributes"]
                    ),  # Convert dict to JSON string
                )
                for span in spans_data
            ]

            # Bulk insert - much faster than individual INSERTs
            await conn.executemany(query, rows)
            print(f"Inserted {len(spans_data)} spans successfully")

    except Exception as e:
        # Log error but don't crash - telemetry ingestion should be resilient
        print(f"Database error inserting spans: {e}")
        # OTel Collector expects success response even on partial failures
