from datetime import datetime, timezone
from pydantic import BaseModel, Field, field_validator

# ref: https://github.com/open-telemetry/opentelemetry-proto/blob/v1.7.0/examples/trace.json


class OLTPAttributeValue(BaseModel):
    stringValue: str | None = None
    intValue: str | None = None  # JSON sends as string
    doubleValue: float | None = None
    boolValue: bool | None = None
    arrayValue: dict | None = None
    kvlistValue: dict | None = None


class OLTPAttribute(BaseModel):
    key: str
    value: OLTPAttributeValue


class OLTPEvent(BaseModel):
    time_unix_nano: datetime = Field(alias="timeUnixNano")
    name: str
    attributes: list[OLTPAttribute] = []

    @field_validator("time_unix_nano", mode="before")
    def convert_nano_to_datetime(cls, v):
        if isinstance(v, str):
            return datetime.fromtimestamp(int(v) / 1_000_000_000, tz=timezone.utc)
        return v

class OLTPScope(BaseModel):
    name: str
    version: str
    attributes: list[OLTPAttribute] = []


class OLTPSpan(BaseModel):
    trace_id: str = Field(alias="traceId")
    span_id: str = Field(alias="spanId")
    parent_span_id: str | None = Field(alias="parentSpanId", default=None)
    name: str
    start_time_unix_nano: datetime = Field(alias="startTimeUnixNano")
    end_time_unix_nano: datetime = Field(alias="endTimeUnixNano")
    kind: int
    attributes: list[OLTPAttribute] = []
    events: list[OLTPEvent] = []

    @field_validator("start_time_unix_nano", "end_time_unix_nano", mode="before")
    def convert_nano_to_datetime(cls, v):
        if isinstance(v, str):
            return datetime.fromtimestamp(int(v) / 1_000_000_000, tz=timezone.utc)
        return v


class OLTPResource(BaseModel):
    attributes: list[OLTPAttribute]


class OLTPScopeSpan(BaseModel):
    scope: OLTPScope
    spans: list[OLTPSpan]


class OLTPResourceSpan(BaseModel):
    resource: OLTPResource
    scope_spans: list[OLTPScopeSpan] = Field(alias="scopeSpans")


class TraceRequest(BaseModel):
    resource_spans = list[OLTPResourceSpan] = Field(alias="resourceSpans")
