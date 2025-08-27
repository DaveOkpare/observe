"use client";

import React from "react";

interface HTTPRequestViewProps {
  method: string;
  path: string;
  url?: string;
  status: number;
  params: Record<string, any>;
  timing?: { start: any; end: any };
}

function statusClass(status: number) {
  if (status >= 500) return "text-red-600 border-red-200";
  if (status >= 400) return "text-yellow-700 border-yellow-200";
  return "text-green-700 border-green-200";
}

export default function HTTPRequestView({ method, path, url, status, params }: HTTPRequestViewProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs rounded border px-2 py-0.5 bg-muted">{method || "—"}</span>
        <span className="font-mono text-sm break-all">{path || url || ""}</span>
        <span className={`text-xs rounded border px-2 py-0.5 ${statusClass(status)}`}>{status || 0}</span>
      </div>

      {url && (
        <div className="text-xs text-muted-foreground break-all">{url}</div>
      )}

      {params && Object.keys(params).length > 0 && (
        <div>
          <h4 className="font-medium text-sm mb-2">Parameters</h4>
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-56">{JSON.stringify(params, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

