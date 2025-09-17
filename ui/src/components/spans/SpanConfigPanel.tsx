"use client";

import React, { useState } from "react";
import { useSpanConfig } from "@/lib/spanConfig";

export default function SpanConfigPanel() {
  const { config, updateConfig, resetConfig } = useSpanConfig();
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-blue-700 text-sm z-50"
        title="Span Rendering Configuration"
      >
        ⚙️ Config
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-xl p-4 max-w-md max-h-96 overflow-y-auto z-50">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">Span Rendering Config</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4 text-sm">
        {/* Feature Flags */}
        <div>
          <h4 className="font-medium text-gray-800 mb-2">Features</h4>
          <div className="space-y-2">
            <CheckboxSetting
              label="Logfire Conversations"
              checked={config.enableLogfireConversations}
              onChange={(checked) => updateConfig({ enableLogfireConversations: checked })}
            />
            <CheckboxSetting
              label="Adaptive Detection"
              checked={config.enableAdaptiveDetection}
              onChange={(checked) => updateConfig({ enableAdaptiveDetection: checked })}
            />
            <CheckboxSetting
              label="Caching"
              checked={config.enableCaching}
              onChange={(checked) => updateConfig({ enableCaching: checked })}
            />
            <CheckboxSetting
              label="Debug Mode"
              checked={config.enableDebugMode}
              onChange={(checked) => updateConfig({ enableDebugMode: checked })}
            />
          </div>
        </div>

        {/* UI Preferences */}
        <div>
          <h4 className="font-medium text-gray-800 mb-2">UI</h4>
          <div className="space-y-2">
            <CheckboxSetting
              label="Show Platform Hints"
              checked={config.showPlatformHints}
              onChange={(checked) => updateConfig({ showPlatformHints: checked })}
            />
            <CheckboxSetting
              label="Show Debug Info"
              checked={config.showDebugInfo}
              onChange={(checked) => updateConfig({ showDebugInfo: checked })}
            />
            <CheckboxSetting
              label="Show Raw Attributes"
              checked={config.showRawAttributes}
              onChange={(checked) => updateConfig({ showRawAttributes: checked })}
            />
            <CheckboxSetting
              label="Compact Mode"
              checked={config.compactMode}
              onChange={(checked) => updateConfig({ compactMode: checked })}
            />
          </div>
        </div>

        {/* Performance Settings */}
        <div>
          <h4 className="font-medium text-gray-800 mb-2">Performance</h4>
          <div className="space-y-2">
            <NumberSetting
              label="Cache Max Size"
              value={config.cacheMaxSize}
              onChange={(value) => updateConfig({ cacheMaxSize: value })}
              min={100}
              max={5000}
              step={100}
            />
            <NumberSetting
              label="Max Messages"
              value={config.maxConversationMessages}
              onChange={(value) => updateConfig({ maxConversationMessages: value })}
              min={5}
              max={200}
              step={5}
            />
            <NumberSetting
              label="Max Content Length"
              value={config.maxContentLength}
              onChange={(value) => updateConfig({ maxContentLength: value })}
              min={500}
              max={10000}
              step={500}
            />
          </div>
        </div>

        {/* Error Handling */}
        <div>
          <h4 className="font-medium text-gray-800 mb-2">Error Handling</h4>
          <div className="space-y-2">
            <CheckboxSetting
              label="Fallback to Adaptive"
              checked={config.fallbackToAdaptive}
              onChange={(checked) => updateConfig({ fallbackToAdaptive: checked })}
            />
            <CheckboxSetting
              label="Show Parsing Errors"
              checked={config.showParsingErrors}
              onChange={(checked) => updateConfig({ showParsingErrors: checked })}
            />
            <CheckboxSetting
              label="Log Errors to Console"
              checked={config.logErrorsToConsole}
              onChange={(checked) => updateConfig({ logErrorsToConsole: checked })}
            />
          </div>
        </div>

        {/* Platform Priority */}
        <div>
          <h4 className="font-medium text-gray-800 mb-2">Platform Priority</h4>
          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
            {config.platformPriority.join(' → ')}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <button
            onClick={resetConfig}
            className="flex-1 bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
          >
            Reset to Defaults
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="flex-1 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckboxSetting({ 
  label, 
  checked, 
  onChange 
}: { 
  label: string; 
  checked: boolean; 
  onChange: (checked: boolean) => void; 
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function NumberSetting({ 
  label, 
  value, 
  onChange, 
  min, 
  max, 
  step 
}: { 
  label: string; 
  value: number; 
  onChange: (value: number) => void; 
  min: number; 
  max: number; 
  step: number; 
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}:</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-20 px-2 py-1 border rounded text-sm"
      />
    </div>
  );
}