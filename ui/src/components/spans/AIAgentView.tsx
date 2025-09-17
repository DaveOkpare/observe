"use client";

import React from "react";
import { parseAIConversation } from "@/lib/attributeParsers";
import TokenUsageBadge from "./TokenUsageBadge";
import CopyButton from "../CopyButton";
import JsonCode from "../JsonCode";

interface AIAgentViewProps {
  messages: any;
  finalResult: any;
  tokenUsage: { input: number; output: number; total: number };
  modelName?: string;
  agentName?: string;
}

export default function AIAgentView({ messages, finalResult, tokenUsage, modelName, agentName }: AIAgentViewProps) {
  const conversation = parseAIConversation(messages);

  const renderAgentContent = (content: any) => {
    if (content == null) return <div className="text-sm text-muted-foreground">—</div>
    if (typeof content !== 'string') return <JsonCode value={content} />
    const t = content.trim()
    const looksJson = t.startsWith('{') || t.startsWith('[')
    if (looksJson) {
      try { return <JsonCode value={JSON.parse(t)} /> } catch {/* fallthrough */}
    }
    const fence = /```[a-zA-Z0-9_-]*\n([\s\S]*?)```/m.exec(t)
    if (fence && fence[1]) {
      return (
        <pre className="text-xs bg-muted dark:bg-gray-800 p-2 rounded overflow-auto whitespace-pre-wrap">{fence[1]}</pre>
      )
    }
    return <div className="text-sm whitespace-pre-wrap">{content}</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">AI Agent Run{agentName ? `: ${agentName}` : ''}</h3>
          {modelName && <p className="text-xs text-muted-foreground">Model: {modelName}</p>}
        </div>
        {tokenUsage?.total > 0 && <TokenUsageBadge {...tokenUsage} model={modelName} />}
      </div>

      {conversation.systemPrompt && (
        <div>
          <button className="text-xs underline text-muted-foreground hover:text-foreground" onClick={() => {
            const el = document.getElementById("system-prompt");
            if (el) el.classList.toggle("hidden");
          }}>System Prompt</button>
          <pre id="system-prompt" className="text-xs bg-muted dark:bg-gray-800 p-3 rounded mt-2 whitespace-pre-wrap hidden">
            {conversation.systemPrompt}
          </pre>
        </div>
      )}

      <div className="space-y-2">
        {conversation.conversation.map((m: any, idx: number) => (
          <div key={idx} className={`p-2 rounded border ${m.role === 'user' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' : 'bg-muted dark:bg-gray-800'}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-muted-foreground">{m.role}</div>
              <CopyButton getText={() => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content, null, 2))} />
            </div>
            <div>{renderAgentContent(m.content)}</div>
          </div>
        ))}
      </div>

      {/* Tool calls and responses if present */}
      {((conversation.toolCalls?.length ?? 0) + (conversation.toolResponses?.length ?? 0) > 0) ? (
        <div className="space-y-2">
          {conversation.toolCalls?.map((t: any, i: number) => (
            <div key={`call-${i}`} className="rounded border p-2 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium">Tool Call</div>
                <CopyButton getText={() => JSON.stringify(t, null, 2)} />
              </div>
              <JsonCode value={t} />
            </div>
          ))}
          {conversation.toolResponses?.map((r: any, i: number) => (
            <div key={`resp-${i}`} className="rounded border p-2 bg-purple-50/40 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium">Tool Response</div>
                <CopyButton getText={() => JSON.stringify(r, null, 2)} />
              </div>
              <JsonCode value={r} />
            </div>
          ))}
        </div>
      ) : null}

      {finalResult && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded p-2">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs uppercase tracking-wide text-green-800 dark:text-green-200">Final Result</div>
            <CopyButton getText={() => JSON.stringify(finalResult, null, 2)} />
          </div>
          {renderAgentContent(finalResult)}
        </div>
      )}
    </div>
  )
}