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


async def fetch_traces(limit: int = 50, service: Optional[str] = None, operation: Optional[str] = None):
    """Fetch traces from database with optional filtering"""
    query = """
        SELECT 
            trace_id,
            MIN(start_time) as start_time,
            MAX(end_time) as end_time,
            MIN(service_name) as service_name,
            STRING_AGG(DISTINCT operation_name, ', ') as operation_name,
            COUNT(*) as span_count,
            MAX(CASE WHEN status_code > 0 THEN status_code ELSE 0 END) as status_code
        FROM spans 
        WHERE span_type = 'span'
    """
    
    params = []
    if service:
        query += " AND service_name = $" + str(len(params) + 1)
        params.append(service)
    if operation:
        query += " AND operation_name LIKE $" + str(len(params) + 1) 
        params.append(f"%{operation}%")
        
    query += " GROUP BY trace_id ORDER BY start_time DESC LIMIT $" + str(len(params) + 1)
    params.append(limit)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
        
    traces = []
    for row in rows:
        duration_ns = row['end_time'] - row['start_time']
        traces.append({
            "trace_id": row['trace_id'],
            "service_name": row['service_name'],
            "operation_name": row['operation_name'], 
            "start_time": row['start_time'],
            "end_time": row['end_time'],
            "duration_ns": duration_ns,
            "duration_ms": duration_ns / 1_000_000,
            "span_count": row['span_count'],
            "status_code": row['status_code'],
            "status": "error" if row['status_code'] > 0 else "ok"
        })
    
    return traces


async def fetch_logs(limit: int = 50, level: Optional[str] = None, service: Optional[str] = None):
    """Fetch log entries from database with optional filtering"""
    query = """
        SELECT trace_id, span_id, operation_name, service_name, start_time,
               log_level, attributes->>'logfire.msg' as message
        FROM spans 
        WHERE span_type = 'log'
    """
    
    params = []
    if level:
        query += " AND log_level = $" + str(len(params) + 1)
        params.append(level.upper())
    if service:
        query += " AND service_name = $" + str(len(params) + 1)
        params.append(service)
        
    query += " ORDER BY start_time DESC LIMIT $" + str(len(params) + 1)
    params.append(limit)
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
        
    logs = []
    for row in rows:
        logs.append({
            "trace_id": row['trace_id'],
            "span_id": row['span_id'], 
            "operation_name": row['operation_name'],
            "service_name": row['service_name'],
            "timestamp": row['start_time'],
            "level": row['log_level'],
            "message": row['message']
        })
    
    return logs


async def fetch_trace_detail(trace_id: str):
    """Fetch detailed trace with all spans and associated logs"""
    query = """
        SELECT trace_id, span_id, parent_span_id, operation_name, service_name,
               span_type, start_time, end_time, status_code, attributes, log_level,
               attributes->>'logfire.msg' as message
        FROM spans 
        WHERE trace_id = $1
        ORDER BY start_time ASC
    """
    
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, trace_id)
    
    if not rows:
        return None
        
    spans = []
    logs = []
    
    for row in rows:
        duration_ns = row['end_time'] - row['start_time'] if row['end_time'] else 0
        
        span_data = {
            "trace_id": row['trace_id'],
            "span_id": row['span_id'],
            "parent_span_id": row['parent_span_id'],
            "operation_name": row['operation_name'],
            "service_name": row['service_name'],
            "span_type": row['span_type'],
            "start_time": row['start_time'],
            "end_time": row['end_time'],
            "duration_ns": duration_ns,
            "duration_ms": duration_ns / 1_000_000,
            "status_code": row['status_code'],
            "status": "error" if row['status_code'] > 0 else "ok",
            "attributes": json.loads(row['attributes']) if row['attributes'] else {}
        }
        
        if row['span_type'] == 'log':
            logs.append({
                **span_data,
                "level": row['log_level'],
                "message": row['message']
            })
        else:
            spans.append(span_data)
    
    # Calculate trace summary
    if spans:
        trace_start = min(s['start_time'] for s in spans)
        trace_end = max(s['end_time'] for s in spans if s['end_time'])
        trace_duration = trace_end - trace_start if trace_end else 0
    else:
        trace_start = trace_end = trace_duration = 0
    
    return {
        "trace_id": trace_id,
        "start_time": trace_start,
        "end_time": trace_end, 
        "duration_ns": trace_duration,
        "duration_ms": trace_duration / 1_000_000,
        "spans": spans,
        "logs": logs,
        "span_count": len(spans),
        "log_count": len(logs)
    }
