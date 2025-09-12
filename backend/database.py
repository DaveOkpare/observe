import os
import asyncpg
import json
import re
from typing import Any, Optional, Dict, List
from dataclasses import dataclass

from backend.models import TraceRequest, OLTPAttribute


@dataclass
class DatabaseResponse:
    """Unified response class for all database operations"""

    success: bool
    rows: List[Dict[str, Any]]
    count: int
    error: Optional[str] = None

    def to_dict(self, **extra_fields) -> Dict[str, Any]:
        """Convert to dictionary with optional extra fields"""
        result = {"success": self.success, "rows": self.rows, "count": self.count}
        if self.error:
            result["error"] = self.error
        result.update(extra_fields)
        return result

    @classmethod
    def success_response(cls, rows: List[Dict[str, Any]]) -> "DatabaseResponse":
        """Create successful response"""
        return cls(success=True, rows=rows, count=len(rows))

    @classmethod
    def error_response(cls, error: str) -> "DatabaseResponse":
        """Create error response"""
        return cls(success=False, rows=[], count=0, error=error)


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
        resource_attrs = flatten_attributes(resource_spans.resource.attributes)
        
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
                        "service_name": resource_attrs.get("service.name", "unknown"),
                        "resource_attributes": json.dumps(resource_attrs),
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


async def get_traces_paginated(offset: int = 0, limit: int = 50) -> dict:
    """Get paginated list of traces with summary information"""
    if not pool:
        raise RuntimeError("Database pool not initialized")

    try:
        async with pool.acquire() as conn:
            # Get trace summaries with pagination
            traces_query = """
                SELECT 
                    trace_id,
                    COUNT(*) as span_count,
                    MIN(start_time_unix_nano) as trace_start_time,
                    MAX(end_time_unix_nano) as trace_end_time,
                    EXTRACT(EPOCH FROM (MAX(end_time_unix_nano) - MIN(start_time_unix_nano))) * 1000 as duration_ms,
                    (SELECT name FROM spans s2 WHERE s2.trace_id = spans.trace_id ORDER BY s2.start_time_unix_nano ASC LIMIT 1) as name
                FROM spans 
                GROUP BY trace_id
                ORDER BY MIN(start_time_unix_nano) DESC
                OFFSET $1 LIMIT $2
            """

            # Get total count for pagination metadata
            count_query = """
                SELECT COUNT(DISTINCT trace_id) as total_traces
                FROM spans
            """

            traces = await conn.fetch(traces_query, offset, limit)
            total_result = await conn.fetchrow(count_query)
            total_traces = total_result["total_traces"] if total_result else 0

            # Convert to dict format
            trace_list = []
            for trace in traces:
                trace_list.append(
                    {
                        "trace_id": trace["trace_id"],
                        "span_count": trace["span_count"],
                        "start_time": trace["trace_start_time"].isoformat(),
                        "end_time": trace["trace_end_time"].isoformat(),
                        "duration_ms": round(trace["duration_ms"], 2)
                        if trace["duration_ms"]
                        else 0,
                        "name": trace["name"],
                    }
                )

            response = DatabaseResponse.success_response(trace_list)
            return response.to_dict(
                pagination={
                    "offset": offset,
                    "limit": limit,
                    "total": total_traces,
                    "has_next": offset + limit < total_traces,
                    "has_prev": offset > 0,
                }
            )

    except Exception as e:
        print(f"Database error fetching traces: {e}")
        response = DatabaseResponse.error_response(str(e))
        return response.to_dict(
            pagination={
                "offset": offset,
                "limit": limit,
                "total": 0,
                "has_next": False,
                "has_prev": False,
            }
        )


async def get_trace_detail(trace_id: str) -> dict:
    """Get complete trace with all spans for detail view"""
    if not pool:
        raise RuntimeError("Database pool not initialized")

    try:
        async with pool.acquire() as conn:
            query = """
                SELECT 
                    id,
                    trace_id,
                    span_id,
                    parent_span_id,
                    name,
                    start_time_unix_nano,
                    end_time_unix_nano,
                    kind,
                    attributes
                FROM spans 
                WHERE trace_id = $1
                ORDER BY start_time_unix_nano ASC
            """

            spans = await conn.fetch(query, trace_id)

            if not spans:
                response = DatabaseResponse.success_response([])
                return response.to_dict(trace_id=trace_id)

            # Convert to dict format with parsed attributes
            span_list = []
            for span in spans:
                span_data = {
                    "id": str(span["id"]),
                    "trace_id": span["trace_id"],
                    "span_id": span["span_id"],
                    "parent_span_id": span["parent_span_id"],
                    "name": span["name"],
                    "start_time": span["start_time_unix_nano"].isoformat(),
                    "end_time": span["end_time_unix_nano"].isoformat(),
                    "duration_ms": (
                        span["end_time_unix_nano"] - span["start_time_unix_nano"]
                    ).total_seconds()
                    * 1000,
                    "kind": span["kind"],
                    "attributes": json.loads(span["attributes"])
                    if span["attributes"]
                    else {},
                }
                span_list.append(span_data)

            response = DatabaseResponse.success_response(span_list)
            return response.to_dict(
                trace_id=trace_id,
                start_time=span_list[0]["start_time"],
                end_time=span_list[-1]["end_time"],
                duration_ms=sum(span["duration_ms"] for span in span_list),
            )

    except Exception as e:
        print(f"Database error fetching trace detail: {e}")
        response = DatabaseResponse.error_response(str(e))
        return response.to_dict(trace_id=trace_id)


async def execute_custom_query(query: str) -> dict:
    """Execute custom SQL query and return results"""
    if not pool:
        raise RuntimeError("Database pool not initialized")

    try:
        async with pool.acquire() as conn:
            result = await conn.fetch(query)

            # Convert asyncpg.Record objects to dicts
            rows = []
            for row in result:
                row_dict = {}
                for key, value in row.items():
                    if hasattr(value, "isoformat"):  # Handle datetime objects
                        row_dict[key] = value.isoformat()
                    elif isinstance(value, (dict, list)):  # Handle JSONB
                        row_dict[key] = value
                    else:
                        row_dict[key] = value
                rows.append(row_dict)

            return DatabaseResponse.success_response(rows).to_dict()

    except Exception as e:
        return DatabaseResponse.error_response(str(e)).to_dict()
