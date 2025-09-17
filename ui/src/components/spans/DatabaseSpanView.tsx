"use client";

import React, { useState } from "react";
import CopyButton from "../CopyButton";

export default function DatabaseSpanView({ statement, operation, duration, system }: { statement?: string; operation?: string; duration?: number; system?: string }) {
  const [showStmt, setShowStmt] = useState(false)
  return (
    <div className="space-y-2">
      <div className="text-sm"><span className="font-medium">Operation:</span> {operation || '—'}</div>
      {system && <div className="text-xs text-muted-foreground">DB: {system}</div>}
      {typeof duration === 'number' && (
        <div className="text-xs text-muted-foreground">Duration: {duration.toFixed(1)}ms</div>
      )}
      {statement && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <button className="text-xs underline text-muted-foreground hover:text-foreground" onClick={() => setShowStmt((v) => !v)}>
              {showStmt ? 'Hide statement' : 'Show statement'}
            </button>
            <CopyButton getText={() => statement} />
          </div>
          {showStmt && <pre className="text-xs bg-muted dark:bg-gray-800 p-2 rounded overflow-auto max-h-40 whitespace-pre-wrap">{statement}</pre>}
        </div>
      )}
    </div>
  );
}