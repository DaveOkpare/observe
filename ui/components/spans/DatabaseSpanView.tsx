"use client";

import React from "react";

export default function DatabaseSpanView({ statement, operation, duration }: { statement?: string; operation?: string; duration?: number }) {
  return (
    <div className="space-y-2">
      <div className="text-sm"><span className="font-medium">Operation:</span> {operation || '—'}</div>
      {typeof duration === 'number' && (
        <div className="text-xs text-muted-foreground">Duration: {duration.toFixed(1)}ms</div>
      )}
      {statement && (
        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40 whitespace-pre-wrap">{statement}</pre>
      )}
    </div>
  );
}

