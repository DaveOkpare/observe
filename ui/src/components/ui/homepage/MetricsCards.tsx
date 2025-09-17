import { useEffect, useState } from "react"
import { fetchTraces } from "@/lib/api"
import type { Trace } from "@/types/traces"

type Category = "red" | "orange" | "emerald" | "gray"
type Metric = {
  label: string
  value: number
  percentage: string
  fraction: string
}

interface TraceMetricsData {
  totalTraces?: number
  avgDuration?: string
  errorRate?: string
  activeServices?: number
}


const getCategory = (value: number): Category => {
  if (value < 0.3) return "red"
  if (value < 0.7) return "orange"
  return "emerald"
}

const categoryConfig = {
  red: {
    activeClass: "bg-red-500 dark:bg-red-500",
    bars: 1,
  },
  orange: {
    activeClass: "bg-orange-500 dark:bg-orange-500",
    bars: 2,
  },
  emerald: {
    activeClass: "bg-emerald-500 dark:bg-emerald-500",
    bars: 3,
  },
  gray: {
    activeClass: "bg-gray-300 dark:bg-gray-800",
    bars: 0,
  },
} as const

function Indicator({ number }: { number: number }) {
  const category = getCategory(number)
  const config = categoryConfig[category]
  const inactiveClass = "bg-gray-300 dark:bg-gray-800"

  return (
    <div className="flex gap-0.5">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={`h-3.5 w-1 rounded-sm ${
            index < config.bars ? config.activeClass : inactiveClass
          }`}
        />
      ))}
    </div>
  )
}

function calculateTraceMetrics(traces: Trace[]): Metric[] {
  if (traces.length === 0) {
    return [
      {
        label: "Total Traces (24h)",
        value: 0,
        percentage: "0",
        fraction: "0/0",
      },
      {
        label: "Average Duration",
        value: 0,
        percentage: "0ms",
        fraction: "0ms avg",
      },
      {
        label: "Error Rate",
        value: 0,
        percentage: "0%",
        fraction: "0/0",
      },
      {
        label: "Active Services",
        value: 0,
        percentage: "0",
        fraction: "services",
      },
    ]
  }

  const totalTraces = traces.length
  const avgDuration = traces.reduce((sum, t) => sum + t.duration_ms, 0) / traces.length
  // Use status field from transformed data (gracefully handle missing status)
  const errorCount = traces.filter(t => 
    t.status && t.status.toLowerCase().includes('error')
  ).length
  const errorRate = errorCount / totalTraces
  // Count unique services and operations
  const uniqueServices = new Set(traces.map(t => t.service_name)).size;
  const uniqueOperations = new Set(traces.map(t => t.operation_name)).size;
  
  // Calculate performance score based on average duration (lower is better)
  const getDurationScore = (avgMs: number) => {
    if (avgMs > 5000) return 0.2  // Very slow (>5s)
    if (avgMs > 2000) return 0.4  // Slow (2-5s)
    if (avgMs > 1000) return 0.6  // Moderate (1-2s)
    if (avgMs > 500) return 0.8   // Good (500ms-1s)
    return 1.0                    // Excellent (<500ms)
  }

  return [
    {
      label: "Total Traces (24h)",
      value: Math.min(totalTraces / 1000, 1), // Normalize to 0-1 scale (1000 traces = good)
      percentage: totalTraces.toString(),
      fraction: `${totalTraces} traces`,
    },
    {
      label: "Average Duration",
      value: getDurationScore(avgDuration),
      percentage: formatDuration(avgDuration),
      fraction: "response time",
    },
    {
      label: "Error Rate",
      value: 1 - errorRate, // Invert so lower error rate = better score
      percentage: `${(errorRate * 100).toFixed(1)}%`,
      fraction: `${errorCount}/${totalTraces}`,
    },
    {
      label: "Active Operations", 
      value: Math.min(uniqueOperations / 10, 1), // Normalize to 0-1 scale (10 operations = good)
      percentage: uniqueOperations.toString(),
      fraction: "operations",
    },
  ]
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <div>
      <dt className="text-sm text-gray-500 dark:text-gray-500">
        {metric.label}
      </dt>
      <dd className="mt-1.5 flex items-center gap-2">
        <Indicator number={metric.value} />
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          {metric.percentage}{" "}
          <span className="font-medium text-gray-400 dark:text-gray-600">
            - {metric.fraction}
          </span>
        </p>
      </dd>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-3.5 w-1 bg-gray-200 dark:bg-gray-700 rounded-sm"
            />
          ))}
        </div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
      </div>
    </div>
  )
}

export function MetricsCards({ metricsData }: { metricsData?: TraceMetricsData }) {
  const [traces, setTraces] = useState<Trace[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    async function loadTraces() {
      if (metricsData) {
        // Use provided metrics data
        setLoading(false)
        return
      }
      
      try {
        setLoading(true)
        const response = await fetchTraces({ limit: 1000 }) // Get more traces for better metrics
        setTraces(response.data || [])
      } catch (error) {
        console.error('Failed to fetch traces for metrics:', error)
        setTraces([])
      } finally {
        setLoading(false)
      }
    }
    
    loadTraces()
  }, [metricsData])

  const metrics = metricsData ? [
    {
      label: "Total Traces (24h)",
      value: Math.min((metricsData.totalTraces || 0) / 1000, 1),
      percentage: (metricsData.totalTraces || 0).toString(),
      fraction: `${metricsData.totalTraces || 0} traces`,
    },
    {
      label: "Average Duration",
      value: metricsData.avgDuration ? 0.7 : 0, // Mock score when duration provided
      percentage: metricsData.avgDuration || "0ms",
      fraction: "response time",
    },
    {
      label: "Error Rate",
      value: metricsData.errorRate ? (1 - parseFloat(metricsData.errorRate.replace('%', '')) / 100) : 1,
      percentage: metricsData.errorRate || "0%",
      fraction: "error rate",
    },
    {
      label: "Active Operations",
      value: Math.min((metricsData.activeServices || 0) / 10, 1),
      percentage: (metricsData.activeServices || 0).toString(),
      fraction: "operations",
    },
  ] : calculateTraceMetrics(traces)

  return (
    <>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
        Observability Overview
      </h1>
      <dl className="mt-6 flex flex-wrap items-center gap-x-12 gap-y-8">
        {loading && !metricsData ? (
          // Show loading skeletons
          Array.from({ length: 4 }).map((_, index) => (
            <LoadingSkeleton key={index} />
          ))
        ) : (
          metrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))
        )}
      </dl>
    </>
  )
}
