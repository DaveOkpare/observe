"use client";

import React from "react";
import TokenUsageBadge from "./TokenUsageBadge";

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <div className="font-medium">{system ? `${system}` : 'LLM'} {model ? `· ${model}` : ''}</div>
        </div>
        <TokenUsageBadge {...tokenUsage} />
      </div>
      <div className="space-y-2">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded border p-2 text-sm whitespace-pre-wrap ${bubbleClass(m.role)}`}>
              <div className="text-xs uppercase tracking-wide opacity-60 mb-1">{m.role}</div>
              <div>{extractText(m.content) || '—'}</div>
            </div>
          </div>
        ))}
      </div>
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
