"use client";

import React, { useState } from "react";
import { analyzeSpan, type ConversationData, type NormalizedMessage } from "@/lib/spanAnalysis";
import { parsePydanticAIConversation } from "@/lib/attributeParsers";
import { useSpanConfig } from "@/lib/spanConfig";
import CopyButton from "../CopyButton";
import JsonCode from "../JsonCode";

interface LogfireConversationViewProps {
  span: any;
}

export default function LogfireConversationView({ span }: LogfireConversationViewProps) {
  const { config } = useSpanConfig();
  
  let analysis;
  let conversation;
  
  try {
    analysis = analyzeSpan(span);
    conversation = analysis.conversations[0]; // Primary conversation
    
    if (!conversation) {
      return (
        <div className="p-4 border rounded-lg bg-red-50 border-red-200">
          <p className="text-red-700 font-medium">No conversation data found</p>
          <p className="text-sm text-red-600 mt-1">
            Expected Logfire conversation but could not parse conversation data.
          </p>
          <details className="mt-2">
            <summary className="text-xs text-red-500 cursor-pointer">Debug info</summary>
            <pre className="text-xs bg-red-100 p-2 rounded mt-1 overflow-auto">
              {JSON.stringify({ 
                hasLogfireData: !!span?.attributes?.['pydantic_ai.all_messages'],
                attributeKeys: Object.keys(span?.attributes || {}),
                conversationSources: analysis.conversationSources
              }, null, 2)}
            </pre>
          </details>
        </div>
      );
    }

    // Check if conversation parsing failed
    if (conversation.messages.length === 1 && conversation.messages[0].role === 'system' && 
        conversation.messages[0].content.startsWith('Error parsing')) {
      return (
        <div className="p-4 border rounded-lg bg-amber-50 border-amber-200">
          <p className="text-amber-700 font-medium">Conversation parsing error</p>
          <p className="text-sm text-amber-600 mt-1">
            {conversation.messages[0].content}
          </p>
          <details className="mt-2">
            <summary className="text-xs text-amber-500 cursor-pointer">Raw data</summary>
            <pre className="text-xs bg-amber-100 p-2 rounded mt-1 overflow-auto max-h-32">
              {span?.attributes?.['pydantic_ai.all_messages']}
            </pre>
          </details>
        </div>
      );
    }
  } catch (error) {
    return (
      <div className="p-4 border rounded-lg bg-red-50 border-red-200">
        <p className="text-red-700 font-medium">Component Error</p>
        <p className="text-sm text-red-600 mt-1">
          Failed to render Logfire conversation: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <details className="mt-2">
          <summary className="text-xs text-red-500 cursor-pointer">Span data</summary>
          <pre className="text-xs bg-red-100 p-2 rounded mt-1 overflow-auto max-h-32">
            {JSON.stringify(span, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with metrics */}
      <ConversationHeader analysis={analysis} conversation={conversation} />
      
      {/* System prompt if present */}
      {conversation.systemPrompt && (
        <SystemPromptSection systemPrompt={conversation.systemPrompt} />
      )}
      
      {/* Messages */}
      <div className="space-y-3">
        {conversation.messages
          .slice(0, config.maxConversationMessages)
          .map((message, index) => (
            <MessageBubble key={index} message={message} config={config} />
          ))}
        {conversation.messages.length > config.maxConversationMessages && (
          <div className="text-center text-sm text-gray-500 py-2">
            ... {conversation.messages.length - config.maxConversationMessages} more messages (increase limit in config)
          </div>
        )}
      </div>
      
      {/* Tool calls summary */}
      {conversation.toolCalls.length > 0 && (
        <ToolCallsSection toolCalls={conversation.toolCalls} />
      )}
      
      {/* Raw attributes section */}
      <RawAttributesSection span={span} config={config} />
      
      {/* Debug info (collapsible) */}
      {(config.showDebugInfo || config.enableDebugMode) && (
        <DebugSection analysis={analysis} span={span} />
      )}
    </div>
  );
}

function ConversationHeader({ analysis, conversation }: { 
  analysis: any; 
  conversation: ConversationData; 
}) {
  const { metrics, identifiers } = analysis;
  
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="bg-blue-600 text-white px-2 py-1 rounded text-sm font-medium">
            Logfire AI Conversation
          </span>
          {identifiers.modelName && (
            <span className="bg-gray-100 px-2 py-1 rounded text-sm">
              {identifiers.modelName}
            </span>
          )}
          {identifiers.agentName && (
            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">
              {identifiers.agentName}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{conversation.messageCount} messages</span>
          {metrics.totalTokens > 0 && (
            <span>
              {metrics.totalTokens.toLocaleString()} tokens
              ({metrics.inputTokens}→{metrics.outputTokens})
            </span>
          )}
          {metrics.durationMs && (
            <span>{metrics.durationMs.toFixed(1)}ms</span>
          )}
        </div>
      </div>
    </div>
  );
}

function SystemPromptSection({ systemPrompt }: { systemPrompt: string }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
      <h4 className="font-medium text-amber-800 mb-2">System Instructions</h4>
      <pre className="text-sm text-amber-700 whitespace-pre-wrap">{systemPrompt}</pre>
    </div>
  );
}

function MessageBubble({ message, config }: { 
  message: NormalizedMessage; 
  config: any; 
}) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  
  // Truncate content if configured
  const content = config.truncateContent && message.content.length > config.maxContentLength
    ? message.content.slice(0, config.maxContentLength) + '...'
    : message.content;
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-3xl px-4 py-3 rounded-lg ${
          isUser
            ? 'bg-blue-600 text-white'
            : isSystem
            ? 'bg-gray-100 text-gray-800 border'
            : 'bg-gray-50 text-gray-900 border'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm capitalize">
            {message.role}
          </span>
          {(message.toolCalls && message.toolCalls.length > 0) && (
            <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-xs">
              {message.toolCalls.length} tool call{message.toolCalls.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        
        <div className="prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap text-sm">{content}</pre>
        </div>
        
        {/* Tool calls in this message */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.toolCalls.map((tool, index) => (
              <ToolCallDisplay key={index} toolCall={tool} />
            ))}
          </div>
        )}
        
        {/* Tool responses in this message */}
        {message.toolResponses && message.toolResponses.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.toolResponses.map((response, index) => (
              <ToolResponseDisplay key={index} response={response} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCallDisplay({ toolCall }: { toolCall: any }) {
  return (
    <div className="bg-black bg-opacity-10 rounded p-2 text-xs">
      <div className="font-medium">🔧 {toolCall.name || toolCall.tool_name}</div>
      {toolCall.arguments && (
        <pre className="mt-1 opacity-80 whitespace-pre-wrap">
          {typeof toolCall.arguments === 'string' 
            ? toolCall.arguments 
            : JSON.stringify(toolCall.arguments, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ToolResponseDisplay({ response }: { response: any }) {
  return (
    <div className="bg-green-100 bg-opacity-50 rounded p-2 text-xs">
      <div className="font-medium">✅ Tool Response</div>
      <pre className="mt-1 whitespace-pre-wrap">
        {response.content || JSON.stringify(response.result || response, null, 2)}
      </pre>
    </div>
  );
}

function ToolCallsSection({ toolCalls }: { toolCalls: any[] }) {
  const toolCounts = toolCalls.reduce((acc, tool) => {
    const name = tool.name || tool.tool_name || 'unknown';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
      <h4 className="font-medium text-purple-800 mb-2">Tool Usage Summary</h4>
      <div className="flex flex-wrap gap-2">
        {Object.entries(toolCounts).map(([name, count]) => (
          <span key={name} className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">
            {name} ({count as number})
          </span>
        ))}
      </div>
    </div>
  );
}

function RawAttributesSection({ span, config }: { span: any; config: any }) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div>
      <button
        type="button"
        className="text-sm underline text-gray-500 hover:text-gray-700"
        onClick={() => setShowRaw(!showRaw)}
      >
        {showRaw ? 'Hide raw attributes' : 'Show raw attributes'}
      </button>
      <div className="mt-1 flex justify-end">
        <CopyButton getText={() => JSON.stringify(span.attributes || {}, null, 2)} />
      </div>
      {showRaw && (
        <div className="mt-2">
          <JsonCode value={span.attributes || {}} />
        </div>
      )}
    </div>
  );
}

function DebugSection({ analysis, span }: { analysis: any; span: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className="border border-gray-200 rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
      >
        🔍 Debug Info {isExpanded ? '▼' : '▶'}
      </button>
      
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 space-y-4">
          <div>
            <h5 className="font-medium text-gray-800 mb-2">Span Analysis</h5>
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">
              {JSON.stringify({
                namespaces: Array.from(analysis.namespaces),
                conversationSources: analysis.conversationSources,
                platformHints: analysis.platformHints,
                hasLogfireConversation: analysis.hasLogfireConversation,
                hasTokenUsage: analysis.hasTokenUsage,
                hasToolCalls: analysis.hasToolCalls
              }, null, 2)}
            </pre>
          </div>
          
          <div>
            <h5 className="font-medium text-gray-800 mb-2">Raw Span Attributes</h5>
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(span.attributes, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}