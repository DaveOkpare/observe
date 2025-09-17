"use client";

import React, { useState } from "react";
import { analyzeSpan, type SpanAnalysis } from "@/lib/spanAnalysis";
import CopyButton from "../CopyButton";
import JsonCode from "../JsonCode";

interface AdaptiveSpanViewProps {
  span: any;
  operationName?: string;
  meaningfulFields?: Record<string, any>;
  allAttributes?: Record<string, any>;
}

export default function AdaptiveSpanView({ 
  span, 
  operationName, 
  meaningfulFields, 
  allAttributes 
}: AdaptiveSpanViewProps) {
  const [showRaw, setShowRaw] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  
  // Use new adaptive analysis if span provided, fallback to legacy props
  const analysis = span ? analyzeSpan(span) : null;
  const finalOperationName = operationName || span?.operation_name || 'Unknown Operation';
  const finalAttributes = allAttributes || span?.attributes || {};
  const finalMeaningfulFields = meaningfulFields || analysis?.identifiers || {};

  return (
    <div className="space-y-4">
      {/* Enhanced header with analysis */}
      <AdaptiveHeader 
        operationName={finalOperationName}
        analysis={analysis}
        span={span}
      />

      {/* Detected patterns section */}
      {analysis && (
        <PatternsSection analysis={analysis} />
      )}

      {/* Key information */}
      {Object.keys(finalMeaningfulFields).length > 0 && (
        <KeyInformationSection meaningfulFields={finalMeaningfulFields} />
      )}

      {/* Metrics section */}
      {analysis?.metrics && Object.keys(analysis.metrics).length > 0 && (
        <MetricsSection metrics={analysis.metrics} />
      )}

      {/* Platform-specific data */}
      {analysis?.platformData && Object.keys(analysis.platformData).length > 0 && (
        <PlatformDataSection platformData={analysis.platformData} />
      )}

      {/* Debug sections */}
      <DebugControls
        showRaw={showRaw}
        setShowRaw={setShowRaw}
        showAnalysis={showAnalysis}
        setShowAnalysis={setShowAnalysis}
        allAttributes={finalAttributes}
        analysis={analysis}
      />
    </div>
  );
}

