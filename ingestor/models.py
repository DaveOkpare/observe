from datetime import datetime, timezone
from typing import Optional, Union
from pydantic import BaseModel, Field, field_validator


class OTLPAttribute(BaseModel):
    key: str
    value: Union[str, int, float, bool]  # OTLP supported types


class OTLPSpan(BaseModel):
    trace_id: str = Field(alias="traceId")
    span_id: str = Field(alias="spanId")
    name: str
    start_time_unix_nano: datetime = Field(alias="startTimeUnixNano")
    end_time_unix_nano: datetime = Field(alias="endTimeUnixNano")
    attributes: list[OTLPAttribute] = []
    status: Optional[dict] = None
    parent_span_id: Optional[str] = Field(None, alias="parentSpanId")

    @field_validator("start_time_unix_nano", "end_time_unix_nano", mode="before")
    def convert_nano_to_datetime(cls, v):
        if isinstance(v, str):
            return datetime.fromtimestamp(int(v) / 1_000_000_000, tz=timezone.utc)
        return v


class OTLPScopeSpans(BaseModel):
    spans: list[OTLPSpan]


class OTLPResource(BaseModel):
    attributes: list[OTLPAttribute] = []


class OTLPResourceSpans(BaseModel):
    resource: OTLPResource
    scope_spans: list[OTLPScopeSpans] = Field(alias="scopeSpans")


class TraceRequest(BaseModel):
    resource_spans: list[OTLPResourceSpans] = Field(alias="resourceSpans")


def flatten_attributes(attributes: list[OTLPAttribute]) -> dict:
    """Convert OTLP attributes array to flat dict for JSONB storage"""
    return {attr.key: attr.value for attr in attributes}
