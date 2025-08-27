"use client";

import React from "react";
import { detectSpanType, extractMeaningfulFields } from "@/lib/spanDetection";
import { parseHTTPDetails, parseTokenUsage } from "@/lib/attributeParsers";
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

    case 'llm-chat': {
      const attrs = span.attributes || {}
      const fallbackAssistantText =
        attrs['gen_ai.response.output_text'] ||
        attrs['gen_ai.response.text'] ||
        attrs['response_text'] ||
        attrs['output_text'] ||
        undefined
      return (
        <LLMChatView
          events={attrs.events}
          model={attrs['gen_ai.request.model']}
          system={attrs['gen_ai.system']}
          tokenUsage={parseTokenUsage(attrs)}
          fallbackAssistantText={fallbackAssistantText}
        />
      )
    }

    case 'http-request': {
      const http = parseHTTPDetails(span.attributes || {})
      return <HTTPRequestView {...http} durationMs={span.duration_ms} />
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

    case 'function-model': {
      const raw = span.attributes?.model_request_parameters
      let params: any | undefined
      try { params = raw ? JSON.parse(raw) : undefined } catch { params = undefined }
      return (
        <FunctionModelView
          model={span.attributes?.['gen_ai.request.model']}
          error={span.attributes?.['logfire.exception.fingerprint']}
          params={params}
        />
      );
    }

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

    default: {
      const meaningful = extractMeaningfulFields(span.attributes || {})
      return (
        <AdaptiveSpanView
          operationName={span.operation_name}
          meaningfulFields={meaningful}
          allAttributes={span.attributes || {}}
        />
      );
    }
  }
}
