import React from "react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { AnnotationResponse } from "@/lib/api";
import { RiThumbUpFill, RiThumbDownFill } from "@remixicon/react";

interface AnnotationDisplayProps {
  annotation: AnnotationResponse;
  onEdit: () => void;
}

export function AnnotationDisplay({ annotation, onEdit }: AnnotationDisplayProps) {
  return (
    <div className="annotation-display p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold">Feedback</h3>
        <div className="flex items-center gap-2">
          {annotation.is_human ? (
            <Badge variant="success">Human</Badge>
          ) : (
            <Badge variant="warning">
              AI · {annotation.confidence_category}
            </Badge>
          )}
          <Button variant="secondary" onClick={onEdit}>
            Edit
          </Button>
        </div>
      </div>
      
      {annotation.feedback && (
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={annotation.feedback === 'down' ? 'error' : 'success'}>
            {annotation.feedback === 'down' ? (
              <RiThumbDownFill className="size-3" />
            ) : (
              <RiThumbUpFill className="size-3" />
            )}
            {annotation.feedback === 'down' ? 'Not helpful' : 'Helpful'}
          </Badge>
        </div>
      )}
      
      {annotation.annotation && (
        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
          {annotation.annotation}
        </p>
      )}
    </div>
  );
}