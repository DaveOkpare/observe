"use client";

import React from "react";
import TokenUsageBadge from "./TokenUsageBadge";

interface LLMChatViewProps {
  events: any;
  model?: string;
  system?: string;
  tokenUsage: { input: number; output: number; total: number };
}

export default function LLMChatView({ events, model, system, tokenUsage }: LLMChatViewProps) {
  const arr: any[] = Array.isArray(events) ? events : (() => { try { return JSON.parse(events || '[]') } catch { return [] } })()
  const userMsg = arr.find((e) => e?.role === 'user')
  const assistantMsg = arr.find((e) => e?.role === 'assistant')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <div className="font-medium">{system ? `${system}` : 'LLM'} {model ? `· ${model}` : ''}</div>
        </div>
        <TokenUsageBadge {...tokenUsage} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-xs font-medium mb-1">Request</div>
          <div className="rounded border bg-muted p-2 text-sm whitespace-pre-wrap">
            {userMsg?.content || '—'}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium mb-1">Response</div>
          <div className="rounded border bg-muted p-2 text-sm whitespace-pre-wrap">
            {assistantMsg?.content || '—'}
          </div>
        </div>
      </div>
    </div>
  )
}

