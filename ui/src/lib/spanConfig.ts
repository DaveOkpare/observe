"use client";

// Configuration for adaptive span rendering system
export interface SpanRenderingConfig {
  // Feature flags
  enableLogfireConversations: boolean;
  enableAdaptiveDetection: boolean;
  enableCaching: boolean;
  enableDebugMode: boolean;
  
  // Performance settings
  cacheMaxSize: number;
  cacheTtlMs: number;
  maxConversationMessages: number;
  maxAttributeLength: number;
  
  // Platform support
  supportedPlatforms: string[];
  platformPriority: string[];
  
  // UI preferences
  showPlatformHints: boolean;
  showDebugInfo: boolean;
  showRawAttributes: boolean;
  compactMode: boolean;
  
  // Conversation rendering
  maxToolCallsToShow: number;
  truncateContent: boolean;
  maxContentLength: number;
  
  // Error handling
  fallbackToAdaptive: boolean;
  showParsingErrors: boolean;
  logErrorsToConsole: boolean;
}

// Default configuration
const defaultConfig: SpanRenderingConfig = {
  // Feature flags
  enableLogfireConversations: true,
  enableAdaptiveDetection: true,
  enableCaching: true,
  enableDebugMode: false,
  
  // Performance settings
  cacheMaxSize: 1000,
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  maxConversationMessages: 50,
  maxAttributeLength: 10000,
  
  // Platform support
  supportedPlatforms: ['logfire', 'openai', 'anthropic', 'test'],
  platformPriority: ['logfire', 'openai', 'anthropic'],
  
  // UI preferences
  showPlatformHints: true,
  showDebugInfo: false,
  showRawAttributes: false,  // Collapsed by default
  compactMode: false,
  
  // Conversation rendering
  maxToolCallsToShow: 10,
  truncateContent: true,
  maxContentLength: 2000,
  
  // Error handling
  fallbackToAdaptive: true,
  showParsingErrors: true,
  logErrorsToConsole: true
};

// Configuration store
class SpanConfigStore {
  private config: SpanRenderingConfig;
  private listeners: Array<(config: SpanRenderingConfig) => void> = [];

  constructor() {
    this.config = { ...defaultConfig };
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('span-rendering-config');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.config = { ...defaultConfig, ...parsed };
      }
    } catch (error) {
      console.warn('Failed to load span config from storage:', error);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('span-rendering-config', JSON.stringify(this.config));
    } catch (error) {
      console.warn('Failed to save span config to storage:', error);
    }
  }

  get(): SpanRenderingConfig {
    return { ...this.config };
  }

  update(updates: Partial<SpanRenderingConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveToStorage();
    this.notifyListeners();
  }

  reset(): void {
    this.config = { ...defaultConfig };
    this.saveToStorage();
    this.notifyListeners();
  }

  subscribe(listener: (config: SpanRenderingConfig) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.config));
  }
}

// Global config instance
const spanConfigStore = new SpanConfigStore();

// React hook for using config in components
import { useState, useEffect } from 'react';

export function useSpanConfig() {
  const [config, setConfig] = useState(spanConfigStore.get());

  useEffect(() => {
    return spanConfigStore.subscribe(setConfig);
  }, []);

  return {
    config,
    updateConfig: (updates: Partial<SpanRenderingConfig>) => spanConfigStore.update(updates),
    resetConfig: () => spanConfigStore.reset()
  };
}

// Utility functions for checking config
export function isFeatureEnabled(feature: keyof SpanRenderingConfig): boolean {
  const config = spanConfigStore.get();
  return Boolean(config[feature]);
}

export function getConfigValue<K extends keyof SpanRenderingConfig>(key: K): SpanRenderingConfig[K] {
  return spanConfigStore.get()[key];
}

export function isPlatformSupported(platform: string): boolean {
  const supportedPlatforms = getConfigValue('supportedPlatforms');
  return supportedPlatforms.includes(platform);
}

export function getPlatformPriority(): string[] {
  return getConfigValue('platformPriority');
}

// Export store for advanced usage
export { spanConfigStore };