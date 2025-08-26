"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Activity, FileText, RefreshCcw, Filter } from "lucide-react";
import { apiUrl } from "../lib/api";
import StatCard from "../components/StatCard";
import { formatDate } from "../lib/datetime";

interface Trace {
  trace_id: string;
  service_name: string;
  operation_name: string;
  start_time: string | number;
  duration_ms: number;
  span_count: number;
  status: string;
}

interface Log {
  trace_id: string;
  service_name: string;
  operation_name: string;
  timestamp: string | number;
  level: string;
  message: string;
}

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"traces" | "logs">("traces");
  const [traces, setTraces] = useState<Trace[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Filters
  const [traceService, setTraceService] = useState("");
  const [traceOperation, setTraceOperation] = useState("");
  const [logService, setLogService] = useState("");
  const [logLevel, setLogLevel] = useState("");

  const fetchTraces = async () => {
    setLoading(true);
    try {
      const url = new URL(apiUrl(`/api/traces`), window.location.origin);
      if (traceService) url.searchParams.set("service", traceService);
      if (traceOperation) url.searchParams.set("operation", traceOperation);
      const response = await fetch(url.toString());
      const data = await response.json();
      setTraces(data.traces || []);
    } catch (error) {
      console.error('Failed to fetch traces:', error);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const url = new URL(apiUrl(`/api/logs`), window.location.origin);
      if (logService) url.searchParams.set("service", logService);
      if (logLevel) url.searchParams.set("level", logLevel);
      const response = await fetch(url.toString());
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => {
    if (activeTab === 'traces') {
      fetchTraces();
    } else {
      fetchLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      activeTab === 'traces' ? fetchTraces() : fetchLogs();
    }, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, activeTab, traceService, traceOperation, logService, logLevel]);

  const formatTime = (v: string | number) => formatDate(v);

  const formatDuration = (durationMs: number) => {
    if (durationMs < 1) return `${(durationMs * 1000).toFixed(0)}μs`;
    if (durationMs < 1000) return `${durationMs.toFixed(1)}ms`;
    return `${(durationMs / 1000).toFixed(2)}s`;
  };

  const getStatusColor = (status: string) => {
    return status === 'ok' ? 'text-green-600' : 'text-red-600';
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

  const stats = useMemo(() => {
    if (activeTab !== 'traces' || traces.length === 0) return null;
    const total = traces.length;
    const avg = traces.reduce((s, t) => s + t.duration_ms, 0) / total;
    const errors = traces.filter((t) => t.status !== 'ok').length;
    const errorRate = ((errors / total) * 100).toFixed(0) + '%';
    return { total, avg: `${avg.toFixed(1)}ms`, errorRate };
  }, [traces, activeTab]);

  return (
    <div className="min-h-[70vh]">
        <div className="bg-card rounded-lg shadow-sm border">
          <div className="border-b border-border">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('traces')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'traces'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <Activity className="w-4 h-4 inline mr-2" />
                Traces ({traces.length})
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'logs'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Logs ({logs.length})
              </button>
              <div className="ml-auto flex items-center gap-3 pr-4">
                <button
                  onClick={() => (activeTab === 'traces' ? fetchTraces() : fetchLogs())}
                  className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </button>
                <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
                  Auto-refresh
                </label>
                {lastRefreshed && (
                  <span className="text-xs text-gray-500">Updated {lastRefreshed.toLocaleTimeString()}</span>
                )}
              </div>
            </nav>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-muted-foreground">Loading...</p>
              </div>
            ) : (
              <>
                {activeTab === 'traces' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold">Recent Traces</h2>
                    </div>
                    {stats && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                        <StatCard label="Traces" value={stats.total} />
                        <StatCard label="Avg Duration" value={stats.avg} />
                        <StatCard label="Error Rate" value={stats.errorRate} />
                      </div>
                    )}
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                      <div className="flex-1">
                        <label className="block text-xs text-muted-foreground">Service</label>
                        <input value={traceService} onChange={(e) => setTraceService(e.target.value)} placeholder="e.g. api-gateway" className="w-full rounded border border-border bg-background px-3 py-2 text-sm" />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-muted-foreground">Operation</label>
                        <input value={traceOperation} onChange={(e) => setTraceOperation(e.target.value)} placeholder="e.g. GET /users" className="w-full rounded border border-border bg-background px-3 py-2 text-sm" />
                      </div>
                      <button onClick={fetchTraces} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-muted">
                        <Filter className="h-4 w-4" /> Apply
                      </button>
                    </div>
                    {traces.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No traces found</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-border">
                          <thead className="bg-muted">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Service
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Operation
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Duration
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Spans
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Time
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-card divide-y divide-border">
                            {traces.map((trace, index) => (
                              <tr 
                                key={`${trace.trace_id}-${index}`} 
                                className="hover:bg-muted cursor-pointer"
                                onClick={() => router.push(`/traces/${trace.trace_id}`)}
                              >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                                  {trace.service_name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                  {trace.operation_name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                  {formatDuration(trace.duration_ms)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                  {trace.span_count}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <span className={getStatusColor(trace.status)}>
                                    {trace.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                  {formatTime(trace.start_time)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'logs' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold">Recent Logs</h2>
                    </div>
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                      <div className="flex-1">
                        <label className="block text-xs text-muted-foreground">Service</label>
                        <input value={logService} onChange={(e) => setLogService(e.target.value)} placeholder="e.g. api-gateway" className="w-full rounded border border-border bg-background px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground">Level</label>
                        <select value={logLevel} onChange={(e) => setLogLevel(e.target.value)} className="w-full rounded border border-border bg-background px-3 py-2 text-sm">
                          <option value="">Any</option>
                          <option value="DEBUG">DEBUG</option>
                          <option value="INFO">INFO</option>
                          <option value="WARNING">WARNING</option>
                          <option value="ERROR">ERROR</option>
                        </select>
                      </div>
                      <button onClick={fetchLogs} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-muted">
                        <Filter className="h-4 w-4" /> Apply
                      </button>
                    </div>
                    {logs.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No logs found</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-border">
                          <thead className="bg-muted">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Level
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Service
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Message
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Time
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-card divide-y divide-border">
                            {logs.map((log, index) => (
                              <tr key={`${log.trace_id}-${index}`} className="hover:bg-muted">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <span className={getLevelColor(log.level)}>
                                    {log.level}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                                  {log.service_name}
                                </td>
                                <td className="px-6 py-4 text-sm text-muted-foreground max-w-md truncate">
                                  {log.message}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                  {formatTime(log.timestamp)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
      </div>
    </div>
  );
}
