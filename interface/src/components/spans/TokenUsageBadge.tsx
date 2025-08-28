"use client";

function estimateCostUSD(model: string | undefined, input: number, output: number) {
  if (!model) return undefined
  const m = model.toLowerCase()
  // Very rough estimates (per 1K tokens). Adjust as needed.
  const prices: Record<string, { in: number; out: number }> = {
    'gpt-4o-mini': { in: 0.00015, out: 0.0006 },
    'gpt-4o': { in: 0.005, out: 0.015 },
    'gpt-3.5': { in: 0.0005, out: 0.0015 },
    'o3-mini': { in: 0.0002, out: 0.0008 },
  }
  const key = Object.keys(prices).find(k => m.includes(k))
  if (!key) return undefined
  const p = prices[key]
  const cost = (input / 1000) * p.in + (output / 1000) * p.out
  return Number.isFinite(cost) ? cost : undefined
}

export default function TokenUsageBadge({ input, output, total, model }: { input: number; output: number; total: number; model?: string }) {
  const cost = estimateCostUSD(model, input, output)
  const title = `Input: ${input} • Output: ${output} • Total: ${total}` + (cost !== undefined ? `\n≈ $${cost.toFixed(4)} (${model})` : '')
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs bg-muted"
      title={title}
    >
      <span>🪙</span>
      <span>{input}</span>
      <span className="opacity-60">→</span>
      <span>{output}</span>
      <span className="opacity-60">({total})</span>
    </span>
  );
}