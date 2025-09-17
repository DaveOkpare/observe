"use client";

export interface SpanAnalysis {
  // Discovered patterns
  namespaces: Set<string>                    // ['gen_ai', 'logfire', 'pydantic_ai']
  conversationSources: string[]              // ['pydantic_ai.all_messages', 'events']
  platformHints: string[]                    // ['logfire', 'openai', 'anthropic']
  
  // Capabilities
  hasConversation: boolean                   // Any conversation data found
  hasLogfireConversation: boolean            // Pydantic AI format detected
  hasGenAIIndicators: boolean                // Any AI-related attributes
  hasTokenUsage: boolean                     // Token counting available
  hasToolCalls: boolean                      // Tool/function calls present
  
  // Parsed data (cached for performance)
  conversations: ConversationData[]          // All found conversations
  metrics: Record<string, number>            // Extracted numeric values
  identifiers: Record<string, string>        // Names, IDs, etc.
  platformData: Record<string, any>          // Platform-specific attributes
}

export interface ConversationData {
  source: string                             // Attribute name where found
  format: 'pydantic_ai' | 'openai' | 'unknown'
  messages: NormalizedMessage[]              // Standardized message format
  systemPrompt: string                       // Extracted system prompt
  toolCalls: ToolCall[]                      // Extracted tool interactions
  messageCount: number                       // Number of messages
}

export interface NormalizedMessage {
  role: string                               // 'user', 'assistant', 'system'
  content: string                            // Extracted text content
  toolCalls?: ToolCall[]                     // Tool calls in this message
  toolResponses?: ToolResponse[]             // Tool responses in this message
  originalFormat: any                        // Raw data for debugging
}

export interface ToolCall {
  id?: string
  name: string
  arguments: any
}

export interface ToolResponse {
  id?: string
  name?: string
  result?: any
  content?: string
}

// Core analysis function (non-cached)
function analyzeSpanCore(span: any): SpanAnalysis {
  try {
    const attrs = span?.attributes || {}
    const namespaces = extractNamespaces(attrs)
    
    return {
      namespaces,
      conversationSources: findConversationSources(attrs),
      platformHints: detectPlatformHints(attrs, namespaces),
      hasLogfireConversation: !!attrs['pydantic_ai.all_messages'],
      hasConversation: hasAnyConversationData(attrs),
      hasGenAIIndicators: hasGenAIAttributes(attrs, namespaces),
      hasTokenUsage: !!(attrs['gen_ai.usage.input_tokens'] || attrs['gen_ai.usage.output_tokens']),
      hasToolCalls: hasToolCallData(attrs),
      conversations: parseAllConversations(attrs),
      metrics: extractMetrics(attrs),
      identifiers: extractIdentifiers(attrs),
      platformData: extractPlatformData(attrs, namespaces)
    }
  } catch (error) {
    console.warn('Error analyzing span:', error)
    // Return safe defaults
    return {
      namespaces: new Set(),
      conversationSources: [],
      platformHints: [],
      hasLogfireConversation: false,
      hasConversation: false,
      hasGenAIIndicators: false,
      hasTokenUsage: false,
      hasToolCalls: false,
      conversations: [],
      metrics: {},
      identifiers: {},
      platformData: {}
    }
  }
}

// Public cached analysis function
export function analyzeSpan(span: any): SpanAnalysis {
  // Import cache lazily to avoid circular dependencies
  const { getCachedSpanAnalysis } = require('./spanCache');
  return getCachedSpanAnalysis(span, analyzeSpanCore);
}

function extractNamespaces(attributes: Record<string, any>): Set<string> {
  return new Set(
    Object.keys(attributes)
      .map(key => key.split('.')[0])
      .filter(ns => ns.length > 0)
  )
}

function findConversationSources(attrs: Record<string, any>): string[] {
  const potentialSources = [
    'pydantic_ai.all_messages',    // Logfire/Pydantic AI
    'gen_ai.input.messages',       // OpenTelemetry standard
    'gen_ai.output.messages',      // OpenTelemetry standard
    'all_messages_events',         // Legacy format
    'events'                       // Generic events
  ]
  
  return potentialSources.filter(source => {
    const value = attrs[source]
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) && parsed.length > 0 && 
               parsed.some(item => item?.role || item?.message || item?.parts)
      } catch {
        return false
      }
    }
    return false
  })
}

