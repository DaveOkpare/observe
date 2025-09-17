"use client";

import type { SpanAnalysis } from './spanAnalysis';

// Simple in-memory cache with TTL and size limits
class SpanAnalysisCache {
  private cache = new Map<string, { analysis: SpanAnalysis; timestamp: number }>();
  private readonly maxSize = 1000; // Maximum cached items
  private readonly ttlMs = 5 * 60 * 1000; // 5 minutes TTL

  private generateKey(span: any): string {
    // Create a cache key based on span identity and attributes hash
    const spanId = span?.span_id || span?.id;
    const attributesHash = this.hashAttributes(span?.attributes || {});
    return `${spanId}-${attributesHash}`;
  }

  private hashAttributes(attributes: Record<string, any>): string {
    // Simple hash of attribute keys and some values for cache invalidation
    const relevantKeys = [
      'pydantic_ai.all_messages',
      'gen_ai.usage.input_tokens', 
      'gen_ai.usage.output_tokens',
      'gen_ai.system_instructions',
      'model_name',
      'agent_name'
    ];
    
    const relevantData = relevantKeys
      .filter(key => attributes[key] !== undefined)
      .map(key => `${key}:${typeof attributes[key] === 'string' ? attributes[key].length : JSON.stringify(attributes[key]).length}`)
      .join('|');
    
    return btoa(relevantData).slice(0, 16); // Simple base64 hash
  }

  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.ttlMs;
  }

  private evictOldEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry.timestamp)) {
        this.cache.delete(key);
      }
    }
    
    // If still over size limit, remove oldest entries
    if (this.cache.size > this.maxSize) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, this.cache.size - this.maxSize);
      for (const [key] of toRemove) {
        this.cache.delete(key);
      }
    }
  }

  get(span: any): SpanAnalysis | null {
    try {
      const key = this.generateKey(span);
      const entry = this.cache.get(key);
      
      if (!entry || this.isExpired(entry.timestamp)) {
        if (entry) this.cache.delete(key);
        return null;
      }
      
      return entry.analysis;
    } catch (error) {
      console.warn('Cache get error:', error);
      return null;
    }
  }

  set(span: any, analysis: SpanAnalysis): void {
    try {
      const key = this.generateKey(span);
      this.cache.set(key, {
        analysis,
        timestamp: Date.now()
      });
      
      // Periodically clean up cache
      if (this.cache.size > this.maxSize * 1.1) {
        this.evictOldEntries();
      }
    } catch (error) {
      console.warn('Cache set error:', error);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }
}

// Global cache instance
const spanAnalysisCache = new SpanAnalysisCache();

// Cache-aware analysis function
export function getCachedSpanAnalysis(span: any, analyzeSpanFn: (span: any) => SpanAnalysis): SpanAnalysis {
  // Try cache first
  const cached = spanAnalysisCache.get(span);
  if (cached) {
    return cached;
  }
  
  // Perform analysis and cache result
  const analysis = analyzeSpanFn(span);
  spanAnalysisCache.set(span, analysis);
  
  return analysis;
}

// Export cache for debugging/stats
export { spanAnalysisCache };