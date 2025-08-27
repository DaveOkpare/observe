"use client";

export default function TokenUsageBadge({ input, output, total }: { input: number; output: number; total: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs bg-muted"
      title={`Input: ${input} • Output: ${output} • Total: ${total}`}
    >
      <span>🪙</span>
      <span>{input}</span>
      <span className="opacity-60">→</span>
      <span>{output}</span>
      <span className="opacity-60">({total})</span>
    </span>
  );
}

