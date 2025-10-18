import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

interface MentionedCharacter {
  id: number;
  name: string;
}

interface MarkdownPreviewProps {
  content: string;
  mentionedCharacters?: MentionedCharacter[];
  className?: string;
}

/**
 * MarkdownPreview Component
 *
 * Renders markdown content with:
 * - GitHub-flavored markdown formatting
 * - Syntax highlighting for code blocks
 * - Character mention support (@CharacterName)
 * - XSS protection via react-markdown's built-in sanitization
 * - Secure link handling (opens in new tab)
 *
 * Supported Markdown:
 * - Bold: **text** or __text__
 * - Italic: *text* or _text_
 * - Links: [text](url)
 * - Headers: # H1, ## H2, ### H3
 * - Lists: Unordered (- item) and ordered (1. item)
 * - Code: Inline `code` and fenced blocks ```
 * - Blockquotes: > quote
 * - Horizontal Rule: ---
 */
export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  mentionedCharacters = [],
  className = '',
}) => {
  // Create a custom sanitize schema that allows <mark> elements with data-mention-id
  const sanitizeSchema = React.useMemo(() => {
    return {
      ...defaultSchema,
      tagNames: [...(defaultSchema.tagNames || []), 'mark'],
      attributes: {
        ...defaultSchema.attributes,
        mark: ['dataMentionId', 'data-mention-id', 'className'],
      },
    };
  }, []);

  // Replace @CharacterName mentions with highlighted spans
  // BUT skip mentions inside code blocks (inline or fenced)
  const processedContent = React.useMemo(() => {
    if (!mentionedCharacters.length) return content;

    // Split content into code and non-code segments
    // This regex matches:
    // - Fenced code blocks (```lang\ncode\n``` or ```code```)
    // - Inline code (`code`)
    const codeBlockRegex = /(```[\s\S]*?```|`[^`\n]+?`)/g;

    const segments: Array<{ text: string; isCode: boolean }> = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add non-code text before this code block
      if (match.index > lastIndex) {
        segments.push({ text: content.substring(lastIndex, match.index), isCode: false });
      }
      // Add code block
      segments.push({ text: match[0], isCode: true });
      lastIndex = match.index + match[0].length;
    }

    // Add remaining non-code text
    if (lastIndex < content.length) {
      segments.push({ text: content.substring(lastIndex), isCode: false });
    }

    // If no segments were created (no code blocks), treat entire content as non-code
    if (segments.length === 0) {
      segments.push({ text: content, isCode: false });
    }

    // Sort by name length (descending) to handle longer names first
    // This prevents "Bob Smith" from being partially matched as just "Bob"
    const sortedCharacters = [...mentionedCharacters].sort(
      (a, b) => b.name.length - a.name.length
    );

    // Process each segment
    const processedSegments = segments.map((segment) => {
      if (segment.isCode) {
        // Don't process mentions inside code blocks
        return segment.text;
      }

      let processedText = segment.text;
      sortedCharacters.forEach(({ id, name }) => {
        // Simple regex without lookbehind/lookahead since we already filtered out code blocks
        const mentionRegex = new RegExp(`@(${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');

        // Replace with mark element
        processedText = processedText.replace(
          mentionRegex,
          `<mark data-mention-id="${id}">@$1</mark>`
        );
      });

      return processedText;
    });

    return processedSegments.join('');
  }, [content, mentionedCharacters]);

  return (
    <div className={`markdown-preview prose prose-slate max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw as any, [rehypeSanitize as any, sanitizeSchema]]}
        components={{
          // Custom code block renderer with syntax highlighting
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';

            return !inline && language ? (
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={language}
                PreTag="div"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },

          // Secure link handling - open in new tab with security attributes
          a({ node, children, href, ...props }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
                {...props}
              >
                {children}
              </a>
            );
          },

          // Custom mark element for character mentions
          mark({ node, children, ...props }) {
            const mentionId = (props as any)['data-mention-id'];
            return (
              <mark
                className="bg-blue-100 text-blue-800 px-1 rounded font-medium cursor-pointer hover:bg-blue-200"
                data-mention-id={mentionId}
                {...props}
              >
                {children}
              </mark>
            );
          },

          // Style headers
          h1: ({ node, children, ...props }) => (
            <h1 className="text-2xl font-bold mt-4 mb-2" {...props}>
              {children}
            </h1>
          ),
          h2: ({ node, children, ...props }) => (
            <h2 className="text-xl font-bold mt-3 mb-2" {...props}>
              {children}
            </h2>
          ),
          h3: ({ node, children, ...props }) => (
            <h3 className="text-lg font-bold mt-2 mb-1" {...props}>
              {children}
            </h3>
          ),

          // Style blockquotes
          blockquote: ({ node, children, ...props }) => (
            <blockquote
              className="border-l-4 border-gray-300 pl-4 py-2 my-2 italic text-gray-700"
              {...props}
            >
              {children}
            </blockquote>
          ),

          // Style horizontal rules
          hr: ({ node, ...props }) => (
            <hr className="my-4 border-t-2 border-gray-300" {...props} />
          ),

          // Style lists
          ul: ({ node, children, ...props }) => (
            <ul className="list-disc list-inside my-2" {...props}>
              {children}
            </ul>
          ),
          ol: ({ node, children, ...props }) => (
            <ol className="list-decimal list-inside my-2" {...props}>
              {children}
            </ol>
          ),
          li: ({ node, children, ...props }) => (
            <li className="ml-4" {...props}>
              {children}
            </li>
          ),

          // Style paragraphs
          p: ({ node, children, ...props }) => (
            <p className="my-2" {...props}>
              {children}
            </p>
          ),
        }}
        // react-markdown automatically sanitizes HTML to prevent XSS
        // It only allows safe markdown and doesn't execute scripts
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownPreview;
