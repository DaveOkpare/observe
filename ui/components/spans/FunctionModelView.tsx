"use client";

import React from "react";

export default function FunctionModelView({ model, error }: { model?: string; error?: string }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-mono">{model || 'function:(unknown)'}</div>
      {error ? (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800">
          <div className="font-medium mb-1">Error</div>
          <div className="text-xs break-all">{error}</div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">✅ Success</div>
      )}
    </div>
  );
}