function detectPlatformHints(attrs: Record<string, any>, namespaces: Set<string>): string[] {
  const hints = []
  
  // Check for explicit platform indicators
  if (namespaces.has('logfire')) hints.push('logfire')
  if (namespaces.has('pydantic_ai')) hints.push('pydantic_ai')
  if (attrs['gen_ai.provider.name']) hints.push(attrs['gen_ai.provider.name'])
  
  // Infer from model names
  const model = attrs['gen_ai.request.model'] || attrs['model_name'] || ''
  if (model.toLowerCase().includes('gpt')) hints.push('openai')
  if (model.toLowerCase().includes('claude')) hints.push('anthropic')
  
  // Check system indicators
  const system = attrs['gen_ai.system']
  if (system === 'openai') hints.push('openai')
  if (system === 'anthropic') hints.push('anthropic')
  if (system === 'test') hints.push('test_provider')
  
  return [...new Set(hints)] // Remove duplicates
}

function hasAnyConversationData(attrs: Record<string, any>): boolean {
  return findConversationSources(attrs).length > 0
}

function hasGenAIAttributes(attrs: Record<string, any>, namespaces: Set<string>): boolean {
  return namespaces.has('gen_ai') || 
         namespaces.has('pydantic_ai') ||
         !!attrs['model_name'] ||
         !!attrs['agent_name']
}

function hasToolCallData(attrs: Record<string, any>): boolean {
  // Check if any conversation contains tool calls
  const conversations = parseAllConversations(attrs)
  return conversations.some(conv => conv.toolCalls.length > 0)
}

function parseAllConversations(attributes: Record<string, any>): ConversationData[] {
  const conversations = []
  const sources = findConversationSources(attributes)
  
  for (const source of sources) {
    const conversation = parseConversationSource(attributes[source], source)
    if (conversation) {
      conversations.push(conversation)
    }
  }
  
  return conversations
}

function parseConversationSource(data: any, source: string): ConversationData | null {
  try {
    const parsed = safeJsonParse(data, null)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    
    const format = detectMessageFormat(parsed[0])
    
    switch (format) {
      case 'pydantic_ai':
        return parsePydanticAIFormat(parsed, source)
      case 'openai':
        return parseOpenAIFormat(parsed, source)
      default:
        return parseUnknownFormat(parsed, source)
    }
  } catch (error) {
    console.warn(`Error parsing conversation from ${source}:`, error)
    return null
  }
}

function detectMessageFormat(message: any): 'pydantic_ai' | 'openai' | 'unknown' {
  if (message?.parts && Array.isArray(message.parts)) {
    return 'pydantic_ai'
  }
  if (message?.role && (message?.content || message?.message)) {
    return 'openai'
  }
  return 'unknown'
}

function parsePydanticAIFormat(messages: any[], source: string): ConversationData {
  try {
    const normalizedMessages = messages.map(msg => {
      try {
        return {
          role: msg?.role || 'unknown',
          content: extractContentFromParts(msg?.parts || []),
          toolCalls: (msg?.parts || []).filter(p => p?.type === 'tool_call'),
          toolResponses: (msg?.parts || []).filter(p => p?.type === 'tool_call_response'),
          originalFormat: msg
        }
      } catch (error) {
        console.warn('Error processing Pydantic AI message:', error)
        return {
          role: 'unknown',
          content: JSON.stringify(msg),
          toolCalls: [],
          toolResponses: [],
          originalFormat: msg
        }
      }
    })
    
    return {
      source,
      format: 'pydantic_ai',
      messages: normalizedMessages,
      systemPrompt: '', // Pydantic AI stores system prompts separately
      toolCalls: extractAllToolCalls(normalizedMessages),
      messageCount: messages.length
    }
  } catch (error) {
    console.warn('Error parsing Pydantic AI format:', error)
    return createErrorConversation(source, 'pydantic_ai', messages.length)
  }
}

function extractContentFromParts(parts: any[]): string {
  return parts
    .filter(part => part.type === 'text')
    .map(part => part.content)
    .join('\n')
}

