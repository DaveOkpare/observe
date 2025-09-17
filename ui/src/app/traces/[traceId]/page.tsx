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
import { apiUrl, AnnotationResponse, getTraceAnnotation } from "@/lib/api"
import { formatDate } from "@/lib/datetime"
import { detectSpanType } from "@/lib/spanDetection"
import SpanRenderer from "@/components/spans/SpanRenderer"
import { AnnotationDisplay } from "@/components/AnnotationDisplay"
import { AnnotationForm } from "@/components/AnnotationForm"
import { AISuggestion } from "@/components/AISuggestion"
import { RiCheckboxCircleFill, RiErrorWarningFill } from "@remixicon/react"
import { Activity, Clock, Database, Search, SlidersHorizontal, Zap, ArrowLeft } from "lucide-react"
import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"

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

interface TraceDetail {
  trace_id: string
  service_name: string
  operation_name: string
  start_time: string | number
  duration_ms: number
  span_count: number
  status: string
  spans: Span[]
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

function getStatusIcon(status: string | undefined) {
  if (status && (status.toLowerCase() === "ok" || status.toLowerCase() === "success")) {
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

export default function TraceDetail({ params }: { params: Promise<{ traceId: string }> }) {
  const [trace, setTrace] = useState<TraceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [annotation, setAnnotation] = useState<AnnotationResponse | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const router = useRouter()
  const resolvedParams = use(params)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError(null)
        
        // Use the new API function that handles transformation
        const { fetchTraceDetail } = await import('@/lib/api')
        
        // Load trace details and annotation in parallel
        const [transformedTrace, annotationData] = await Promise.all([
          fetchTraceDetail(resolvedParams.traceId),
          getTraceAnnotation(resolvedParams.traceId)
        ])
        
        setTrace(transformedTrace)
        setAnnotation(annotationData)
      } catch (error) {
        console.error('Failed to fetch data:', error)
        setError("Failed to fetch trace details")
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [resolvedParams.traceId])

  const handleSaveAnnotation = (savedAnnotation: AnnotationResponse) => {
    setAnnotation(savedAnnotation)
    setShowEditor(false)
  }

  const handleEditAnnotation = () => {
    setShowEditor(true)
  }

  const handleCancelEdit = () => {
    setShowEditor(false)
  }

  const handleAIAnnotationGenerated = (aiAnnotation: AnnotationResponse) => {
    setAnnotation(aiAnnotation)
  }

  const filteredSpans = trace?.spans?.filter(span =>
    span.operation_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    span.service_name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  if (loading) {
    return (
      <section aria-label="Trace Detail">
        <div className="flex justify-center p-8">
          <Activity className="animate-spin size-6" />
        </div>
      </section>
    )
  }

  if (error || !trace) {
    return (
      <section aria-label="Trace Detail">
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="text-red-600 dark:text-red-400 mb-4">
            {error || "Trace not found"}
          </div>
          <Button onClick={() => router.push('/traces/overview')} variant="secondary">
            <ArrowLeft className="size-4 mr-2" />
            Back to Overview
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section aria-label="Trace Detail" className="min-h-screen bg-white dark:bg-gray-950">
      <div className="flex flex-col items-center justify-between gap-2 p-6 sm:flex-row bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => router.push('/traces/overview')} 
              variant="secondary"
            >
              <ArrowLeft className="size-4 mr-2" />
              Back
            </Button>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Trace: <span className="font-mono text-xs">{resolvedParams.traceId}</span>
            </div>
          </div>
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
      
      <div className="px-6 pb-6 bg-white dark:bg-gray-950">
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold dark:text-gray-200">Trace Overview</h2>
            <div className="flex items-center gap-2">
              {getStatusIcon(trace.status)}
              <Badge variant="neutral">{trace.span_count} spans</Badge>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {formatDuration(trace.duration_ms)}
              </span>
            </div>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">Service:</span> {trace.service_name} •{' '}
            <span className="font-medium">Operation:</span> {trace.operation_name} •{' '}
            <span className="font-medium">Time:</span> {formatDate(trace.start_time)}
          </div>
        </div>

        {/* Annotation System */}
        <div className="mt-4 space-y-4">
          {/* Show annotation if it exists */}
          {annotation && !showEditor && (
            <AnnotationDisplay
              annotation={annotation}
              onEdit={handleEditAnnotation}
            />
          )}

          {/* Show annotation form when editing */}
          {showEditor && (
            <AnnotationForm
              traceId={resolvedParams.traceId}
              initialData={{ 
                feedback: annotation?.feedback || undefined, 
                annotation: annotation?.annotation || undefined 
              }}
              onSave={handleSaveAnnotation}
              onCancel={handleCancelEdit}
            />
          )}

          {/* Show AI suggestion when no annotation exists and not editing */}
          {!annotation && !showEditor && trace && (
            <AISuggestion
              traceId={resolvedParams.traceId}
              serviceName={trace.spans?.[0]?.service_name || 'unknown'}
              onAnnotationGenerated={handleAIAnnotationGenerated}
            />
          )}

          {/* Show prompt to provide feedback when no annotation exists and not editing */}
          {!annotation && !showEditor && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Want to leave feedback or an annotation for this trace?
              </div>
              <Button variant="secondary" onClick={() => setShowEditor(true)}>
                Provide Feedback
              </Button>
            </div>
          )}
        </div>

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
                  <AccordionTrigger className="py-5 hover:bg-gray-50 dark:hover:bg-gray-900/50 dark:text-gray-200">
                    <div className="flex w-full items-center justify-between pr-4">
                      <div className="flex items-center gap-2.5 text-left">
                        {getSpanTypeIcon(spanType)}
                        <div>
                          <div className="font-medium dark:text-gray-200">{span.operation_name}</div>
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
                          <div className="text-sm font-medium dark:text-gray-200">{formatDuration(span.duration_ms)}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(span.start_time)}
                          </div>
                        </div>
                        {getStatusIcon(span.status)}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="mt-4 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
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
