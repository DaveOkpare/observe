from datetime import datetime
from pydantic import BaseModel, Field

# ref: https://github.com/open-telemetry/opentelemetry-proto/blob/v1.7.0/examples/trace.json


class OLTPAttributeValue(BaseModel):
    stringValue: str | None = None
    intValue: str | None = None  # JSON sends as string
    floatValue: float | None = None
    boolValue: bool | None = None


class OLTPAttribute(BaseModel):
    key: str
    value: OLTPAttributeValue


class OLTPScope(BaseModel):
    name: str
    version: str
    attribues: list[OLTPAttribute]


class OLTPSpan(BaseModel):
    trace_id: str = Field(alias="traceId")
    span_id: str = Field(alias="spanId")
    parent_id: str = Field(alias="parentId")
    start_time_unix_nano: datetime = Field(alias="startTimeUnixNano")
    end_time_unix_nano: datetime = Field(alias="endTimeUnixNano")
    kind: int
    attributes: list[OLTPAttribute]
    events: list


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
