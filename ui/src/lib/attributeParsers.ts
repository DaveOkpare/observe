export function safeJsonParse<T = any>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return (value as T) ?? fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function parseAIConversation(messages: unknown) {
  const arr = safeJsonParse<any[]>(messages, Array.isArray(messages) ? (messages as any[]) : [])
  
  // Check if this is Pydantic AI format (with parts)
  if (arr.length > 0 && arr[0]?.parts) {
    return parsePydanticAIConversation(arr)
  }
  
  // Handle OpenAI format
  const systemPrompt = arr.find((m) => m?.role === 'system')?.content || ''
  return {
    systemPrompt,
    conversation: arr.filter((m) => m?.role !== 'system'),
    toolCalls: arr.filter((m) => m?.role === 'assistant' && m?.tool_calls),
    toolResponses: arr.filter((m) => m?.role === 'tool'),
  }
}

export function parsePydanticAIConversation(messages: any[]) {
  const conversation = []
  const toolCalls = []
  const toolResponses = []
  let systemPrompt = ''
  
  for (const message of messages) {
    const { role, parts = [] } = message
    
    // Extract text content from parts
    const textParts = parts.filter((p: any) => p.type === 'text')
    const content = textParts.map((p: any) => p.content).join('\n')
    
    // Extract tool calls
    const toolCallParts = parts.filter((p: any) => p.type === 'tool_call')
    toolCalls.push(...toolCallParts)
    
    // Extract tool responses
    const toolResponseParts = parts.filter((p: any) => p.type === 'tool_call_response')
    toolResponses.push(...toolResponseParts)
    
    if (role === 'system') {
      systemPrompt = content
    } else if (content) {
      conversation.push({
        role,
        content,
        toolCalls: toolCallParts,
        toolResponses: toolResponseParts,
        originalParts: parts
      })
    }
  }
  
  return {
    systemPrompt,
    conversation,
    toolCalls,
    toolResponses,
    format: 'pydantic_ai'
  }
}

export function parseHTTPDetails(attributes: Record<string, any>) {
  const params = safeJsonParse<Record<string, any>>(attributes?.['fastapi.arguments.values'], {})
  const errors = safeJsonParse<any[]>(attributes?.['fastapi.arguments.errors'], [])

  return {
    method: attributes?.['http.method'] || '',
    path: attributes?.['http.route'] || attributes?.['http.target'] || '',
    url: attributes?.['http.url'] || '',
    status: Number(attributes?.['http.status_code'] ?? 0),
    params,
    errors,
    timing: {
      start: attributes?.['fastapi.endpoint_function.start_timestamp'] || null,
      end: attributes?.['fastapi.endpoint_function.end_timestamp'] || null,
    },
  }
}

export function parseTokenUsage(attributes: Record<string, any>) {
  const input = Number(attributes?.['gen_ai.usage.input_tokens'] ?? 0)
  const output = Number(attributes?.['gen_ai.usage.output_tokens'] ?? 0)
  return { input, output, total: input + output }
}