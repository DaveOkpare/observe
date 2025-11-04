import json
import re

from models import TraceRequest, OLTPAttribute


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


def serialize_spans(trace_request: TraceRequest) -> list[tuple]:
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
                    (
                        span.trace_id,
                        span.span_id,
                        span.parent_span_id,
                        resolved_name,
                        span.start_time_unix_nano,
                        span.end_time_unix_nano,
                        span.kind,
                        json.dumps(flattened_attrs),
                        json.dumps(resource_attrs),
                    )
                )

    return spans_data
