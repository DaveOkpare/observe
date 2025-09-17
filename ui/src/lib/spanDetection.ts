import { analyzeSpan } from './spanAnalysis'

export type SpanType =
  | 'logfire-conversation'    // NEW: Logfire Pydantic AI conversations
  | 'ai-conversation'         // NEW: Generic AI conversations
  | 'genai-operation'         // NEW: Other GenAI operations
  | 'cache-operation'         // NEW: Cache operations
  | 'fastapi-endpoint'        // NEW: FastAPI endpoints
  | 'adaptive'                // NEW: Universal fallback
  | 'ai-agent'                // EXISTING
  | 'llm-chat'                // EXISTING
  | 'function-model'          // EXISTING
  | 'http-request'            // EXISTING: Keep for compatibility
  | 'http-client'             // NEW: HTTP client requests
  | 'http-server'             // NEW: HTTP server requests
  | 'log-message'             // EXISTING
  | 'database'                // EXISTING
  | 'external-api'            // EXISTING
  | 'generic'                 // EXISTING: Will be replaced by 'adaptive'

export function detectSpanType(span: any): SpanType {
  const analysis = analyzeSpan(span)
  
  // Route based on discovered patterns, not hardcoded checks
  if (analysis.hasLogfireConversation) {
    return 'logfire-conversation'
  }
  
  if (analysis.hasConversation) {
    return 'ai-conversation'
  }
  
  if (analysis.hasGenAIIndicators) {
    return 'genai-operation'
  }
  
  if (analysis.namespaces.has('http')) {
    return span.kind === 2 ? 'http-server' : 'http-client'
  }
  
  if (analysis.namespaces.has('db')) {
    return 'database'
  }
  
  // Custom application patterns
  if (span.attributes?.cache_key !== undefined) {
    return 'cache-operation'
  }
  
  if (analysis.namespaces.has('fastapi')) {
    return 'fastapi-endpoint'
  }
  
  if (analysis.platformData.logfire?.span_type === 'log') {
    return 'log-message'
  }
  
  return 'adaptive' // Universal fallback
}

export function extractMeaningfulFields(attributes: Record<string, any> = {}) {
  const analysis = analyzeSpan({ attributes })
  
  // Use analysis data instead of manual filtering
  return {
    ...analysis.identifiers,
    ...analysis.metrics,
    // Add key attributes from each namespace
    ...Object.fromEntries(
      Object.entries(analysis.platformData).flatMap(([namespace, data]) => 
        Object.entries(data as Record<string, any>)
          .filter(([key, value]) => isSignificantValue(key, value))
          .map(([key, value]) => [`${namespace}.${key}`, value])
      )
    )
  }
}

function isSignificantValue(key: string, value: any): boolean {
  // Skip internal/noise attributes
  const noise = ['span_type', 'json_schema', 'otel_scope_version', '_value']
  if (noise.includes(key)) return false
  
  // Include important patterns
  const important = [
    'model', 'system', 'operation', 'method', 'status', 'error', 'exception',
    'tokens', 'cost', 'latency', 'duration', 'timestamp', 'name', 'id',
    'message', 'url', 'path', 'statement', 'cache'
  ]
  
  return important.some(pattern => key.toLowerCase().includes(pattern)) ||
         (typeof value === 'number' && value > 0) ||
         (typeof value === 'string' && value.length > 0 && value.length < 200)
}