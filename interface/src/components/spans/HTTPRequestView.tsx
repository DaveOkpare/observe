"use client";

import React from "react";

interface HTTPRequestViewProps {
  method: string;
  path: string;
  url?: string;
  status: number;
  params: Record<string, any>;
  timing?: { start: any; end: any };
  durationMs?: number;
}

function statusClass(status?: number) {
  if (!status || status <= 0) return "text-muted-foreground border-border";
  if (status >= 500) return "text-red-600 border-red-200";
  if (status >= 400) return "text-yellow-700 border-yellow-200";
  return "text-green-700 border-green-200";
}

function methodClass(method: string) {
  const m = (method || '').toUpperCase();
  switch (m) {
    case 'GET': return 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800';
    case 'POST': return 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800';
    case 'PUT': return 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800';
    case 'DELETE': return 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800';
    default: return 'bg-muted dark:bg-gray-800';
  }
}

function statusText(code?: number) {
  if (!code) return 'Unknown status'
  const map: Record<number, string> = {
    200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content',
    301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 408: 'Request Timeout',
    409: 'Conflict', 422: 'Unprocessable Entity',
    500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout',
  }
  return map[code] || `${Math.floor(code / 100)}xx`
}

export default function HTTPRequestView({ method, path, url, status, params, durationMs }: HTTPRequestViewProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`font-mono text-xs rounded border px-2 py-0.5 ${methodClass(method)}`}>{method || "—"}</span>
        <span className="font-mono text-sm break-all">{path || url || ""}</span>
        <span className={`text-xs rounded border px-2 py-0.5 ${statusClass(status)}`} title={statusText(status)}>{typeof status === 'number' && status > 0 ? status : '—'}</span>
        {typeof durationMs === 'number' && (
          <span className="text-xs text-muted-foreground">{durationMs.toFixed(1)}ms</span>
        )}
      </div>

      {url && (
        <div className="text-xs break-all">
          <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
            {url}
          </a>
        </div>
      )}

      {params && Object.keys(params).length > 0 && (
        <div>
          <h4 className="font-medium text-sm mb-2">Parameters</h4>
          <div className="text-xs border rounded overflow-hidden">
            {Object.entries(params).map(([k, v], i) => (
              <div key={k} className={`flex items-start justify-between gap-2 p-2 ${i % 2 ? 'bg-muted/50 dark:bg-gray-800/50' : ''}`}>
                <span className="font-mono font-medium">{k}</span>
                <span className="ml-auto text-right break-all">{typeof v === 'string' ? v : JSON.stringify(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}