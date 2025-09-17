/**
 * Data transformation layer for converting backend responses to frontend-expected format
 */

// Backend data structures (what we actually get)
export interface BackendTrace {
  trace_id: string;
  span_count: number;
  start_time: string;
  end_time: string;
  duration_ms: number;
  name: string;
  service_name: string;
}

export interface BackendSpan {
  id: string;
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  name: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  kind: number;
  attributes: Record<string, any>;
  service_name: string;
}

export interface BackendTraceListResponse {
  success: boolean;
  rows: BackendTrace[];
  count: number;
  pagination: {
    offset: number;
    limit: number;
    total: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface BackendTraceDetailResponse {
  success: boolean;
  rows: BackendSpan[];
  count: number;
  trace_id: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  service_name?: string;
  operation_name?: string;
}

// Frontend data structures (what components expect)
export interface FrontendTrace {
  trace_id: string;
  span_count: number;
  start_time: string;
  end_time: string;
  duration_ms: number;
  operation_name: string;  // mapped from 'name'
  service_name: string;    // mapped from backend service_name
  status: string;          // derived or defaulted
}

export interface FrontendSpan {
  id: string;
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  name: string;
  operation_name: string;  // same as name for spans
  service_name: string;    // extracted from attributes
  start_time: string;
  end_time: string;
  duration_ms: number;
  kind: number;
  status: string;          // derived from kind + attributes
  attributes: Record<string, any>;
}

export interface FrontendTraceDetail {
  trace_id: string;
  operation_name: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  span_count: number;
  status: string;
  spans: FrontendSpan[];
}

// Note: Service name extraction is no longer needed as it's now stored in the database
// and provided directly in the backend response

/**
 * Derive status from multiple error indicators with priority
 */
export function deriveStatus(attributes?: Record<string, any>, kind?: number): string {
  if (!attributes) return "ok";

  // Check explicit error indicators (highest priority)
  const errorKeys = ['error', 'error.message', 'exception', 'exception.message', 'exception.type'];
  for (const key of errorKeys) {
    if (attributes[key]) {
      return "error";
    }
  }
  
  // Check OpenTelemetry status (high priority)
  if (attributes['otel.status_code'] === 'ERROR' || attributes['status.code'] === 2) {
    return "error";
  }
  
  // Check HTTP status codes (medium priority)
  const httpStatus = attributes['http.status_code'] || attributes['http.response.status_code'];
  if (httpStatus) {
    const statusCode = parseInt(String(httpStatus));
    if (statusCode >= 400) {
      return "error";
    }
  }
  
  // Check database errors (medium priority)
  if (attributes['db.operation'] && (
    attributes['db.error'] || 
    (attributes['db.statement'] && attributes['db.statement'].toLowerCase().includes('error'))
  )) {
    return "error";
  }
  
  // Check custom error fields (low priority)
  const customErrorKeys = ['failed', 'failure', 'timeout', 'cancelled'];
  for (const key of customErrorKeys) {
    if (attributes[key] === true || attributes[key] === 'true') {
      return "error";
    }
  }
  
  return "ok";
}

/**
 * Clean and enhance operation names
 */
export function extractOperationName(name: string, attributes?: Record<string, any>): string {
  if (!name) return "unknown-operation";
  
  // Use the name as-is for most cases, but could enhance with attributes
  // e.g., HTTP method + route: "GET /api/users"
  if (attributes?.['http.method'] && attributes?.['http.route']) {
    return `${attributes['http.method']} ${attributes['http.route']}`;
  }
  
  return name;
}

/**
 * Transform backend trace to frontend format with error handling
 */
export function transformTrace(backendTrace: BackendTrace): FrontendTrace {
  if (!backendTrace || typeof backendTrace !== 'object') {
    console.warn('Invalid trace data received:', backendTrace);
    throw new Error('Invalid trace data');
  }

  return {
    trace_id: backendTrace.trace_id || 'unknown',
    span_count: backendTrace.span_count || 0,
    start_time: backendTrace.start_time || new Date().toISOString(),
    end_time: backendTrace.end_time || new Date().toISOString(),
    duration_ms: backendTrace.duration_ms || 0,
    operation_name: backendTrace.name || 'unknown-operation',
    service_name: backendTrace.service_name || 'unknown-service',
    status: "ok"                       // No status info in trace list  
  };
}

/**
 * Transform backend span to frontend format with attribute extraction and error handling
 */
export function transformSpan(backendSpan: BackendSpan): FrontendSpan {
  if (!backendSpan || typeof backendSpan !== 'object') {
    console.warn('Invalid span data received:', backendSpan);
    throw new Error('Invalid span data');
  }

  try {
    // Use database-provided service_name instead of extracting from attributes
    const serviceName = backendSpan.service_name || 'unknown-service';
    const status = deriveStatus(backendSpan.attributes, backendSpan.kind);
    const operationName = extractOperationName(backendSpan.name || 'unknown-operation', backendSpan.attributes);
    
    return {
      id: backendSpan.id || 'unknown',
      trace_id: backendSpan.trace_id || 'unknown',
      span_id: backendSpan.span_id || 'unknown',
      parent_span_id: backendSpan.parent_span_id,
      name: backendSpan.name || 'unknown-operation',
      operation_name: operationName,
      service_name: serviceName,
      start_time: backendSpan.start_time || new Date().toISOString(),
      end_time: backendSpan.end_time || new Date().toISOString(),
      duration_ms: backendSpan.duration_ms || 0,
      kind: backendSpan.kind || 0,
      status: status,
      attributes: backendSpan.attributes || {}
    };
  } catch (error) {
    console.warn('Error transforming span:', error, backendSpan);
    // Return a minimal valid span object to prevent crashes
    return {
      id: backendSpan.id || 'error',
      trace_id: backendSpan.trace_id || 'unknown',
      span_id: backendSpan.span_id || 'error',
      parent_span_id: backendSpan.parent_span_id,
      name: 'Error parsing span',
      operation_name: 'Error',
      service_name: 'unknown-service',
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      duration_ms: 0,
      kind: 0,
      status: 'error',
      attributes: {}
    };
  }
}

/**
 * Transform backend trace detail response to frontend format
 */
export function transformTraceDetail(backendResponse: BackendTraceDetailResponse): FrontendTraceDetail {
  if (!backendResponse.success || !backendResponse.rows || backendResponse.rows.length === 0) {
    throw new Error('Invalid trace detail response');
  }
  
  // Transform all spans
  const transformedSpans = backendResponse.rows.map(transformSpan);
  
  // Use backend-provided trace-level metadata or derive from root span
  const rootSpan = transformedSpans.find(span => !span.parent_span_id) || transformedSpans[0];
  const traceLevelServiceName = backendResponse.service_name || rootSpan?.service_name || 'unknown-service';
  const traceLevelOperationName = backendResponse.operation_name || rootSpan?.operation_name || 'unknown-operation';
  const traceLevelStatus = transformedSpans.some(span => span.status === 'error') ? 'error' : 'ok';
  
  return {
    trace_id: backendResponse.trace_id,
    operation_name: traceLevelOperationName,
    service_name: traceLevelServiceName,
    start_time: backendResponse.start_time,
    end_time: backendResponse.end_time,
    duration_ms: backendResponse.duration_ms,
    span_count: backendResponse.count,
    status: traceLevelStatus,
    spans: transformedSpans
  };
}

/**
 * Transform backend trace list response to frontend pagination format with error handling
 */
export function transformTraceListResponse(backendResponse: BackendTraceListResponse) {
  if (!backendResponse || typeof backendResponse !== 'object') {
    console.error('Invalid backend response:', backendResponse);
    throw new Error('Invalid response from backend');
  }

  if (!backendResponse.success) {
    const errorMessage = (backendResponse as any).error || 'Unknown backend error';
    console.error('Backend returned error:', errorMessage);
    throw new Error(`Backend error: ${errorMessage}`);
  }
  
  if (!Array.isArray(backendResponse.rows)) {
    console.error('Backend response missing rows array:', backendResponse);
    throw new Error('Invalid response format: missing traces data');
  }

  try {
    const transformedTraces = backendResponse.rows.map((trace, index) => {
      try {
        return transformTrace(trace);
      } catch (error) {
        console.warn(`Failed to transform trace at index ${index}:`, error, trace);
        // Return a minimal valid trace to prevent total failure
        return {
          trace_id: trace?.trace_id || `error-${index}`,
          span_count: 0,
          start_time: new Date().toISOString(),
          end_time: new Date().toISOString(),
          duration_ms: 0,
          operation_name: 'Error parsing trace',
          status: 'error'
        };
      }
    });
    
    return {
      data: transformedTraces,
      pagination: {
        offset: backendResponse.pagination?.offset || 0,
        limit: backendResponse.pagination?.limit || 50, 
        total: backendResponse.pagination?.total || 0,
        has_more: backendResponse.pagination?.has_next || false,
        has_prev: backendResponse.pagination?.has_prev || false
      }
    };
  } catch (error) {
    console.error('Failed to transform trace list:', error);
    throw new Error('Failed to process trace data');
  }
}