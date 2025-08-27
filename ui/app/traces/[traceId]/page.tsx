"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Activity, FileText } from "lucide-react";
import { apiUrl } from "../../../lib/api";
import SpanRenderer from "@/components/spans/SpanRenderer";

interface Span {
  trace_id: string;
  span_id: string;
  parent_span_id: string;
  operation_name: string;
  service_name: string;
  start_time: string | number;
  end_time: string | number;
  duration_ms: number;
  status: string;
  attributes: Record<string, any>;
}

interface Log {
  trace_id: string;
  service_name: string;
  operation_name: string;
  timestamp: string | number;
  level: string;
  message: string;
}

interface TraceDetail {
  trace_id: string;
  start_time: string | number;
  end_time: string | number;
  duration_ms: number;
  spans: Span[];
  logs: Log[];
  span_count: number;
  log_count: number;
}

export default function TraceDetailPage({ params }: { params: Promise<{ traceId: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const [trace, setTrace] = useState<TraceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrace = async () => {
      try {
        const response = await fetch(apiUrl(`/api/traces/${resolvedParams.traceId}`));
        if (!response.ok) {
          throw new Error('Trace not found');
        }
        const data = await response.json();
        setTrace(data);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load trace');
      } finally {
        setLoading(false);
      }
    };

    if (resolvedParams.traceId) {
      fetchTrace();
    }
  }, [resolvedParams.traceId]);

  const formatTime = (v: string | number) => {
    // Lazy import to avoid circular deps; inline simple parser
    if (typeof v === 'string') {
      const d = new Date(v);
      return isNaN(d.getTime()) ? '—' : d.toLocaleString();
    }
    const n = v as number;
    const d = n > 1e17 ? new Date(n / 1_000_000) : n > 1e14 ? new Date(n / 1_000) : n > 1e12 ? new Date(n) : new Date(n * 1000);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString();
  };

  const formatDuration = (durationMs: number) => {
    if (durationMs < 1) return `${(durationMs * 1000).toFixed(0)}μs`;
    if (durationMs < 1000) return `${durationMs.toFixed(1)}ms`;
    return `${(durationMs / 1000).toFixed(2)}s`;
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'DEBUG': return 'text-gray-500';
      case 'INFO': return 'text-blue-600';
      case 'WARNING': return 'text-yellow-600';
      case 'ERROR': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'ok' ? 'text-green-600' : 'text-red-600';
  };

  const renderTimeline = () => {
    if (!trace || trace.spans.length === 0) return null;
    const toMs = (v: string | number) => {
      if (typeof v === 'string') return new Date(v).getTime();
      const n = v as number;
      if (n > 1e17) return n / 1_000_000; // ns
      if (n > 1e14) return n / 1_000; // µs
      if (n > 1e12) return n; // ms
      return n * 1000; // s
    };

    const minStart = Math.min(...trace.spans.map(s => toMs(s.start_time)));
    const maxEnd = Math.max(...trace.spans.map(s => toMs(s.end_time)));
    const total = maxEnd - minStart || 1;

    return (
      <div className="space-y-3">
        {trace.spans
          .slice()
          .sort((a, b) => a.start_time - b.start_time)
          .map((span) => {
            const s = toMs(span.start_time);
            const e = toMs(span.end_time);
            const left = ((s - minStart) / total) * 100;
            const width = Math.max(((e - s) / total) * 100, 0.5);
            return (
              <div key={span.span_id} className="">
                <div className="flex items-center justify-between text-sm">
                  <div className="truncate"><span className="font-medium">{span.operation_name}</span> <span className="text-gray-500">· {span.service_name}</span></div>
                  <div className="text-gray-600">{formatDuration(span.duration_ms)}</div>
                </div>
                <div className="relative h-3 mt-1 rounded bg-gray-100">
                  <div
                    className="absolute h-3 rounded bg-blue-500/80"
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-muted-foreground">Loading trace...</p>
        </div>
      </div>
    );
  }

  if (error || !trace) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="text-center py-8">
            <p className="text-red-600 text-lg">{error || 'Trace not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <h1 className="text-xl font-bold text-foreground">
              Trace: {resolvedParams.traceId.substring(0, 8)}...
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Trace Summary */}
        <div className="bg-card rounded-lg shadow-sm border mb-6">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold">Trace Summary</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="text-lg font-medium">{formatDuration(trace.duration_ms)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Spans</p>
                <p className="text-lg font-medium">{trace.span_count}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Logs</p>
                <p className="text-lg font-medium">{trace.log_count}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Start Time</p>
                <p className="text-lg font-medium">{formatTime(trace.start_time)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Timeline */}
          <div className="bg-card rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold">Timeline</h2>
            </div>
            <div className="p-6">
              {renderTimeline()}
            </div>
          </div>

          {/* Spans */}
          <div className="bg-card rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Spans ({trace.spans.length})
              </h2>
            </div>
            <div className="p-6">
              {trace.spans.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No spans found</p>
              ) : (
                <div className="space-y-3">
                  {trace.spans
                    .sort((a, b) => a.start_time - b.start_time)
                    .map((span) => (
                      <SpanItem
                        key={span.span_id}
                        span={span}
                        formatDuration={formatDuration}
                        formatTime={formatTime}
                      />
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Logs */}
          <div className="bg-card rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Logs ({trace.logs.length})
              </h2>
            </div>
            <div className="p-6">
              {trace.logs.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No logs found</p>
              ) : (
                <div className="space-y-3">
                  {trace.logs
                    .sort((a, b) => a.timestamp - b.timestamp)
                    .map((log, index) => (
                    <div key={index} className="border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-medium ${getLevelColor(log.level)}`}>
                          {log.level}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(log.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mb-1">{log.message}</p>
                      <p className="text-xs text-muted-foreground">
                        Service: {log.service_name} | Operation: {log.operation_name}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpanItem({ span, formatDuration, formatTime }: { span: Span; formatDuration: (n: number) => string; formatTime: (v: string | number) => string }) {
  const [showAttrs, setShowAttrs] = useState(false);
  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-foreground">{span.operation_name}</h3>
        <span className={span.status === 'ok' ? 'text-green-600' : 'text-red-600'}>
          {span.status}
        </span>
      </div>
      <div className="text-sm text-muted-foreground grid grid-cols-2 gap-y-1">
        <p>Service: {span.service_name}</p>
        <p className="text-right">Duration: {formatDuration(span.duration_ms)}</p>
        <p>Start: {formatTime(span.start_time)}</p>
        {span.parent_span_id && (
          <p className="text-right">Parent: {span.parent_span_id.substring(0, 8)}...</p>
        )}
      </div>

      <div className="mt-3">
        <SpanRenderer span={span} />
      </div>

      <div className="mt-3">
        <button
          type="button"
          className="text-xs underline text-muted-foreground hover:text-foreground"
          onClick={() => setShowAttrs((v) => !v)}
        >
          {showAttrs ? 'Hide raw attributes' : 'Show raw attributes'}
        </button>
        {showAttrs && (
          <pre className="text-xs bg-muted p-3 rounded mt-2 overflow-auto max-h-60">
            {JSON.stringify(span.attributes, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
