"use client";

import React from "react";

export default function CopyButton({ getText, label = "Copy" }: { getText: () => string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      className="text-xs rounded border px-2 py-0.5 hover:bg-muted"
      aria-label="Copy to clipboard"
    >
      {copied ? "Copied" : label}
    </button>
  );
}