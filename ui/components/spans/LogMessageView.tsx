"use client";

import React from "react";

export default function LogMessageView({ level, file, func, line, message }: { level?: number | string; file?: string; func?: string; line?: number; message?: string }) {
  const levelText = typeof level === 'number' ? levelToText(level) : (level || 'INFO')
  const color = levelToColor(levelText)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${color}`}>{levelText}</span>
        {(file || line) && (
          <span className="text-xs font-mono text-muted-foreground">{file}{typeof line === 'number' ? `:${line}` : ''}</span>
        )}
      </div>
      <div className="text-sm whitespace-pre-wrap">{message || '—'}</div>
      {func && <div className="text-xs text-muted-foreground">in {func}()</div>}
    </div>
  );
}

function levelToText(n: number) {
  if (n >= 50) return 'ERROR'
  if (n >= 40) return 'WARNING'
  if (n >= 30) return 'INFO'
  return 'DEBUG'
}

function levelToColor(level: string) {
  switch (level) {
    case 'ERROR': return 'text-red-600'
    case 'WARNING': return 'text-yellow-700'
    case 'INFO': return 'text-blue-600'
    default: return 'text-gray-500'
  }
}

