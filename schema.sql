-- Stores OpenTelemetry spans, logs, and derived metrics

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Spans table - stores distributed tracing data
CREATE TABLE spans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trace_id VARCHAR(32) NOT NULL,
    span_id VARCHAR(16) NOT NULL,
    parent_span_id VARCHAR(16),
    operation_name VARCHAR(255) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_ms INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_time - start_time)) * 1000
    ) STORED,
    status_code INTEGER NOT NULL DEFAULT 0, -- 0=unset, 1=ok, 2=error
    status_message TEXT,
    attributes JSONB,
    events JSONB,
    resource_attributes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Logs table - stores structured log entries
CREATE TABLE logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trace_id VARCHAR(32),
    span_id VARCHAR(16),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    severity_text VARCHAR(20),
    severity_number INTEGER,
    body TEXT,
    attributes JSONB,
    resource_attributes JSONB,
    service_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events table - stores span events (for detailed trace analysis)
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    span_id UUID REFERENCES spans(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    attributes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_spans_trace_id ON spans(trace_id);
CREATE INDEX idx_spans_service_name ON spans(service_name);
CREATE INDEX idx_spans_start_time ON spans(start_time);
CREATE INDEX idx_spans_operation_name ON spans(operation_name);
CREATE INDEX idx_spans_status_code ON spans(status_code);

CREATE INDEX idx_logs_trace_id ON logs(trace_id);
CREATE INDEX idx_logs_timestamp ON logs(timestamp);
CREATE INDEX idx_logs_service_name ON logs(service_name);
CREATE INDEX idx_logs_severity_number ON logs(severity_number);

CREATE INDEX idx_events_span_id ON events(span_id);
CREATE INDEX idx_events_timestamp ON events(timestamp);

-- GIN indexes for JSONB attributes (for fast attribute queries)
CREATE INDEX idx_spans_attributes_gin ON spans USING GIN(attributes);
CREATE INDEX idx_logs_attributes_gin ON logs USING GIN(attributes);

-- Materialized views for common aggregations (mentioned in PRD)
CREATE MATERIALIZED VIEW span_stats_hourly AS
SELECT 
    service_name,
    operation_name,
    date_trunc('hour', start_time) as hour,
    COUNT(*) as request_count,
    AVG(duration_ms) as avg_duration_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99_duration_ms,
    COUNT(CASE WHEN status_code = 2 THEN 1 END) as error_count
FROM spans
GROUP BY service_name, operation_name, date_trunc('hour', start_time);

-- Index on materialized view
CREATE INDEX idx_span_stats_hourly_service_hour ON span_stats_hourly(service_name, hour);

-- Function to refresh materialized views (can be called periodically)
CREATE OR REPLACE FUNCTION refresh_span_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY span_stats_hourly;
END;
$$ LANGUAGE plpgsql;