"use client"

import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/Accordion"
import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { apiUrl } from "@/lib/api"
import { formatDate } from "@/lib/datetime"
import { detectSpanType } from "@/lib/spanDetection"
import SpanRenderer from "@/components/spans/SpanRenderer"
import JsonCode from "@/components/JsonCode"
import { Activity, Clock, Database, FileText, Zap, Search } from "lucide-react"
import { useEffect, useState } from "react"

interface Span {
  trace_id: string
  span_id: string
  parent_span_id?: string
  operation_name: string
  service_name: string
  start_time: string | number
  end_time: string | number
  duration_ms: number
  status: string
  attributes: Record<string, any>
}

interface Log {
  trace_id: string
  service_name: string
  operation_name: string
  timestamp: string | number
  level: string
  message: string
}

interface TraceDetail {
  trace_id: string
  start_time: string | number
  end_time: string | number
  duration_ms: number
  spans: Span[]
  logs: Log[]
  span_count: number
  log_count: number
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function getSpanTypeIcon(spanType: string) {
  switch (spanType) {
    case 'ai-agent':
    case 'llm-chat':
    case 'function-model':
      return <Zap className="size-4 text-purple-600 dark:text-purple-400" />
    case 'http-request':
      return <Activity className="size-4 text-blue-600 dark:text-blue-400" />
    case 'database':
      return <Database className="size-4 text-green-600 dark:text-green-400" />
    case 'log-message':
      return <Search className="size-4 text-yellow-600 dark:text-yellow-400" />
    default:
      return <Clock className="size-4 text-gray-600 dark:text-gray-400" />
  }
}

function getLevelColor(level: string) {
  switch (level.toUpperCase()) {
    case 'DEBUG': return 'text-gray-500'
    case 'INFO': return 'text-blue-600'
    case 'WARNING': return 'text-yellow-600'
    case 'ERROR': return 'text-red-600'
    default: return 'text-gray-600'
  }
}

function Timeline({ trace }: { trace: TraceDetail }) {
  if (!trace || trace.spans.length === 0) {
    return <div className="text-gray-500 text-center py-4">No spans to display</div>
  }

  const toMs = (v: string | number) => {
    if (typeof v === 'string') return new Date(v).getTime()
    const n = v as number
    if (n > 1e17) return n / 1_000_000 // ns
    if (n > 1e14) return n / 1_000 // µs  
    if (n > 1e12) return n // ms
    return n * 1000 // s
  }

  const minStart = Math.min(...trace.spans.map(s => toMs(s.start_time)))
  const maxEnd = Math.max(...trace.spans.map(s => toMs(s.end_time)))
  const total = maxEnd - minStart || 1

  return (
    <div className="space-y-3">
      {trace.spans
        .slice()
        .sort((a, b) => toMs(a.start_time) - toMs(b.start_time))
        .map((span) => {
          const s = toMs(span.start_time)
          const e = toMs(span.end_time)
          const left = ((s - minStart) / total) * 100
          const width = Math.max(((e - s) / total) * 100, 0.5)
          const spanType = detectSpanType(span)
          
          return (
            <div key={span.span_id}>
              <div className="flex items-center justify-between text-sm mb-1">
                <div className="flex items-center gap-2 truncate">
                  {getSpanTypeIcon(spanType)}
                  <span className="font-medium truncate">{span.operation_name}</span>
                  <span className="text-gray-500">· {span.service_name}</span>
                </div>
                <div className="text-gray-600 whitespace-nowrap">{formatDuration(span.duration_ms)}</div>
              </div>
              <div className="relative h-3 rounded bg-gray-100 dark:bg-gray-800">
                <div
                  className="absolute h-3 rounded bg-blue-500/80"
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </div>
            </div>
          )
        })}
    </div>
  )
}

interface TraceDetailDrawerProps {
  traceId?: string
  children: React.ReactNode
}

export default function TraceDetailDrawer({ traceId, children }: TraceDetailDrawerProps) {
  const [trace, setTrace] = useState<TraceDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!traceId || !isOpen) return

    const fetchTrace = async () => {
      try {
        setLoading(true)
        setError(null)
        // Use the new API function that handles transformation
        const { fetchTraceDetail } = await import('@/lib/api')
        const transformedTrace = await fetchTraceDetail(traceId)
        setTrace(transformedTrace)
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load trace')
        setTrace(null)
      } finally {
        setLoading(false)
      }
    }

    fetchTrace()
  }, [traceId, isOpen])

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        {children}
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-2xl">
        <DrawerHeader>
          <DrawerTitle>Trace Details</DrawerTitle>
          <DrawerDescription>
            {traceId ? `Trace ID: ${traceId.substring(0, 16)}...` : 'Loading trace information...'}
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody>
          {loading && (
            <div className="flex justify-center py-8">
              <Activity className="animate-spin size-6" />
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-600">{error}</p>
              <Button
                variant="secondary"
                className="mt-2"
                onClick={() => setIsOpen(false)}
              >
                Close
              </Button>
            </div>
          )}

          {trace && !loading && !error && (
            <div className="space-y-6">
              {/* Trace Summary */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Trace Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Duration</p>
                    <p className="font-medium">{formatDuration(trace.duration_ms)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Spans</p>
                    <p className="font-medium">{trace.span_count}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Logs</p>
                    <p className="font-medium">{trace.log_count}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Start Time</p>
                    <p className="font-medium text-xs">{formatDate(trace.start_time)}</p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Clock className="size-4" />
                  Timeline
                </h3>
                <div className="bg-white dark:bg-gray-950 rounded-lg border p-4">
                  <Timeline trace={trace} />
                </div>
              </div>

              {/* Spans */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Activity className="size-4" />
                  Spans ({trace.spans.length})
                </h3>
                {trace.spans.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No spans found</p>
                ) : (
                  <Accordion type="multiple" className="space-y-2">
                    {trace.spans
                      .sort((a, b) => (a.start_time as number) - (b.start_time as number))
                      .map((span) => {
                        const spanType = detectSpanType(span)
                        return (
                          <AccordionItem key={span.span_id} value={span.span_id} className="border rounded-lg">
                            <AccordionTrigger className="px-4 py-3 hover:no-underline">
                              <div className="flex items-center justify-between w-full pr-4">
                                <div className="flex items-center gap-2 text-left">
                                  {getSpanTypeIcon(spanType)}
                                  <div>
                                    <div className="font-medium">{span.operation_name}</div>
                                    <div className="text-xs text-gray-500">{span.service_name}</div>
                                  </div>
                                  <Badge variant="neutral" className="text-xs">{spanType}</Badge>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-medium">{formatDuration(span.duration_ms)}</div>
                                  <div className="text-xs text-gray-500">
                                    {span.status === 'ok' ? '✓' : '✗'} {span.status}
                                  </div>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4">
                              <div className="border-t pt-4">
                                <SpanRenderer span={span} />
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )
                      })}
                  </Accordion>
                )}
              </div>

              {/* Logs */}
              {trace.logs.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="size-4" />
                    Logs ({trace.logs.length})
                  </h3>
                  <div className="space-y-3">
                    {trace.logs
                      .sort((a, b) => (a.timestamp as number) - (b.timestamp as number))
                      .map((log, index) => (
                        <div key={index} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className={`font-medium text-sm ${getLevelColor(log.level)}`}>
                              {log.level}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(log.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm mb-1">{log.message}</p>
                          <p className="text-xs text-gray-500">
                            {log.service_name} • {log.operation_name}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}