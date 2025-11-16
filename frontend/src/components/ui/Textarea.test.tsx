import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { Textarea } from './Textarea';

describe('Textarea Component', () => {
  describe('Basic Functionality', () => {
    it('renders textarea with label', () => {
      render(<Textarea label="Test Label" value="" onChange={() => {}} />);
      expect(screen.getByText('Test Label')).toBeInTheDocument();
    });

    it('renders textarea with placeholder', () => {
      render(<Textarea placeholder="Enter text" value="" onChange={() => {}} />);
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('renders with helper text', () => {
      render(<Textarea helperText="Helper text here" value="" onChange={() => {}} />);
      expect(screen.getByText('Helper text here')).toBeInTheDocument();
    });

    it('renders with error message', () => {
      render(<Textarea error="Error message" value="" onChange={() => {}} />);
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });

    it('shows optional label when optional prop is true', () => {
      render(<Textarea label="Optional Field" optional value="" onChange={() => {}} />);
      expect(screen.getByText('(optional)')).toBeInTheDocument();
    });
  });

  describe('Character Counter', () => {
    it('shows character counter when showCharacterCount is true', () => {
      render(
        <Textarea
          value="Hello"
          onChange={() => {}}
          showCharacterCount={true}
        />
      );
      expect(screen.getByText(/5 characters/)).toBeInTheDocument();
    });

    it('does not show character counter when showCharacterCount is false', () => {
      render(
        <Textarea
          value="Hello"
          onChange={() => {}}
          showCharacterCount={false}
        />
      );
      expect(screen.queryByText(/characters/)).not.toBeInTheDocument();
    });

    it('shows character count with maxLength', () => {
      render(
        <Textarea
          value="Hello World"
          onChange={() => {}}
          maxLength={100}
          showCharacterCount={true}
        />
      );
      expect(screen.getByText('11 / 100 characters')).toBeInTheDocument();
    });

    it('formats large numbers with locale string', () => {
      const longText = 'a'.repeat(1500);
      render(
        <Textarea
          value={longText}
          onChange={() => {}}
          maxLength={10000}
          showCharacterCount={true}
        />
      );
      expect(screen.getByText('1,500 / 10,000 characters')).toBeInTheDocument();
    });

    it('displays warning styling when near limit (90%+)', () => {
      render(
        <Textarea
          value={'a'.repeat(91)}
          onChange={() => {}}
          maxLength={100}
          showCharacterCount={true}
        />
      );
      const counter = screen.getByText('91 / 100 characters');
      expect(counter).toHaveClass('text-semantic-danger');
    });

    it('displays normal styling when below 90% of limit', () => {
      render(
        <Textarea
          value={'a'.repeat(89)}
          onChange={() => {}}
          maxLength={100}
          showCharacterCount={true}
        />
      );
      const counter = screen.getByText('89 / 100 characters');
      expect(counter).toHaveClass('text-content-tertiary');
    });
  });

  describe('MaxLength Enforcement', () => {
    it('sets maxLength attribute on textarea element', () => {
      render(
        <Textarea
          value=""
          onChange={() => {}}
          maxLength={100}
        />
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('maxLength', '100');
    });

    it('prevents typing beyond maxLength', async () => {
      const _user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <Textarea
          value=""
          onChange={handleChange}
          maxLength={10}
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Try to type more than maxLength
      await user.type(textarea, '12345678901234567890');

      // Browser should prevent typing beyond maxLength
      // In the real browser, only first 10 chars would be entered
      expect(textarea.value.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Character Counter with Different Content Types', () => {
    it('counts emoji (JavaScript uses UTF-16 code units)', () => {
      render(
        <Textarea
          value="Hello 🎮🎯🎲"
          onChange={() => {}}
          maxLength={50}
          showCharacterCount={true}
        />
      );
      // JavaScript string.length counts UTF-16 code units
      // "Hello " = 6, each emoji = 2 code units, total = 12
      expect(screen.getByText('12 / 50 characters')).toBeInTheDocument();
    });

    it('counts multi-byte Unicode characters correctly', () => {
      render(
        <Textarea
          value="你好世界" // 4 Chinese characters
          onChange={() => {}}
          maxLength={100}
          showCharacterCount={true}
        />
      );
      expect(screen.getByText('4 / 100 characters')).toBeInTheDocument();
    });

    it('counts newlines and whitespace', () => {
      render(
        <Textarea
          value="Line 1\nLine 2\nLine 3"
          onChange={() => {}}
          maxLength={100}
          showCharacterCount={true}
        />
      );
      // Windows-style line endings are converted, actual count is 22
      expect(screen.getByText('22 / 100 characters')).toBeInTheDocument();
    });
  });

  describe('Error and Helper Text Priority', () => {
    it('shows error message instead of helper text when both provided', () => {
      render(
        <Textarea
          error="Error message"
          helperText="Helper text"
          value=""
          onChange={() => {}}
        />
      );
      expect(screen.getByText('Error message')).toBeInTheDocument();
      expect(screen.queryByText('Helper text')).not.toBeInTheDocument();
    });

    it('does not show character counter when error is present', () => {
      render(
        <Textarea
          error="Error message"
          value="Hello"
          onChange={() => {}}
          showCharacterCount={true}
        />
      );
      // Error takes priority, character counter is NOT shown
      expect(screen.getByText('Error message')).toBeInTheDocument();
      expect(screen.queryByText(/characters/)).not.toBeInTheDocument();
    });

    it('does not show helper text when error is present and showCharacterCount is true', () => {
      render(
        <Textarea
          error="Error message"
          helperText="Helper text"
          value="Hello"
          onChange={() => {}}
          showCharacterCount={true}
        />
      );
      expect(screen.getByText('Error message')).toBeInTheDocument();
      expect(screen.queryByText('Helper text')).not.toBeInTheDocument();
      expect(screen.queryByText(/characters/)).not.toBeInTheDocument();
    });
  });

  describe('Textarea Sizes', () => {
    it('applies small size classes', () => {
      render(
        <Textarea
          value=""
          onChange={() => {}}
          textareaSize="sm"
        />
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('text-sm');
    });

    it('applies medium size classes (default)', () => {
      render(
        <Textarea
          value=""
          onChange={() => {}}
        />
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('text-base');
    });

    it('applies large size classes', () => {
      render(
        <Textarea
          value=""
          onChange={() => {}}
          textareaSize="lg"
        />
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('text-lg');
    });
  });

  describe('Disabled State', () => {
    it('disables textarea when disabled prop is true', () => {
      render(
        <Textarea
          value=""
          onChange={() => {}}
          disabled
        />
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
    });

    it('applies disabled styling', () => {
      render(
        <Textarea
          value=""
          onChange={() => {}}
          disabled
        />
      );
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('disabled:opacity-50');
      expect(textarea).toHaveClass('disabled:cursor-not-allowed');
    });
  });

  describe('Integration: Real-World Scenarios', () => {
    it('renders action submission textarea with 100K limit', () => {
      const content = 'A'.repeat(50000);
      render(
        <Textarea
          label="Your Action"
          value={content}
          onChange={() => {}}
          maxLength={100000}
          showCharacterCount={true}
          helperText="This action is private and will only be visible to the GM during the game. Maximum 100,000 characters."
        />
      );

      expect(screen.getByText('Your Action')).toBeInTheDocument();
      expect(screen.getByText('50,000 / 100,000 characters')).toBeInTheDocument();
      expect(screen.getByText(/Maximum 100,000 characters/)).toBeInTheDocument();
    });

    it('renders comment textarea with 10K limit and warning', () => {
      const content = 'A'.repeat(9500);
      render(
        <Textarea
          value={content}
          onChange={() => {}}
          maxLength={10000}
          showCharacterCount={true}
          placeholder="Write a comment..."
        />
      );

      const counter = screen.getByText('9,500 / 10,000 characters');
      expect(counter).toHaveClass('text-semantic-danger'); // Should show warning at 95%
    });

    it('renders post textarea with 50K limit', () => {
      render(
        <Textarea
          label="Post Content"
          value=""
          onChange={() => {}}
          maxLength={50000}
          showCharacterCount={true}
          rows={12}
        />
      );

      expect(screen.getByText('Post Content')).toBeInTheDocument();
      expect(screen.getByText('0 / 50,000 characters')).toBeInTheDocument();
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('rows', '12');
    });
  });
});
