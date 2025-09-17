"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/Accordion"
import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { fetchTraces } from "@/lib/api"
import { formatDate } from "@/lib/datetime"
import { detectSpanType } from "@/lib/spanDetection"
import SpanRenderer from "@/components/spans/SpanRenderer"
import { RiCheckboxCircleFill, RiErrorWarningFill } from "@remixicon/react"
import { Activity, Clock, Database, Search, SlidersHorizontal, Zap } from "lucide-react"
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

interface Trace {
  trace_id: string
  service_name: string
  operation_name: string
  start_time: string | number
  duration_ms: number
  span_count: number
  status: string
  spans?: Span[]
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

function getStatusIcon(status: string) {
  if (status.toLowerCase() === "ok" || status.toLowerCase() === "success") {
    return (
      <RiCheckboxCircleFill className="size-[18px] shrink-0 text-emerald-600 dark:text-emerald-400" />
    )
  }
  return (
    <RiErrorWarningFill className="size-[18px] shrink-0 text-red-600 dark:text-red-400" />
  )
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export default function Audits() {
  const [traces, setTraces] = useState<Trace[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null)
  const [spans, setSpans] = useState<Span[]>([])

  useEffect(() => {
    async function loadTraces() {
      try {
        setLoading(true)
        const response = await fetchTraces({ limit: 20 })
        setTraces(response.data || [])
        // For demo purposes, select the first trace automatically
        if (response.data && response.data.length > 0) {
          const firstTrace = response.data[0]
          setSelectedTrace(firstTrace)
          // Generate mock spans for the selected trace
          generateMockSpans(firstTrace)
        }
      } catch (error) {
        console.error('Failed to fetch traces:', error)
      } finally {
        setLoading(false)
      }
    }
    loadTraces()
  }, [])

  // Mock span generation for demo - in real app this would fetch from API
  function generateMockSpans(trace: Trace) {
    const mockSpans: Span[] = [
      {
        trace_id: trace.trace_id,
        span_id: 'span-1',
        operation_name: 'HTTP GET /api/chat',
        service_name: trace.service_name,
        start_time: trace.start_time,
        end_time: (typeof trace.start_time === 'number' ? trace.start_time : new Date(trace.start_time).getTime()) + trace.duration_ms,
        duration_ms: trace.duration_ms * 0.1,
        status: 'ok',
        attributes: {
          'http.method': 'GET',
          'http.route': '/api/chat',
          'http.status_code': 200,
          'http.url': 'https://api.example.com/chat'
        }
      },
      {
        trace_id: trace.trace_id,
        span_id: 'span-2',
        operation_name: 'LLM Chat Completion',
        service_name: 'ai-service',
        start_time: (typeof trace.start_time === 'number' ? trace.start_time : new Date(trace.start_time).getTime()) + 50,
        end_time: (typeof trace.start_time === 'number' ? trace.start_time : new Date(trace.start_time).getTime()) + trace.duration_ms - 10,
        duration_ms: trace.duration_ms * 0.8,
        status: 'ok',
        attributes: {
          'gen_ai.system': 'openai',
          'gen_ai.request.model': 'gpt-4o',
          events: JSON.stringify([
            { role: 'user', content: 'Hello, how are you?' },
            { role: 'assistant', content: 'I am doing well, thank you for asking!' }
          ]),
          'gen_ai.usage.input_tokens': 12,
          'gen_ai.usage.output_tokens': 20
        }
      },
      {
        trace_id: trace.trace_id,
        span_id: 'span-3',
        operation_name: 'database query',
        service_name: 'db-service',
        start_time: (typeof trace.start_time === 'number' ? trace.start_time : new Date(trace.start_time).getTime()) + 10,
        end_time: (typeof trace.start_time === 'number' ? trace.start_time : new Date(trace.start_time).getTime()) + 40,
        duration_ms: 30,
        status: 'ok',
        attributes: {
          'db.statement': 'SELECT * FROM conversations WHERE user_id = ?',
          'db.operation.name': 'SELECT',
          'db.system': 'postgresql'
        }
      }
    ]
    setSpans(mockSpans)
  }

  const filteredSpans = spans.filter(span =>
    span.operation_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    span.service_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <section aria-label="Trace Analysis">
        <div className="flex justify-center p-8">
          <Activity className="animate-spin size-6" />
        </div>
      </section>
    )
  }

  return (
    <section aria-label="Trace Analysis">
      <div className="flex flex-col items-center justify-between gap-2 p-6 sm:flex-row">
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          {selectedTrace && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Analyzing trace: <span className="font-mono text-xs">{selectedTrace.trace_id}</span>
            </div>
          )}
          <Input
            type="search"
            placeholder="Search spans..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="sm:w-64 [&>input]:py-1.5"
          />
        </div>
        <Button
          variant="secondary"
          className="w-full gap-2 py-1.5 text-base sm:w-fit sm:text-sm"
        >
          <SlidersHorizontal
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Filters
        </Button>
      </div>
      
      <div className="border-t border-gray-200 px-6 pb-6 dark:border-gray-800">
        {selectedTrace && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Trace Overview</h2>
              <div className="flex items-center gap-2">
                {getStatusIcon(selectedTrace.status)}
                <Badge variant="neutral">{selectedTrace.span_count} spans</Badge>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {formatDuration(selectedTrace.duration_ms)}
                </span>
              </div>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Service:</span> {selectedTrace.service_name} •{' '}
              <span className="font-medium">Operation:</span> {selectedTrace.operation_name} •{' '}
              <span className="font-medium">Time:</span> {formatDate(selectedTrace.start_time)}
            </div>
          </div>
        )}

        <Accordion type="multiple" className="mt-6">
          {filteredSpans.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No spans found{searchTerm && ` matching "${searchTerm}"`}
            </div>
          ) : (
            filteredSpans.map((span) => {
              const spanType = detectSpanType(span)
              return (
                <AccordionItem key={span.span_id} value={span.span_id}>
                  <AccordionTrigger className="py-5">
                    <div className="flex w-full items-center justify-between pr-4">
                      <div className="flex items-center gap-2.5 text-left">
                        {getSpanTypeIcon(spanType)}
                        <div>
                          <div className="font-medium">{span.operation_name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {span.service_name}
                          </div>
                        </div>
                        <Badge variant="neutral" className="text-xs">
                          {spanType}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-x-3 tabular-nums">
                        <div className="text-right">
                          <div className="text-sm font-medium">{formatDuration(span.duration_ms)}</div>
                          <div className="text-xs text-gray-500">
                            {formatDate(span.start_time)}
                          </div>
                        </div>
                        {getStatusIcon(span.status)}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="mt-4 p-4 bg-white dark:bg-gray-950 rounded-lg border">
                      <SpanRenderer span={span} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })
          )}
        </Accordion>
      </div>
    </section>
  )
}
