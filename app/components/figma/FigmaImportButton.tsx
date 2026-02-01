'use client';

import React, { useState } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { FigmaImportDialog } from './FigmaImportDialog';
import type { FigmaImportRequest } from '~/types/figma';

interface FigmaImportButtonProps {
  onImportComplete?: (componentCode: string) => void;
  className?: string;
}

export const FigmaImportButton: React.FC<FigmaImportButtonProps> = ({
  onImportComplete,
  className,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleImport = async (data: FigmaImportRequest) => {
    try {
      const response = await fetch('/api/figma/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to import Figma design');
      }

      const result = await response.json();
      onImportComplete?.(result.code);
    } catch (error) {
      throw error;
    }
  };

  return (
    <>
      <IconButton
        className={className}
        title="Import from Figma"
        onClick={() => setIsDialogOpen(true)}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2v4m0 4v4m0 4v4M6 12h4m4 0h4M8 8h2v2H8V8m4 0h2v2h-2V8m4 0h2v2h-2V8" />
        </svg>
      </IconButton>

      <FigmaImportDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onImport={handleImport}
      />
    </>
  );
};

export default FigmaImportButton;
