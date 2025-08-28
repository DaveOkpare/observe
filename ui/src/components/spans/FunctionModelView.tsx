"use client";

import React, { useState } from "react";
import CopyButton from "../CopyButton";

export default function FunctionModelView({ model, error, params }: { model?: string; error?: string; params?: any }) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-2">
      <div className="text-sm font-mono">{model || 'function:(unknown)'}</div>
      {params && (
        <div>
          <button className="text-xs underline text-muted-foreground hover:text-foreground" onClick={() => setShow((v) => !v)}>
            {show ? 'Hide parameters' : 'Show parameters'}
          </button>
          {show && (
            <>
              <div className="flex items-center justify-end mb-1">
                <CopyButton getText={() => JSON.stringify(params, null, 2)} />
              </div>
              <pre className="text-xs bg-muted dark:bg-gray-800 p-2 rounded overflow-auto max-h-56">{JSON.stringify(params, null, 2)}</pre>
            </>
          )}
        </div>
      )}
      {error ? (
        <div className="rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-2 text-sm text-red-800 dark:text-red-200">
          <div className="font-medium mb-1">Error</div>
          <div className="text-xs break-all">{error}</div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">✅ Success</div>
      )}
    </div>
  );
}