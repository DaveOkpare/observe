"use client";

import React, { useState } from "react";
import CopyButton from "../CopyButton";
import JsonCode from "../JsonCode";

interface AdaptiveSpanViewProps {
  operationName: string;
  meaningfulFields: Record<string, any>;
  allAttributes: Record<string, any>;
}

export default function AdaptiveSpanView({ operationName, meaningfulFields, allAttributes }: AdaptiveSpanViewProps) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs rounded border px-2 py-0.5 bg-muted">Unknown Type</span>
        <span className="font-mono text-sm truncate" title={operationName}>{operationName}</span>
      </div>

      {Object.keys(meaningfulFields).length > 0 && (
        <div>
          <h4 className="font-medium text-sm mb-2">Key Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {Object.entries(meaningfulFields).map(([key, value]) => (
              <div key={key} className="flex justify-between p-2 bg-muted rounded">
                <span className="font-medium truncate" title={key}>{key}:</span>
                <span className="text-right truncate ml-2" title={String(value)}>{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <button
          type="button"
          className="text-xs underline text-muted-foreground hover:text-foreground"
          onClick={() => setShowRaw((v) => !v)}
        >
          {showRaw ? 'Hide raw attributes' : 'Show raw attributes'}
        </button>
        <div className="mt-1 flex justify-end">
          <CopyButton getText={() => JSON.stringify(allAttributes, null, 2)} />
        </div>
        {showRaw && (
          <div className="mt-2">
            <JsonCode value={allAttributes} />
          </div>
        )}
      </div>
    </div>
  );
}
