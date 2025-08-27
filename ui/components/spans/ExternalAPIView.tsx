"use client";

import React from "react";

export default function ExternalAPIView({ address, operation, status }: { address?: string; operation?: string; status?: number }) {
  return (
    <div className="space-y-2">
      <div className="text-sm"><span className="font-medium">Address:</span> {address || '—'}</div>
      <div className="text-sm"><span className="font-medium">Operation:</span> {operation || '—'}</div>
      {typeof status === 'number' && (
        <div className="text-xs text-muted-foreground">Status: {status}</div>
      )}
    </div>
  );
}

