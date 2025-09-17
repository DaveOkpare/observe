export function apiUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  if (base) {
    return `${base.replace(/\/$/, '')}${path}`;
  }
  return path; // rely on Next.js rewrites in dev or same-origin in prod
}

import type { 
  PaginatedResponse, 
  FetchTracesParams, 
  Trace, 
  TraceDetail 
} from '@/types/traces';

// Re-export types for convenience
export type { 
  PaginatedResponse, 
  FetchTracesParams, 
  Trace, 
  TraceDetail 
} from '@/types/traces';

export interface FetchLogsParams {
  limit?: number;
  offset?: number;
  level?: string;
  service?: string;
}

export async function fetchTraces(params: FetchTracesParams = {}): Promise<PaginatedResponse<Trace>> {
  const searchParams = new URLSearchParams();
  
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.offset) searchParams.set('offset', params.offset.toString());
  if (params.service) searchParams.set('service', params.service);
  if (params.operation) searchParams.set('operation', params.operation);
  
  const response = await fetch(apiUrl(`/v1/traces?${searchParams}`));
  if (!response.ok) throw new Error('Failed to fetch traces');
  
  const result = await response.json();
  
  // Transform backend response to frontend format
  const { transformTraceListResponse } = await import('./transformers');
  return transformTraceListResponse(result);
}

export async function fetchLogs(params: FetchLogsParams = {}): Promise<PaginatedResponse<any>> {
  const searchParams = new URLSearchParams();
  
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.offset) searchParams.set('offset', params.offset.toString());
  if (params.level) searchParams.set('level', params.level);
  if (params.service) searchParams.set('service', params.service);
  
  const response = await fetch(apiUrl(`/api/logs?${searchParams}`));
  if (!response.ok) throw new Error('Failed to fetch logs');
  
  const result = await response.json();
  return {
    data: result.data,  // Backend now returns 'data' instead of 'rows'
    pagination: result.pagination
  };
}

export interface AnnotationResponse {
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

export interface AnnotationRequest {
  feedback?: 'up' | 'down';
  annotation?: string;
}

export async function getTraceAnnotation(traceId: string): Promise<AnnotationResponse | null> {
  try {
    const response = await fetch(apiUrl(`/api/traces/${traceId}/annotation`));
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Failed to fetch annotation');
    return await response.json();
  } catch (error) {
    console.error('Error fetching annotation:', error);
    return null;
  }
}

export async function saveTraceAnnotation(
  traceId: string, 
  data: AnnotationRequest
): Promise<AnnotationResponse> {
  const response = await fetch(apiUrl(`/api/traces/${traceId}/annotation`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to save annotation');
  return await response.json();
}

export async function generateAIAnnotation(traceId: string): Promise<AnnotationResponse> {
  const response = await fetch(apiUrl(`/api/traces/${traceId}/ai-annotate`), {
    method: 'POST'
  });
  if (!response.ok) throw new Error('Failed to generate AI annotation');
  return await response.json();
}

export async function fetchTraceDetail(traceId: string): Promise<TraceDetail> {
  const response = await fetch(apiUrl(`/v1/traces/${traceId}`));
  if (!response.ok) throw new Error('Failed to fetch trace detail');
  
  const result = await response.json();
  
  // Transform backend response to frontend format
  const { transformTraceDetail } = await import('./transformers');
  return transformTraceDetail(result);
}