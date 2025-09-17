/**
 * TypeScript interfaces for observability data structures
 * These align with the transformed data from our backend API
 */

// Main trace interface used across components
export interface Trace {
  trace_id: string;
  span_count: number;
  start_time: string;
  end_time: string;
  duration_ms: number;
  operation_name: string;  // Transformed from backend 'name' field
  service_name: string;    // Service name from database
  status: string;          // Derived from span data or defaulted
}

// Individual span within a trace
export interface Span {
  id: string;              // Database UUID
  trace_id: string;
  span_id: string;         // OpenTelemetry span ID
  parent_span_id?: string; // For building span hierarchy
  name: string;            // Raw span name
  operation_name: string;  // Cleaned operation name
  service_name: string;    // Extracted service name
  start_time: string;      // ISO timestamp
  end_time: string;        // ISO timestamp
  duration_ms: number;     // Calculated duration
  kind: number;            // OpenTelemetry span kind (0-5)
  status: string;          // Derived status (ok, error, etc.)
  attributes: Record<string, any>; // JSONB attributes from backend
}

// Complete trace detail with spans
export interface TraceDetail {
  trace_id: string;
  operation_name: string;
  service_name: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  span_count: number;
  status: string;
  spans: Span[];           // Array of transformed spans
}

// Pagination structure used by API responses
export interface PaginationInfo {
  offset: number;
  limit: number;
  total: number;
  has_more: boolean;       // Mapped from backend 'has_next'
  has_prev: boolean;
}

// Generic paginated response wrapper
export interface PaginatedResponse<T> {
  data: T[];               // Mapped from backend 'rows'
  pagination: PaginationInfo;
}

// API parameter interfaces
export interface FetchTracesParams {
  limit?: number;
  offset?: number;
  service?: string;
  operation?: string;
  start_time?: string;
  end_time?: string;
}

// Metrics data for dashboard
export interface TraceMetrics {
  totalTraces: number;
  avgDuration: number;
  errorRate: number;
  activeServices: number;
}

// Log interface (for future use)
export interface Log {
  id: string;
  trace_id?: string;
  service_name: string;
  timestamp: string;
  level: string;
  message: string;
  attributes?: Record<string, any>;
}

// Annotation interfaces
export interface Annotation {
  id: string;
  trace_id: string;
  service_name: string;
  feedback: 'up' | 'down' | null;
  annotation: string | null;
  is_human: boolean;
  confidence_category: 'high' | 'medium' | 'low' | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAnnotationRequest {
  feedback?: 'up' | 'down';
  annotation?: string;
}