function AdaptiveHeader({ operationName, analysis, span }: {
  operationName: string;
  analysis: SpanAnalysis | null;
  span: any;
}) {
  const getSpanTypeLabel = () => {
    if (!analysis) return 'Unknown Type';
    
    if (analysis.hasLogfireConversation) return 'Logfire AI (Not Rendered)';
    if (analysis.hasConversation) return 'AI Conversation (Not Rendered)';
    if (analysis.hasGenAIIndicators) return 'GenAI Operation';
    if (analysis.namespaces.has('http')) return 'HTTP Operation';
    if (analysis.namespaces.has('db')) return 'Database Operation';
    return 'Generic Span';
  };

  const getBadgeColor = () => {
    if (!analysis) return 'bg-gray-100 text-gray-800';
    
    if (analysis.hasLogfireConversation || analysis.hasConversation) {
      return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
    }
    if (analysis.hasGenAIIndicators) return 'bg-blue-100 text-blue-800';
    if (analysis.namespaces.has('http')) return 'bg-green-100 text-green-800';
    if (analysis.namespaces.has('db')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className={`text-xs rounded px-2 py-1 font-medium ${getBadgeColor()}`}>
          {getSpanTypeLabel()}
        </span>
        <span className="font-mono text-sm truncate" title={operationName}>
          {operationName}
        </span>
      </div>
      
      {analysis && (
        <div className="flex items-center gap-2 text-xs text-gray-600">
          {analysis.platformHints.length > 0 && (
            <span className="bg-gray-100 px-2 py-1 rounded">
              {analysis.platformHints.join(', ')}
            </span>
          )}
          {span?.duration_ms && (
            <span>{span.duration_ms.toFixed(1)}ms</span>
          )}
        </div>
      )}
    </div>
  );
}

function PatternsSection({ analysis }: { analysis: SpanAnalysis }) {
  if (!analysis.conversationSources.length && !analysis.namespaces.size) return null;
  
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <h4 className="font-medium text-blue-800 mb-2">Detected Patterns</h4>
      <div className="space-y-2 text-sm">
        {analysis.namespaces.size > 0 && (
          <div>
            <span className="font-medium text-blue-700">Namespaces:</span>{' '}
            <span className="text-blue-600">
              {Array.from(analysis.namespaces).join(', ')}
            </span>
          </div>
        )}
        
        {analysis.conversationSources.length > 0 && (
          <div>
            <span className="font-medium text-blue-700">Conversations:</span>{' '}
            <span className="text-blue-600">
              {analysis.conversationSources.join(', ')}
            </span>
          </div>
        )}
        
        {analysis.platformHints.length > 0 && (
          <div>
            <span className="font-medium text-blue-700">Platform:</span>{' '}
            <span className="text-blue-600">
              {analysis.platformHints.join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function KeyInformationSection({ meaningfulFields }: { meaningfulFields: Record<string, any> }) {
  return (
    <div>
      <h4 className="font-medium text-sm mb-2">Key Information</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
        {Object.entries(meaningfulFields).map(([key, value]) => (
          <div key={key} className="flex justify-between p-2 bg-gray-50 rounded">
            <span className="font-medium truncate" title={key}>{key}:</span>
            <span className="text-right truncate ml-2" title={String(value)}>
              {String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricsSection({ metrics }: { metrics: Record<string, number> }) {
  return (
    <div>
      <h4 className="font-medium text-sm mb-2">Metrics</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        {Object.entries(metrics).map(([key, value]) => (
          <div key={key} className="bg-green-50 border border-green-200 rounded p-2 text-center">
            <div className="font-bold text-green-800">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
            <div className="text-green-600 text-xs">{key}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlatformDataSection({ platformData }: { platformData: Record<string, any> }) {
  return (
    <div>
      <h4 className="font-medium text-sm mb-2">Platform Data</h4>
      <div className="space-y-2">
        {Object.entries(platformData).map(([namespace, data]) => (
          <div key={namespace} className="border border-gray-200 rounded-lg p-3">
            <h5 className="font-medium text-sm text-gray-700 mb-2">{namespace}</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {Object.entries(data as Record<string, any>).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-gray-600">{key}:</span>
                  <span className="font-mono text-xs truncate ml-2" title={String(value)}>
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DebugControls({ 
  showRaw, 
  setShowRaw, 
  showAnalysis, 
  setShowAnalysis, 
  allAttributes, 
  analysis 
}: {
  showRaw: boolean;
  setShowRaw: (show: boolean) => void;
  showAnalysis: boolean;
  setShowAnalysis: (show: boolean) => void;
  allAttributes: Record<string, any>;
  analysis: SpanAnalysis | null;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-4">
        <button
          type="button"
          className="text-xs underline text-gray-500 hover:text-gray-700"
          onClick={() => setShowRaw(!showRaw)}
        >
          {showRaw ? 'Hide raw attributes' : 'Show raw attributes'}
        </button>
        
        {analysis && (
          <button
            type="button"
            className="text-xs underline text-gray-500 hover:text-gray-700"
            onClick={() => setShowAnalysis(!showAnalysis)}
          >
            {showAnalysis ? 'Hide analysis data' : 'Show analysis data'}
          </button>
        )}
        
        <div className="ml-auto">
          <CopyButton getText={() => JSON.stringify(allAttributes, null, 2)} />
        </div>
      </div>
      
      {showRaw && (
        <div>
          <h5 className="font-medium text-sm mb-2">Raw Attributes</h5>
          <JsonCode value={allAttributes} />
        </div>
      )}
      
      {showAnalysis && analysis && (
        <div>
          <h5 className="font-medium text-sm mb-2">Analysis Data</h5>
          <JsonCode value={{
            namespaces: Array.from(analysis.namespaces),
            conversationSources: analysis.conversationSources,
            platformHints: analysis.platformHints,
            capabilities: {
              hasConversation: analysis.hasConversation,
              hasLogfireConversation: analysis.hasLogfireConversation,
              hasGenAIIndicators: analysis.hasGenAIIndicators,
              hasTokenUsage: analysis.hasTokenUsage,
              hasToolCalls: analysis.hasToolCalls
            },
            conversations: analysis.conversations,
            metrics: analysis.metrics,
            identifiers: analysis.identifiers
          }} />
        </div>
      )}
    </div>
  );
}