import { useState, useRef, useEffect } from 'react';
import { MarkdownPreview } from './MarkdownPreview';
import { CharacterAutocomplete } from './CharacterAutocomplete';
import type { Character } from '../types/characters';

interface CommentEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  showPreviewByDefault?: boolean;
  characters?: Character[]; // Characters available for mention autocomplete
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
export function CommentEditor({
  value,
  onChange,
  placeholder = 'Write your comment...',
  disabled = false,
  rows = 4,
  showPreviewByDefault = false,
  characters = [],
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
    // Create a mirror div to measure text position
    const computed = window.getComputedStyle(element);
    const div = document.createElement('div');

    // Copy styles
    const styles = [
      'fontSize', 'fontFamily', 'fontWeight', 'wordWrap',
      'whiteSpace', 'borderWidth', 'paddingLeft', 'paddingRight',
    ];
    styles.forEach(style => {
      div.style[style as any] = computed[style as any];
    });

    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.width = element.offsetWidth + 'px';
    div.textContent = element.value.substring(0, position);

    const span = document.createElement('span');
    span.textContent = element.value.substring(position) || '.';
    div.appendChild(span);

    document.body.appendChild(div);

    const rect = element.getBoundingClientRect();
    const spanRect = span.getBoundingClientRect();

    document.body.removeChild(div);

    return {
      top: rect.top + (spanRect.top - div.getBoundingClientRect().top) + element.scrollTop + 20,
      left: rect.left + (spanRect.left - div.getBoundingClientRect().left),
    };
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
    const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
    if (textAfterAt.includes(' ') || textAfterAt.includes('\n')) {
      setShowAutocomplete(false);
      return;
    }

    // Show autocomplete
    setShowAutocomplete(true);
    setAutocompleteQuery(textAfterAt);
    setMentionStartIndex(lastAtIndex);
    setSelectedIndex(0);

    // Calculate position
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
      <div className="flex items-center justify-between mb-2 text-xs text-gray-600">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={`font-medium transition-colors ${
              showPreview
                ? 'text-blue-600 hover:text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            disabled={disabled}
          >
            {showPreview ? '👁️ Hide Preview' : '👁️ Show Preview'}
          </button>

          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="text-gray-500 hover:text-gray-700 font-medium transition-colors"
            disabled={disabled}
          >
            ❓ Markdown Help
          </button>
        </div>

        <span className="text-gray-400">
          {value.length} characters
        </span>
      </div>

      {/* Markdown Help Panel */}
      {showHelp && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
          <div className="font-semibold text-blue-900 mb-2">Markdown Quick Reference</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-700">
            <div>
              <code className="bg-white px-1 rounded">**bold**</code> → <strong>bold</strong>
            </div>
            <div>
              <code className="bg-white px-1 rounded">*italic*</code> → <em>italic</em>
            </div>
            <div>
              <code className="bg-white px-1 rounded">[link](url)</code> → link
            </div>
            <div>
              <code className="bg-white px-1 rounded">`code`</code> → <code className="bg-white px-1">code</code>
            </div>
            <div>
              <code className="bg-white px-1 rounded"># Heading</code> → Heading
            </div>
            <div>
              <code className="bg-white px-1 rounded">- list item</code> → • list item
            </div>
            <div>
              <code className="bg-white px-1 rounded">&gt; quote</code> → blockquote
            </div>
            <div>
              <code className="bg-white px-1 rounded">@CharacterName</code> → mention
            </div>
          </div>
        </div>
      )}

      {/* Editor and Preview */}
      <div className={`grid ${showPreview ? 'grid-cols-2 gap-3' : 'grid-cols-1'}`}>
        {/* Textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={rows}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y font-mono"
          />
        </div>

        {/* Live Preview */}
        {showPreview && (
          <div className="border border-gray-200 rounded-md p-3 bg-gray-50 overflow-auto" style={{ maxHeight: `${rows * 1.5}rem` }}>
            {value.trim() ? (
              <MarkdownPreview content={value} />
            ) : (
              <p className="text-xs text-gray-400 italic">Preview will appear here...</p>
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
}

export default CommentEditor;
