"use client";

import React from "react";
import CopyButton from "../CopyButton";

export default function ExternalAPIView({ address, operation, status, method, url }: { address?: string; operation?: string; status?: number; method?: string; url?: string }) {
  return (
    <div className="space-y-2">
      <div className="text-sm"><span className="font-medium">Address:</span> {address || '—'}</div>
      <div className="text-sm"><span className="font-medium">Operation:</span> {operation || '—'}</div>
      {typeof status === 'number' && (
        <div className="text-xs text-muted-foreground">Status: {status}</div>
      )}
      {method && (
        <div className="text-xs text-muted-foreground">Method: {method}</div>
      )}
      {url && (
        <div className="text-xs break-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-muted-foreground">URL</span>
            <CopyButton getText={() => url} />
          </div>
          <a href={url} target="_blank" rel="noopener noreferrer" className="font-mono underline">
            {url}
          </a>
        </div>
      )}
    </div>
  );
}