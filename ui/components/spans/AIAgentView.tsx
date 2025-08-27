"use client";

import React from "react";
import { parseAIConversation } from "@/lib/attributeParsers";
import TokenUsageBadge from "./TokenUsageBadge";

interface AIAgentViewProps {
  messages: any;
  finalResult: any;
  tokenUsage: { input: number; output: number; total: number };
  modelName?: string;
  agentName?: string;
}

export default function AIAgentView({ messages, finalResult, tokenUsage, modelName, agentName }: AIAgentViewProps) {
  const conversation = parseAIConversation(messages);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">AI Agent Run{agentName ? `: ${agentName}` : ''}</h3>
          {modelName && <p className="text-xs text-muted-foreground">Model: {modelName}</p>}
        </div>
        <TokenUsageBadge {...tokenUsage} />
      </div>

      {conversation.systemPrompt && (
        <div>
          <button className="text-xs underline text-muted-foreground hover:text-foreground" onClick={() => {
            const el = document.getElementById("system-prompt");
            if (el) el.classList.toggle("hidden");
          }}>System Prompt</button>
          <pre id="system-prompt" className="text-xs bg-muted p-3 rounded mt-2 whitespace-pre-wrap hidden">
            {conversation.systemPrompt}
          </pre>
        </div>
      )}

      <div className="space-y-2">
        {conversation.conversation.map((m: any, idx: number) => (
          <div key={idx} className={`p-2 rounded border ${m.role === 'user' ? 'bg-blue-50 border-blue-200' : 'bg-muted'}`}>
            <div className="text-xs text-muted-foreground mb-1">{m.role}</div>
            <div className="text-sm whitespace-pre-wrap">{typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}</div>
          </div>
        ))}
      </div>

      {finalResult && (
        <div className="bg-green-50 border border-green-200 rounded p-3">
          <h4 className="font-medium text-green-800 mb-2">Final Result</h4>
          <pre className="text-xs text-green-800 whitespace-pre-wrap">{JSON.stringify(finalResult, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

