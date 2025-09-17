import React, { useState } from "react";
import { Button } from "./Button";
import { AnnotationRequest, AnnotationResponse, saveTraceAnnotation } from "@/lib/api";
import { RiThumbUpFill, RiThumbDownFill } from "@remixicon/react";

interface AnnotationFormProps {
  traceId: string;
  initialData?: Partial<AnnotationRequest>;
  onSave: (annotation: AnnotationResponse) => void;
  onCancel: () => void;
}

export function AnnotationForm({ traceId, initialData, onSave, onCancel }: AnnotationFormProps) {
  const [feedback, setFeedback] = useState<'up' | 'down' | undefined>(initialData?.feedback);
  const [annotation, setAnnotation] = useState(initialData?.annotation || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const data: AnnotationRequest = {};
      if (feedback) data.feedback = feedback;
      if (annotation.trim()) data.annotation = annotation.trim();

      const savedAnnotation = await saveTraceAnnotation(traceId, data);
      onSave(savedAnnotation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save annotation');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="annotation-form p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Feedback</label>
        <div className="flex gap-2">
          <Button
            variant={feedback === 'up' ? 'primary' : 'secondary'}
            onClick={() => setFeedback(feedback === 'up' ? undefined : 'up')}
            className="flex items-center gap-1"
          >
            <RiThumbUpFill className="size-4" />
            Helpful
          </Button>
          <Button
            variant={feedback === 'down' ? 'destructive' : 'secondary'}
            onClick={() => setFeedback(feedback === 'down' ? undefined : 'down')}
            className="flex items-center gap-1"
          >
            <RiThumbDownFill className="size-4" />
            Not helpful
          </Button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Annotation <span className="text-gray-500">(optional)</span>
        </label>
        <textarea
          value={annotation}
          onChange={(e) => setAnnotation(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
          placeholder="Explain why this trace is helpful or problematic..."
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          isLoading={isSaving}
          disabled={isSaving || (!feedback && !annotation.trim())}
          loadingText="Saving..."
        >
          Save Annotation
        </Button>
      </div>
    </div>
  );
}