import { useState, useRef, useEffect, memo } from 'react';
import { MarkdownPreview } from './MarkdownPreview';
import { CharacterAutocomplete } from './CharacterAutocomplete';
import { Button, Textarea } from './ui';
import type { Character } from '../types/characters';

interface CommentEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  showPreviewByDefault?: boolean;
  characters?: Character[]; // Characters available for mention autocomplete
  id?: string; // HTML id for label association
  maxLength?: number; // Maximum character limit
  showCharacterCount?: boolean; // Show character counter below textarea
}

/**
 * CommentEditor Component
 *
 * A markdown-enabled text editor with live preview functionality.
 * Replaces plain textareas in comment forms.
 *
 * Features:
 * - Live markdown preview toggle
 * - Split view (editor | preview)
 * - Markdown help reference
 * - Support for character mentions (@CharacterName)
 */
export const CommentEditor = memo(function CommentEditor({
  value,
  onChange,
  placeholder = 'Write your comment...',
  disabled = false,
  rows = 4,
  showPreviewByDefault = false,
  characters = [],
  id,
  maxLength,
  showCharacterCount = false,
}: CommentEditorProps) {
  const [showPreview, setShowPreview] = useState(showPreviewByDefault);
  const [showHelp, setShowHelp] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStartIndex, setMentionStartIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Calculate cursor position for autocomplete dropdown
  const getCaretCoordinates = (element: HTMLTextAreaElement, position: number) => {
    // Get the textarea's position in viewport
    const rect = element.getBoundingClientRect();

    // Create a mirror div to measure text position
    const computed = window.getComputedStyle(element);
    const div = document.createElement('div');

    // Copy styles from textarea
    const styles = [
      'fontSize', 'fontFamily', 'fontWeight', 'wordWrap',
      'whiteSpace', 'borderWidth', 'paddingLeft', 'paddingRight',
      'paddingTop', 'paddingBottom', 'lineHeight',
    ];
    styles.forEach(style => {
      const styleProp = style as keyof CSSStyleDeclaration;
      const value = computed[styleProp];
      if (typeof value === 'string') {
        (div.style as unknown as Record<string, string>)[style] = value;
      }
    });

    // Position the mirror div at the same place as textarea
    div.style.position = 'absolute';
    div.style.top = '0px';
    div.style.left = '0px';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.width = element.clientWidth + 'px';
    div.textContent = element.value.substring(0, position);

    // Add a span at cursor position
    const span = document.createElement('span');
    span.textContent = '|'; // Cursor marker
    div.appendChild(span);

    document.body.appendChild(div);

    const spanRect = span.getBoundingClientRect();
    const divRect = div.getBoundingClientRect();

    document.body.removeChild(div);

    // Calculate position relative to viewport
    const top = rect.top + (spanRect.top - divRect.top) - element.scrollTop + 20;
    const left = rect.left + (spanRect.left - divRect.left);

    return { top, left };
  };

  // Detect @ and trigger autocomplete
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart || 0;

    onChange(newValue);

    // Only show autocomplete if characters are available
    if (characters.length === 0) {
      setShowAutocomplete(false);
      return;
    }

    // Look for @ before cursor
    const textBeforeCursor = newValue.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex === -1) {
      setShowAutocomplete(false);
      return;
    }

    // Check if there's a space between @ and cursor (cancels mention)
    // Also limit mention length to 50 characters for performance
    const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
    if (textAfterAt.includes(' ') || textAfterAt.includes('\n') || textAfterAt.length > 50) {
      setShowAutocomplete(false);
      return;
    }

    // Show autocomplete and calculate position for dropdown
    setShowAutocomplete(true);
    setAutocompleteQuery(textAfterAt);
    setMentionStartIndex(lastAtIndex);
    setSelectedIndex(0);

    // Calculate dropdown position (only when showing autocomplete)
    if (textareaRef.current) {
      const position = getCaretCoordinates(textareaRef.current, cursorPosition);
      setAutocompletePosition(position);
    }
  };

  // Handle character selection from autocomplete
  const handleSelectCharacter = (character: Character) => {
    if (!textareaRef.current) return;

    const before = value.substring(0, mentionStartIndex);
    const after = value.substring(textareaRef.current.selectionStart || 0);
    const newValue = before + `@${character.name} ` + after;

    onChange(newValue);
    setShowAutocomplete(false);

    // Set cursor after mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionStartIndex + character.name.length + 2; // @ + name + space
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);
  };

  // Handle keyboard navigation in autocomplete
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showAutocomplete) return;

    const filteredCharacters = characters.filter((char) =>
      char.name.toLowerCase().includes(autocompleteQuery.toLowerCase())
    );

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCharacters.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCharacters.length) % filteredCharacters.length);
        break;
      case 'Enter':
        if (filteredCharacters.length > 0) {
          e.preventDefault();
          handleSelectCharacter(filteredCharacters[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowAutocomplete(false);
        break;
    }
  };

  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowAutocomplete(false);
    };

    if (showAutocomplete) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showAutocomplete]);

  return (
    <div className="comment-editor">
      {/* Editor Header with Controls */}
      <div className="flex items-center justify-between mb-2 text-xs text-content-secondary">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            disabled={disabled}
          >
            {showPreview ? '👁️ Hide Preview' : '👁️ Show Preview'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowHelp(!showHelp)}
            disabled={disabled}
          >
            ❓ Markdown Help
          </Button>
        </div>

        <span className="text-content-tertiary">
          {value.length} characters
        </span>
      </div>

      {/* Markdown Help Panel */}
      {showHelp && (
        <div className="mb-3 p-3 bg-interactive-primary-subtle border border-interactive-primary rounded text-xs">
          <div className="font-semibold text-interactive-primary mb-2">Markdown Quick Reference</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-content-primary">
            <div>
              <code className="surface-sunken px-1 rounded">**bold**</code> → <strong>bold</strong>
            </div>
            <div>
              <code className="surface-sunken px-1 rounded">*italic*</code> → <em>italic</em>
            </div>
            <div>
              <code className="surface-sunken px-1 rounded">[link](url)</code> → link
            </div>
            <div>
              <code className="surface-sunken px-1 rounded">`code`</code> → <code className="surface-sunken px-1">code</code>
            </div>
            <div>
              <code className="surface-sunken px-1 rounded"># Heading</code> → Heading
            </div>
            <div>
              <code className="surface-sunken px-1 rounded">- list item</code> → • list item
            </div>
            <div>
              <code className="surface-sunken px-1 rounded">&gt; quote</code> → blockquote
            </div>
            <div>
              <code className="surface-sunken px-1 rounded">@CharacterName</code> → mention
            </div>
          </div>
        </div>
      )}

      {/* Editor and Preview */}
      <div className={`grid ${showPreview ? 'grid-cols-2 gap-3' : 'grid-cols-1'}`}>
        {/* Textarea */}
        <div className="relative">
          <Textarea
            id={id}
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={rows}
            textareaSize="sm"
            className="font-mono resize-y"
            maxLength={maxLength}
            showCharacterCount={showCharacterCount}
          />
        </div>

        {/* Live Preview */}
        {showPreview && (
          <div className="border border-theme-default rounded-md p-3 surface-raised overflow-auto" style={{ maxHeight: `${rows * 1.5}rem` }}>
            {value.trim() ? (
              <MarkdownPreview content={value} />
            ) : (
              <p className="text-xs text-content-tertiary italic">Preview will appear here...</p>
            )}
          </div>
        )}
      </div>

      {/* Character Autocomplete */}
      {showAutocomplete && characters.length > 0 && (
        <CharacterAutocomplete
          characters={characters}
          query={autocompleteQuery}
          position={autocompletePosition}
          onSelect={handleSelectCharacter}
          selectedIndex={selectedIndex}
          onClose={() => setShowAutocomplete(false)}
        />
      )}
    </div>
  );
});

export default CommentEditor;
