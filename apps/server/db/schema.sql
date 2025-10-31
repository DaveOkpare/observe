CREATE TABLE spans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id VARCHAR(32) NOT NULL,
    span_id VARCHAR(16) NOT NULL,
    parent_span_id VARCHAR(16),
    name VARCHAR(255) NOT NULL,
    start_time_unix_nano TIMESTAMPTZ NOT NULL,
    end_time_unix_nano TIMESTAMPTZ NOT NULL,
    kind INTEGER,
    attributes JSONB,
    resource_attributes JSONB,
);

CREATE INDEX idx_spans_trace_id ON spans(trace_id);
CREATE INDEX idx_spans_span_id ON spans(span_id);
CREATE INDEX idx_spans_parent_span_id ON spans(parent_span_id);
CREATE INDEX idx_spans_start_time ON spans(start_time_unix_nano);
CREATE INDEX idx_spans_attributes ON spans USING GIN(attributes);
