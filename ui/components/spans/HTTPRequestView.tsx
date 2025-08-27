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
    case 'GET': return 'bg-blue-50 border-blue-200';
    case 'POST': return 'bg-green-50 border-green-200';
    case 'PUT': return 'bg-yellow-50 border-yellow-200';
    case 'DELETE': return 'bg-red-50 border-red-200';
    default: return 'bg-muted';
  }
}

export default function HTTPRequestView({ method, path, url, status, params, durationMs }: HTTPRequestViewProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`font-mono text-xs rounded border px-2 py-0.5 ${methodClass(method)}`}>{method || "—"}</span>
        <span className="font-mono text-sm break-all">{path || url || ""}</span>
        <span className={`text-xs rounded border px-2 py-0.5 ${statusClass(status)}`}>{typeof status === 'number' && status > 0 ? status : '—'}</span>
        {typeof durationMs === 'number' && (
          <span className="text-xs text-muted-foreground">{durationMs.toFixed(1)}ms</span>
        )}
      </div>

      {url && (
        <div className="text-xs text-muted-foreground break-all">{url}</div>
      )}

      {params && Object.keys(params).length > 0 && (
        <div>
          <h4 className="font-medium text-sm mb-2">Parameters</h4>
          <div className="text-xs border rounded overflow-hidden">
            {Object.entries(params).map(([k, v], i) => (
              <div key={k} className={`flex items-start justify-between gap-2 p-2 ${i % 2 ? 'bg-muted/50' : ''}`}>
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
