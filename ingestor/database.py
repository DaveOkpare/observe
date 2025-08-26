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


async def fetch_traces(limit: int = 50, offset: int = 0, service: Optional[str] = None, operation: Optional[str] = None):
    """Fetch traces with root span operation names and optional filtering"""
    params: list = []
    filters = []
    
    if service:
        filters.append(f"service_name = ${len(params) + 1}")
        params.append(service)
    
    if operation:
        filters.append(f"operation_name ILIKE ${len(params) + 1}")
        params.append(f"%{operation}%")
    
    where_clause = " AND " + " AND ".join(filters) if filters else ""
    
    query = f"""
        SELECT 
            trace_id,
            MIN(start_time) AS start_time,
            MAX(end_time) AS end_time,
            COALESCE(
                (array_agg(operation_name) FILTER (WHERE parent_span_id IS NULL OR parent_span_id = ''))[1],
                (array_agg(operation_name))[1]
            ) AS operation_name,
            COALESCE(
                (array_agg(service_name) FILTER (WHERE parent_span_id IS NULL OR parent_span_id = ''))[1],
                (array_agg(service_name))[1]
            ) AS service_name,
            COUNT(*) AS span_count,
            MAX(status_code) AS status_code,
            EXTRACT(EPOCH FROM (MAX(end_time) - MIN(start_time))) * 1000 AS duration_ms
        FROM spans
        WHERE span_type = 'span' {where_clause}
        GROUP BY trace_id
        ORDER BY MIN(start_time) DESC
        LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}
    """
    params.extend([limit, offset])

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)

    return [{
        "trace_id": row["trace_id"],
        "service_name": row["service_name"],
        "operation_name": row["operation_name"],
        "start_time": row["start_time"],
        "end_time": row["end_time"],
        "duration_ms": row["duration_ms"],
        "span_count": row["span_count"],
        "status_code": row["status_code"],
        "status": "error" if row["status_code"] > 0 else "ok",
    } for row in rows]


async def fetch_logs(limit: int = 50, offset: int = 0, level: Optional[str] = None, service: Optional[str] = None):
    """Fetch log entries with optional filtering"""
    params = []
    filters = []
    
    if level:
        filters.append(f"log_level = ${len(params) + 1}")
        params.append(level.upper())
    
    if service:
        filters.append(f"service_name = ${len(params) + 1}")
        params.append(service)
    
    where_clause = " AND " + " AND ".join(filters) if filters else ""
    
    query = f"""
        SELECT trace_id, span_id, operation_name, service_name, start_time,
               log_level, attributes->>'logfire.msg' as message
        FROM spans 
        WHERE span_type = 'log' {where_clause}
        ORDER BY start_time DESC 
        LIMIT ${len(params) + 1} OFFSET ${len(params) + 2}
    """
    params.extend([limit, offset])
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
        
    return [{
        "trace_id": row["trace_id"],
        "span_id": row["span_id"], 
        "operation_name": row["operation_name"],
        "service_name": row["service_name"],
        "timestamp": row["start_time"],
        "level": row["log_level"],
        "message": row["message"]
    } for row in rows]


async def fetch_trace_detail(trace_id: str):
    """Fetch detailed trace with all spans and logs"""
    query = """
        SELECT trace_id, span_id, parent_span_id, operation_name, service_name,
               span_type, start_time, end_time, status_code, attributes, log_level,
               attributes->>'logfire.msg' as message,
               CASE WHEN end_time IS NOT NULL THEN 
                   EXTRACT(EPOCH FROM (end_time - start_time)) * 1000000000
               ELSE 0 END as duration_ns
        FROM spans 
        WHERE trace_id = $1
        ORDER BY start_time ASC
    """
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, trace_id)
    
    if not rows:
        return None
        
    spans, logs = [], []
    
    for row in rows:
        base_data = {
            "trace_id": row['trace_id'],
            "span_id": row['span_id'],
            "parent_span_id": row['parent_span_id'],
            "operation_name": row['operation_name'],
            "service_name": row['service_name'],
            "span_type": row['span_type'],
            "start_time": row['start_time'],
            "end_time": row['end_time'],
            "duration_ns": row['duration_ns'],
            "duration_ms": row['duration_ns'] / 1_000_000,
            "status_code": row['status_code'],
            "status": "error" if row['status_code'] > 0 else "ok",
            "attributes": json.loads(row['attributes']) if row['attributes'] else {}
        }
        
        if row['span_type'] == 'log':
            logs.append({**base_data, "level": row['log_level'], "message": row['message']})
        else:
            spans.append(base_data)
    
    # Calculate trace bounds - simple Python calculation
    if spans:
        start_times = [s['start_time'] for s in spans]
        end_times = [s['end_time'] for s in spans if s['end_time']]
        trace_start = min(start_times)
        trace_end = max(end_times) if end_times else trace_start
        
        # Calculate duration in Python using timestamp arithmetic
        if end_times and trace_end and trace_start:
            # PostgreSQL timestamps can be subtracted in Python to get timedelta
            duration_delta = trace_end - trace_start
            trace_duration_ns = duration_delta.total_seconds() * 1_000_000_000
            trace_duration_ms = duration_delta.total_seconds() * 1_000
        else:
            trace_duration_ns = trace_duration_ms = 0
    else:
        trace_start = trace_end = None
        trace_duration_ns = trace_duration_ms = 0
    
    return {
        "trace_id": trace_id,
        "start_time": trace_start,
        "end_time": trace_end, 
        "duration_ns": trace_duration_ns,
        "duration_ms": trace_duration_ms,
        "spans": spans,
        "logs": logs,
        "span_count": len(spans),
        "log_count": len(logs)
    }


async def count_traces(service: Optional[str] = None, operation: Optional[str] = None) -> int:
    """Get total count of traces for pagination"""
    params = []
    filters = []
    
    if service:
        filters.append(f"service_name = ${len(params) + 1}")
        params.append(service)
    
    if operation:
        filters.append(f"operation_name ILIKE ${len(params) + 1}")
        params.append(f"%{operation}%")
    
    where_clause = " AND " + " AND ".join(filters) if filters else ""
    
    query = f"""
        SELECT COUNT(DISTINCT trace_id) as total
        FROM spans
        WHERE span_type = 'span' {where_clause}
    """
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, *params)
    
    return row["total"]


async def count_logs(level: Optional[str] = None, service: Optional[str] = None) -> int:
    """Get total count of logs for pagination"""
    params = []
    filters = []
    
    if level:
        filters.append(f"log_level = ${len(params) + 1}")
        params.append(level.upper())
    
    if service:
        filters.append(f"service_name = ${len(params) + 1}")
        params.append(service)
    
    where_clause = " AND " + " AND ".join(filters) if filters else ""
    
    query = f"""
        SELECT COUNT(*) as total
        FROM spans
        WHERE span_type = 'log' {where_clause}
    """
    
    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, *params)
    
    return row["total"]
