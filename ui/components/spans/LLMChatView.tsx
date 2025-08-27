"use client";

import React from "react";
import TokenUsageBadge from "./TokenUsageBadge";
import CopyButton from "../CopyButton";

interface LLMChatViewProps {
  events: any;
  model?: string;
  system?: string;
  tokenUsage: { input: number; output: number; total: number };
  fallbackAssistantText?: string;
}

function extractText(v: any): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(extractText).filter(Boolean).join('\n')
  if (typeof v === 'object') {
    if (typeof v.text === 'string') return v.text
    if (v.content !== undefined) return extractText(v.content)
    if (Array.isArray((v as any).parts)) return (v as any).parts.map(extractText).join('\n')
    if (typeof (v as any).message === 'string') return (v as any).message
    const textyKey = ['output_text', 'response', 'value'].find((k) => typeof (v as any)[k] === 'string')
    if (textyKey) return (v as any)[textyKey]
  }
  return ''
}

export default function LLMChatView({ events, model, system, tokenUsage, fallbackAssistantText }: LLMChatViewProps) {
  const arr: any[] = Array.isArray(events) ? events : (() => { try { return JSON.parse(events || '[]') } catch { return [] } })()
  // Normalize events into simple { role, content }
  const normalized = arr.flatMap((e) => {
    const role = (e?.role || e?.message?.role || '').toString().toLowerCase()
    if (!role) return []
    const content = e?.content ?? e?.message?.content ?? e?.text ?? e?.output_text ?? e?.response ?? e?.parts ?? e?.message
    return [{ role, content }]
  })
  const messages = normalized.filter((m) => ['user', 'assistant', 'system', 'tool'].includes(m.role))
  const hasAssistant = messages.some((m) => m.role === 'assistant')
  if (fallbackAssistantText && !hasAssistant) messages.push({ role: 'assistant', content: fallbackAssistantText })

  // Extract system prompt if present
  const systemMsg = messages.find((m) => m.role === 'system')

  // Tool calls/responses (heuristic from events stream)
  type ToolItem = { type: 'call' | 'result'; name?: string; args?: any; result?: any; raw?: any }
  const toolItems: ToolItem[] = arr.flatMap((e) => {
    const items: ToolItem[] = []
    const ename = (e?.['event.name'] || e?.event?.name || '').toString().toLowerCase()
    // Common assistant tool_calls array (OpenAI-like)
    if (Array.isArray(e?.tool_calls)) {
      for (const tc of e.tool_calls) {
        const fn = tc.function || tc.tool || {}
        items.push({ type: 'call', name: fn.name, args: fn.arguments ?? tc.arguments, raw: tc })
      }
    }
    // Explicit tool call event
    if (ename.includes('tool_call')) {
      items.push({ type: 'call', name: e?.tool?.name, args: e?.tool?.arguments, raw: e })
    }
    // Tool response/content (role=tool)
    const role = (e?.role || e?.message?.role || '').toString().toLowerCase()
    if (role === 'tool') {
      items.push({ type: 'result', result: e?.content ?? e?.message?.content ?? e?.output_text ?? e?.response, raw: e })
    }
    if (ename.includes('tool.result')) {
      items.push({ type: 'result', result: e?.result ?? e?.content, raw: e })
    }
    return items
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <div className="font-medium">{system ? `${system}` : 'LLM'} {model ? `· ${model}` : ''}</div>
        </div>
        <TokenUsageBadge {...tokenUsage} />
      </div>
      {!!systemMsg && (
        <div>
          <button
            className="text-xs underline text-muted-foreground hover:text-foreground"
            onClick={() => {
              const el = document.getElementById("llm-system-prompt")
              if (el) el.classList.toggle("hidden")
            }}
          >
            System Prompt
          </button>
          <div className="flex items-center justify-end mb-1">
            <CopyButton getText={() => extractText(systemMsg.content)} />
          </div>
          <pre id="llm-system-prompt" className="text-xs bg-muted p-3 rounded mt-1 whitespace-pre-wrap hidden">{extractText(systemMsg.content)}</pre>
        </div>
      )}

      <div className="space-y-2">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded border p-2 text-sm whitespace-pre-wrap ${bubbleClass(m.role)}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs uppercase tracking-wide opacity-60">{m.role}</div>
                <CopyButton getText={() => extractText(m.content) || ''} />
              </div>
              <div>{extractText(m.content) || '—'}</div>
            </div>
          </div>
        ))}
      </div>

      {toolItems.length > 0 && (
        <div className="space-y-2">
          {toolItems.map((t, i) => (
            <div key={i} className={`rounded border p-2 text-sm ${t.type === 'call' ? 'bg-purple-50 border-purple-200' : 'bg-purple-50/40 border-purple-200'}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs uppercase tracking-wide opacity-60">{t.type === 'call' ? 'Tool Call' : 'Tool Result'}</div>
                <CopyButton getText={() => JSON.stringify(t.raw ?? t, null, 2)} />
              </div>
              {t.type === 'call' ? (
                <div>
                  <div className="text-xs"><span className="font-medium">Name:</span> {t.name || '—'}</div>
                  {t.args && (
                    <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-56 mt-1">{JSON.stringify(t.args, null, 2)}</pre>
                  )}
                </div>
              ) : (
                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-56">{typeof t.result === 'string' ? t.result : JSON.stringify(t.result, null, 2)}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function bubbleClass(role: string) {
  switch (role) {
    case 'user':
      return 'bg-blue-50 border-blue-200'
    case 'assistant':
      return 'bg-muted border-border'
    case 'system':
      return 'bg-yellow-50 border-yellow-200'
    case 'tool':
      return 'bg-purple-50 border-purple-200'
    default:
      return 'bg-muted border-border'
  }
}
