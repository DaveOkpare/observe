"use client";

import React from "react";
import { detectSpanType, extractMeaningfulFields } from "@/lib/spanDetection";
import { parseHTTPDetails, parseTokenUsage, parseAIConversation } from "@/lib/attributeParsers";
import { analyzeSpan } from "@/lib/spanAnalysis";
import LogfireConversationView from "./LogfireConversationView";
import AIAgentView from "./AIAgentView";
import LLMChatView from "./LLMChatView";
import HTTPRequestView from "./HTTPRequestView";
import LogMessageView from "./LogMessageView";
import FunctionModelView from "./FunctionModelView";
import DatabaseSpanView from "./DatabaseSpanView";
import ExternalAPIView from "./ExternalAPIView";
import AdaptiveSpanView from "./AdaptiveSpanView";

export default function SpanRenderer({ span }: { span: any }) {
  const spanType = detectSpanType(span);

  switch (spanType) {
    // NEW: Handle Logfire conversations with dedicated view
    case 'logfire-conversation':
      return <LogfireConversationView span={span} />;

    // NEW: Handle generic AI conversations adaptively
    case 'ai-conversation': {
      const analysis = analyzeSpan(span);
      const conversation = analysis.conversations[0];
      
      if (conversation?.format === 'pydantic_ai') {
        return <LogfireConversationView span={span} />;
      }
      
      // Fallback to existing LLM chat view for OpenAI format
      const attrs = span.attributes || {};
      const conversationData = parseAIConversation(attrs.events);
      return (
        <LLMChatView
          events={attrs.events}
          model={attrs['gen_ai.request.model'] || analysis.identifiers.model}
          system={conversationData.systemPrompt || attrs['gen_ai.system']}
          tokenUsage={parseTokenUsage(attrs)}
          fallbackAssistantText={
            attrs['gen_ai.response.output_text'] ||
            attrs['gen_ai.response.text'] ||
            attrs['response_text'] ||
            attrs['output_text']
          }
        />
      );
    }

    // NEW: Handle other GenAI operations
    case 'genai-operation': {
      const analysis = analyzeSpan(span);
      return <AdaptiveSpanView span={span} />;
    }

    // NEW: Handle cache operations
    case 'cache-operation': {
      return <AdaptiveSpanView span={span} />;
    }

    // NEW: Handle FastAPI endpoints
    case 'fastapi-endpoint': {
      const http = parseHTTPDetails(span.attributes || {});
      return <HTTPRequestView {...http} durationMs={span.duration_ms} />;
    }

    // NEW: Handle HTTP operations (both client and server)
    case 'http-client':
    case 'http-server': {
      const http = parseHTTPDetails(span.attributes || {});
      return <HTTPRequestView {...http} durationMs={span.duration_ms} />;
    }

    // EXISTING: Legacy AI agent view (kept for compatibility)
    case 'ai-agent':
      return (
        <AIAgentView
          messages={span.attributes?.all_messages_events}
          finalResult={span.attributes?.final_result}
          tokenUsage={parseTokenUsage(span.attributes || {})}
          modelName={span.attributes?.model_name}
          agentName={span.attributes?.agent_name}
        />
      );

    // EXISTING: Legacy LLM chat view (kept for compatibility)
    case 'llm-chat': {
      const attrs = span.attributes || {};
      const fallbackAssistantText =
        attrs['gen_ai.response.output_text'] ||
        attrs['gen_ai.response.text'] ||
        attrs['response_text'] ||
        attrs['output_text'] ||
        undefined;
      return (
        <LLMChatView
          events={attrs.events}
          model={attrs['gen_ai.request.model']}
          system={attrs['gen_ai.system']}
          tokenUsage={parseTokenUsage(attrs)}
          fallbackAssistantText={fallbackAssistantText}
        />
      );
    }

    // EXISTING: Keep existing specialized views
    case 'function-model': {
      const raw = span.attributes?.model_request_parameters;
      let params: any | undefined;
      try { params = raw ? JSON.parse(raw) : undefined } catch { params = undefined }
      return (
        <FunctionModelView
          model={span.attributes?.['gen_ai.request.model']}
          error={span.attributes?.['logfire.exception.fingerprint']}
          params={params}
        />
      );
    }

    case 'log-message':
      return (
        <LogMessageView
          level={span.attributes?.['logfire.level_num']}
          file={span.attributes?.['code.filepath']}
          func={span.attributes?.['code.function']}
          line={span.attributes?.['code.lineno']}
          message={span.message}
        />
      );

    case 'database':
      return (
        <DatabaseSpanView
          statement={span.attributes?.['db.statement']}
          operation={span.attributes?.['db.operation.name'] || span.attributes?.['db.operation']}
          duration={span.duration_ms}
          system={span.attributes?.['db.system']}
        />
      );

    case 'external-api':
      return (
        <ExternalAPIView
          address={span.attributes?.['server.address']}
          operation={span.operation_name}
          status={span.attributes?.['http.status_code']}
          method={span.attributes?.['http.method']}
          url={span.attributes?.['http.url']}
        />
      );

    // NEW: Adaptive fallback with full analysis
    case 'adaptive':
    default: {
      return <AdaptiveSpanView span={span} />;
    }
  }
}