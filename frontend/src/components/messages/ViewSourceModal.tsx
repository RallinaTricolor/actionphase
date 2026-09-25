import { useEffect, useRef, useState } from 'react';
import { Button, Modal, Textarea } from '@/components/ui';
import { copyToClipboard } from '@/utils/clipboard';
import { logger } from '@/services/LoggingService';

interface ViewSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Raw markdown to show, exactly as the author wrote it. */
  content: string;
  /** "post" or "comment" — only used in the title. */
  kind: 'post' | 'comment';
}

/**
 * Shows the raw markdown behind a post or comment, like Reddit's "view source".
 *
 * Exists so a GM can reuse formatting (tables especially) from a post that has
 * moved into the history, where it can no longer be opened for editing. The
 * textarea is read-only rather than disabled so the text can still be selected
 * piecemeal; the Copy button covers the common copy-everything case.
 */
export function ViewSourceModal({ isOpen, onClose, content, kind }: ViewSourceModalProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  }, []);

  const handleCopy = async () => {
    try {
      await copyToClipboard(content);
      setCopyState('copied');
    } catch (err) {
      logger.error('Failed to copy markdown source', { error: err });
      setCopyState('error');
    }
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setCopyState('idle'), 2000);
  };

  const handleClose = () => {
    setCopyState('idle');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={kind === 'post' ? 'Post source' : 'Comment source'}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button
            variant={copyState === 'error' ? 'danger' : 'primary'}
            onClick={handleCopy}
            data-testid="copy-markdown-source"
          >
            {copyState === 'copied' ? 'Copied!' : copyState === 'error' ? 'Copy failed' : 'Copy markdown'}
          </Button>
        </>
      }
    >
      <Textarea
        value={content}
        readOnly
        rows={16}
        aria-label="Markdown source"
        data-testid="markdown-source"
        className="font-mono text-sm resize-y"
      />
    </Modal>
  );
}
