import os
import asyncpg
import json
import re
from datetime import datetime
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
        "service_name",
        "resource_attributes",
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


async def get_services() -> dict:
    """Get all unique service names from spans table"""
    if not pool:
        raise RuntimeError("Database pool not initialized")

    try:
        async with pool.acquire() as conn:
            query = """
                SELECT DISTINCT service_name
                FROM spans
                WHERE service_name IS NOT NULL
                ORDER BY service_name
            """
            rows = await conn.fetch(query)
            services = [row["service_name"] for row in rows]

            return {"success": True, "services": services, "count": len(services)}
    except Exception as e:
        print(f"Database query error: {e}")
        return {"success": False, "error": str(e), "services": [], "count": 0}


async def get_traces_paginated(
    offset: int = 0,
    limit: int = 50,
    service: str = None,
    operation: str = None,
    start_time: str = None,
    end_time: str = None,
) -> dict:
    """Get paginated list of traces with summary information"""
    if not pool:
        raise RuntimeError("Database pool not initialized")

    try:
        async with pool.acquire() as conn:
            # Build WHERE clauses for filtering
            where_conditions = []
            params = []
            param_index = 1

            if service:
                where_conditions.append(f"service_name = ${param_index}")
                params.append(service)
                param_index += 1

            if operation:
                where_conditions.append(f"name ILIKE ${param_index}")
                params.append(f"%{operation}%")
                param_index += 1

            if start_time:
                where_conditions.append(f"start_time_unix_nano >= ${param_index}")
                # Convert ISO string to datetime object
                try:
                    start_datetime = datetime.fromisoformat(
                        start_time.replace("Z", "+00:00")
                    )
                    params.append(start_datetime)
                except ValueError:
                    # If parsing fails, skip this filter
                    where_conditions.pop()  # Remove the condition we just added
                else:
                    param_index += 1

            if end_time:
                where_conditions.append(f"end_time_unix_nano <= ${param_index}")
                # Convert ISO string to datetime object
                try:
                    end_datetime = datetime.fromisoformat(
                        end_time.replace("Z", "+00:00")
                    )
                    params.append(end_datetime)
                except ValueError:
                    # If parsing fails, skip this filter
                    where_conditions.pop()  # Remove the condition we just added
                else:
                    param_index += 1

            where_clause = ""
            if where_conditions:
                where_clause = "WHERE " + " AND ".join(where_conditions)

            # Add offset and limit parameters
            offset_param = f"${param_index}"
            limit_param = f"${param_index + 1}"
            params.extend([offset, limit])

            # Get trace summaries with pagination and filters
            traces_query = f"""
                SELECT
                    trace_id,
                    COUNT(*) as span_count,
                    MIN(start_time_unix_nano) as trace_start_time,
                    MAX(end_time_unix_nano) as trace_end_time,
                    EXTRACT(EPOCH FROM (MAX(end_time_unix_nano) - MIN(start_time_unix_nano))) * 1000 as duration_ms,
                    MAX(CASE WHEN parent_span_id IS NULL OR parent_span_id = ''
                             THEN name
                             ELSE NULL END) AS root_operation,
                    MAX(CASE WHEN (parent_span_id IS NULL OR parent_span_id = '') AND service_name IS NOT NULL
                             THEN service_name
                             ELSE NULL END) AS root_service,
                    MAX(name) AS any_operation,
                    MAX(service_name) AS any_service
                FROM spans
                {where_clause}
                GROUP BY trace_id
                ORDER BY MIN(start_time_unix_nano) DESC
                OFFSET {offset_param} LIMIT {limit_param}
            """

            # Get total count for pagination metadata with same filters
            count_query = f"""
                SELECT COUNT(DISTINCT trace_id) as total_traces
                FROM spans
                {where_clause}
            """

            # Execute queries with parameters
            traces = await conn.fetch(traces_query, *params)
            total_result = await conn.fetchrow(
                count_query, *params[:-2]
            )  # Exclude offset/limit for count
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
                        "name": trace["root_operation"]
                        or trace["any_operation"]
                        or "unknown-operation",
                        "service_name": trace["root_service"]
                        or trace["any_service"]
                        or "unknown-service",
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
                    attributes,
                    service_name
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
                # Calculate duration, fallback to attributes if timestamps are same
                calculated_duration = (
                    span["end_time_unix_nano"] - span["start_time_unix_nano"]
                ).total_seconds() * 1000

                # If calculated duration is 0, try to get from attributes
                if calculated_duration == 0 and span["attributes"]:
                    try:
                        attributes_dict = json.loads(span["attributes"])
                        attr_duration = attributes_dict.get("duration_ms")
                        if attr_duration is not None:
                            calculated_duration = float(attr_duration)
                    except (json.JSONDecodeError, ValueError, TypeError):
                        pass  # Keep calculated_duration as 0

                span_data = {
                    "id": str(span["id"]),
                    "trace_id": span["trace_id"],
                    "span_id": span["span_id"],
                    "parent_span_id": span["parent_span_id"],
                    "name": span["name"],
                    "start_time": span["start_time_unix_nano"].isoformat(),
                    "end_time": span["end_time_unix_nano"].isoformat(),
                    "duration_ms": calculated_duration,
                    "kind": span["kind"],
                    "attributes": json.loads(span["attributes"])
                    if span["attributes"]
                    else {},
                    "service_name": span["service_name"] or "unknown-service",
                }
                span_list.append(span_data)

            # Get root span service name for trace-level info
            root_span = next(
                (span for span in span_list if not span.get("parent_span_id")),
                span_list[0] if span_list else None,
            )
            trace_service_name = (
                root_span["service_name"] if root_span else "unknown-service"
            )
            trace_operation_name = (
                root_span["name"] if root_span else "unknown-operation"
            )

            response = DatabaseResponse.success_response(span_list)
            return response.to_dict(
                trace_id=trace_id,
                start_time=span_list[0]["start_time"],
                end_time=span_list[-1]["end_time"],
                duration_ms=sum(span["duration_ms"] for span in span_list),
                service_name=trace_service_name,
                operation_name=trace_operation_name,
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
