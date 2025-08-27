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

    case 'llm-chat':
      return (
        <LLMChatView
          events={span.attributes?.events}
          model={span.attributes?.['gen_ai.request.model']}
          system={span.attributes?.['gen_ai.system']}
          tokenUsage={parseTokenUsage(span.attributes || {})}
        />
      );

    case 'http-request': {
      const http = parseHTTPDetails(span.attributes || {})
      return <HTTPRequestView {...http} />
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

    case 'function-model':
      return (
        <FunctionModelView
          model={span.attributes?.['gen_ai.request.model']}
          error={span.attributes?.['logfire.exception.fingerprint']}
        />
      );

    case 'database':
      return (
        <DatabaseSpanView
          statement={span.attributes?.['db.statement']}
          operation={span.attributes?.['db.operation.name']}
          duration={span.duration_ms}
        />
      );

    case 'external-api':
      return (
        <ExternalAPIView
          address={span.attributes?.['server.address']}
          operation={span.operation_name}
          status={span.attributes?.['http.status_code']}
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

