"use client"
import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table"
import { fetchTraces, FetchTracesParams, fetchServices } from "@/lib/api"
import { formatDate } from "@/lib/datetime"
import { cx } from "@/lib/utils"
import { Download, Clock, Database, Activity, Sparkles } from "lucide-react"
import { useEffect, useState, Fragment } from "react"
import { useRouter } from "next/navigation"
import TextToSQLModal from "@/components/TextToSQLModal"

interface Trace {
  trace_id: string
  operation_name: string
  service_name: string
  start_time: string | number
  duration_ms: number
  span_count: number
  status: string
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function getStatusBadgeVariant(status: string | undefined) {
  if (!status) return 'default'
  switch (status.toLowerCase()) {
    case 'ok': case 'success': return 'success'
    case 'error': case 'failed': return 'error'
    case 'timeout': case 'cancelled': return 'warning'
    default: return 'default'
  }
}

// Get status from transformed trace data
function getStatusFromTrace(trace: any): string {
  // Use the status from transformed data, fallback to 'ok'
  return trace.status || 'ok';
}

function getTimeRangeTimestamps(range: string): { start_time?: string; end_time?: string } {
  const now = new Date();
  const endTime = now.toISOString();

  switch (range) {
    case '1h':
      return {
        start_time: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
        end_time: endTime
      };
    case '6h':
      return {
        start_time: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
        end_time: endTime
      };
    case '24h':
      return {
        start_time: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        end_time: endTime
      };
    case '7d':
      return {
        start_time: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end_time: endTime
      };
    case 'all':
    default:
      return {};
  }
}

export default function Overview() {
  const [traces, setTraces] = useState<Trace[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [serviceFilter, setServiceFilter] = useState('all')
  const [operationFilter, setOperationFilter] = useState('')
  const [timeRange, setTimeRange] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [services, setServices] = useState<string[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    total: 0,
    has_more: false
  })
  const itemsPerPage = 50
  const router = useRouter()

  // Load services once on component mount
  useEffect(() => {
    async function loadServices() {
      try {
        const response = await fetchServices()
        if (response.success) {
          setServices(response.services)
        }
      } catch (error) {
        console.error('Failed to fetch services:', error)
      } finally {
        setServicesLoading(false)
      }
    }
    loadServices()
  }, [])

  useEffect(() => {
    async function loadTraces() {
      try {
        setLoading(true)
        const timeParams = getTimeRangeTimestamps(timeRange)
        const params: FetchTracesParams = {
          limit: itemsPerPage,
          offset: (currentPage - 1) * itemsPerPage,
          ...timeParams
        }

        if (serviceFilter && serviceFilter !== 'all') {
          params.service = serviceFilter
        }

        if (operationFilter.trim()) {
          params.operation = operationFilter.trim()
        }

        const response = await fetchTraces(params)
        setTraces(response.data || [])
        setPagination(response.pagination)
      } catch (error) {
        console.error('Failed to fetch traces:', error)
      } finally {
        setLoading(false)
      }
    }
    loadTraces()
  }, [serviceFilter, operationFilter, timeRange, currentPage])

  // Filter traces based on search term (client-side search for quick filtering)
  const filteredTraces = traces.filter(trace =>
    trace.service_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trace.operation_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trace.trace_id.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  return (
    <section aria-label="Traces Overview" className="min-h-screen bg-white dark:bg-gray-950">
      <div className="flex flex-col justify-between gap-4 px-4 py-6 sm:p-6 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Input
            type="search"
            placeholder="Search traces..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="sm:w-64 [&>input]:py-1.5"
          />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-full py-1.5 sm:w-32">
                <SelectValue placeholder="Time range..." />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="1h">Last hour</SelectItem>
                <SelectItem value="6h">Last 6 hours</SelectItem>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>

            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="w-full py-1.5 sm:w-44">
                <SelectValue placeholder="Filter by service..." />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">All Services</SelectItem>
                {services.map(service => (
                  <SelectItem key={service} value={service}>{service}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="text"
              placeholder="Filter by operation..."
              value={operationFilter}
              onChange={(e) => setOperationFilter(e.target.value)}
              className="sm:w-48 [&>input]:py-1.5"
            />
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {loading ? 'Loading...' : `${pagination.total} traces found`}
          </div>
          <div className="flex gap-2">
            <TextToSQLModal>
              <Button
                variant="secondary"
                className="gap-2 py-1.5 text-sm border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <Sparkles className="size-4" />
                AI Search
              </Button>
            </TextToSQLModal>
            <Button
              variant="secondary"
              className="gap-2 py-1.5 text-sm"
            >
              <Download
                className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
                aria-hidden="true"
              />
              Export
            </Button>
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center p-8">
          <Activity className="animate-spin size-6" />
        </div>
      ) : (
        <TableRoot className="bg-white dark:bg-gray-950">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Service</TableHeaderCell>
                <TableHeaderCell>Duration</TableHeaderCell>
                <TableHeaderCell>Span Count</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Operation</TableHeaderCell>
                <TableHeaderCell>Time</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTraces.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No traces found
                  </TableCell>
                </TableRow>
              ) : (
                filteredTraces.map((trace) => (
                  <TableRow
                    key={trace.trace_id}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800"
                    onClick={() => router.push(`/traces/${trace.trace_id}`)}
                  >
                    <TableCell className="font-mono text-xs dark:text-gray-200">
                      {trace.service_name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="size-3 text-gray-400 dark:text-gray-500" />
                        {formatDuration(trace.duration_ms)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral" className="rounded-full">
                        {trace.span_count} spans
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getStatusBadgeVariant(getStatusFromTrace(trace))}
                        className="rounded-full"
                      >
                        <span
                          className={cx(
                            "size-1.5 shrink-0 rounded-full mr-1",
                            getStatusFromTrace(trace).toLowerCase() === 'ok' && "bg-emerald-600 dark:bg-emerald-400",
                            getStatusFromTrace(trace).toLowerCase() === 'error' && "bg-red-600 dark:bg-red-400",
                            !['ok', 'error'].includes(getStatusFromTrace(trace).toLowerCase()) && "bg-gray-500 dark:bg-gray-500"
                          )}
                          aria-hidden="true"
                        />
                        {getStatusFromTrace(trace)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs truncate max-w-48 dark:text-gray-200" title={trace.operation_name}>
                      {trace.operation_name}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground dark:text-gray-400">
                      {formatDate(trace.start_time)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableRoot>
      )}
      
      {!loading && traces.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
          <div className="text-sm text-gray-500 dark:text-gray-300">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total} traces
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              className="px-3 py-1 text-sm"
            >
              Previous
            </Button>
            <span className="text-sm text-gray-500 dark:text-gray-300">
              Page {currentPage} of {Math.ceil(pagination.total / itemsPerPage)}
            </span>
            <Button
              variant="secondary"
              disabled={!pagination.has_more}
              onClick={() => setCurrentPage(currentPage + 1)}
              className="px-3 py-1 text-sm"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
