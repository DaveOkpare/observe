import React, { useState } from "react";
import { Button } from "./Button";
import { AnnotationResponse, generateAIAnnotation } from "@/lib/api";

interface AISuggestionProps {
  traceId: string;
  serviceName: string;
  onAnnotationGenerated: (annotation: AnnotationResponse) => void;
}

export function AISuggestion({ traceId, serviceName, onAnnotationGenerated }: AISuggestionProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const annotation = await generateAIAnnotation(traceId);
      onAnnotationGenerated(annotation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate AI annotation');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="ai-suggestion p-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">AI Analysis Available</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Based on expert annotations for {serviceName}</p>
        </div>
        <Button
          variant="secondary"
          onClick={handleGenerateAI}
          isLoading={isGenerating}
          disabled={isGenerating}
          loadingText="Analyzing..."
        >
          {isGenerating ? 'Analyzing...' : 'Get AI Suggestion'}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>
      )}
    </div>
  );
}