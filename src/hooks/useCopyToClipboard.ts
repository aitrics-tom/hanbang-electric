/**
 * useCopyToClipboard - 클립보드 복사 Hook
 */

import { useState, useCallback } from 'react';

interface UseCopyToClipboardResult {
  copied: boolean;
  copy: (text: string) => Promise<void>;
}

export function useCopyToClipboard(resetDelay = 2000): UseCopyToClipboardResult {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), resetDelay);
    } catch (err) {
      console.error('[useCopyToClipboard] 클립보드 복사 실패:', {
        error: err instanceof Error ? err.message : err,
        stack: err instanceof Error ? err.stack : undefined,
        textLength: text.length,
        timestamp: new Date().toISOString(),
      });
      setCopied(false);
    }
  }, [resetDelay]);

  return { copied, copy };
}