function parseOpenAIFormat(messages: any[], source: string): ConversationData {
  const systemPrompt = messages.find(m => m.role === 'system')?.content || ''
  const conversationMessages = messages.filter(m => m.role !== 'system')
  
  const normalizedMessages = conversationMessages.map(msg => ({
    role: msg.role,
    content: msg.content || msg.message || '',
    toolCalls: msg.tool_calls || [],
    toolResponses: msg.role === 'tool' ? [{ content: msg.content }] : [],
    originalFormat: msg
  }))
  
  return {
    source,
    format: 'openai',
    messages: normalizedMessages,
    systemPrompt,
    toolCalls: extractAllToolCalls(normalizedMessages),
    messageCount: messages.length
  }
}

function parseUnknownFormat(messages: any[], source: string): ConversationData {
  const normalizedMessages = messages.map(msg => ({
    role: msg.role || msg.sender || msg.type || 'unknown',
    content: msg.content || msg.message || msg.text || JSON.stringify(msg),
    toolCalls: [],
    toolResponses: [],
    originalFormat: msg
  }))
  
  return {
    source,
    format: 'unknown',
    messages: normalizedMessages,
    systemPrompt: '',
    toolCalls: [],
    messageCount: messages.length
  }
}

function extractAllToolCalls(messages: NormalizedMessage[]): ToolCall[] {
  const toolCalls: ToolCall[] = []
  
  messages.forEach(msg => {
    if (msg.toolCalls) {
      toolCalls.push(...msg.toolCalls)
    }
  })
  
  return toolCalls
}

function extractMetrics(attributes: Record<string, any>): Record<string, number> {
  const metrics: Record<string, number> = {}
  
  // Token usage
  const inputTokens = Number(attributes['gen_ai.usage.input_tokens'] || 0)
  const outputTokens = Number(attributes['gen_ai.usage.output_tokens'] || 0)
  if (inputTokens > 0) metrics.inputTokens = inputTokens
  if (outputTokens > 0) metrics.outputTokens = outputTokens
  if (inputTokens > 0 || outputTokens > 0) metrics.totalTokens = inputTokens + outputTokens
  
  // Duration
  if (attributes.duration_ms) metrics.durationMs = Number(attributes.duration_ms)
  
  // Cache metrics
  if (attributes.cache_hit !== undefined) metrics.cacheHit = attributes.cache_hit ? 1 : 0
  
  return metrics
}

function extractIdentifiers(attributes: Record<string, any>): Record<string, string> {
  const identifiers: Record<string, string> = {}
  
  // Common identifiers
  if (attributes.agent_name) identifiers.agentName = attributes.agent_name
  if (attributes.model_name) identifiers.modelName = attributes.model_name
  if (attributes['gen_ai.request.model']) identifiers.model = attributes['gen_ai.request.model']
  if (attributes.cache_key) identifiers.cacheKey = attributes.cache_key
  if (attributes.operation) identifiers.operation = attributes.operation
  
  return identifiers
}

function extractPlatformData(attrs: Record<string, any>, namespaces: Set<string>): Record<string, any> {
  const platformData: Record<string, any> = {}
  
  namespaces.forEach(namespace => {
    const nsData: Record<string, any> = {}
    Object.entries(attrs).forEach(([key, value]) => {
      if (key.startsWith(`${namespace}.`)) {
        const shortKey = key.substring(namespace.length + 1)
        nsData[shortKey] = value
      } else if (key === namespace) {
        nsData['_value'] = value
      }
    })
    if (Object.keys(nsData).length > 0) {
      platformData[namespace] = nsData
    }
  })
  
  return platformData
}

function safeJsonParse<T = any>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return (value as T) ?? fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function createErrorConversation(source: string, format: 'pydantic_ai' | 'openai' | 'unknown', messageCount: number): ConversationData {
  return {
    source,
    format,
    messages: [{
      role: 'system',
      content: `Error parsing ${format} conversation from ${source}`,
      toolCalls: [],
      toolResponses: [],
      originalFormat: null
    }],
    systemPrompt: '',
    toolCalls: [],
    messageCount
  }
}