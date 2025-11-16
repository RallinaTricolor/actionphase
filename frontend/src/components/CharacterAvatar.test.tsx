import { render, screen, fireEvent, waitFor as _waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CharacterAvatar from './CharacterAvatar';

describe('CharacterAvatar', () => {
  it('displays avatar image when avatarUrl provided', () => {
    render(
      <CharacterAvatar
        avatarUrl="http://example.com/avatar.jpg"
        characterName="Test Character"
      />
    );

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'http://example.com/avatar.jpg');
    expect(img).toHaveAttribute('alt', 'Test Character');
  });

  it('displays fallback initials when no avatarUrl', () => {
    render(
      <CharacterAvatar
        avatarUrl={null}
        characterName="Test Character"
      />
    );

    expect(screen.getByText('TC')).toBeInTheDocument();
  });

  it('displays fallback initials when avatarUrl is undefined', () => {
    render(
      <CharacterAvatar
        characterName="John Doe"
      />
    );

    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('displays fallback on image load error', async () => {
    render(
      <CharacterAvatar
        avatarUrl="http://example.com/broken.jpg"
        characterName="Test Character"
      />
    );

    const img = screen.getByRole('img');
    fireEvent.error(img);

    await waitFor(() => {
      expect(screen.getByText('TC')).toBeInTheDocument();
    });
  });

  it('extracts initials correctly from single word name', () => {
    render(
      <CharacterAvatar
        avatarUrl={null}
        characterName="Batman"
      />
    );

    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('extracts initials correctly from multi-word name', () => {
    render(
      <CharacterAvatar
        avatarUrl={null}
        characterName="The Dark Knight"
      />
    );

    // First and last word: "The" and "Knight"
    expect(screen.getByText('TK')).toBeInTheDocument();
  });

  it('handles empty characterName gracefully', () => {
    render(
      <CharacterAvatar
        avatarUrl={null}
        characterName=""
      />
    );

    expect(screen.getByText('?')).toBeInTheDocument();
  });

  describe('size variants', () => {
    it('applies xs size class', () => {
      const { container: _container } = render(
        <CharacterAvatar
          avatarUrl={null}
          characterName="Test"
          size="xs"
        />
      );

      const avatar = container.firstChild;
      expect(avatar).toHaveClass('w-6', 'h-6');
    });

    it('applies sm size class', () => {
      const { container: _container } = render(
        <CharacterAvatar
          avatarUrl={null}
          characterName="Test"
          size="sm"
        />
      );

      const avatar = container.firstChild;
      expect(avatar).toHaveClass('w-8', 'h-8');
    });

    it('applies md size class by default', () => {
      const { container: _container } = render(
        <CharacterAvatar
          avatarUrl={null}
          characterName="Test"
        />
      );

      const avatar = container.firstChild;
      expect(avatar).toHaveClass('w-10', 'h-10');
    });

    it('applies lg size class', () => {
      const { container: _container } = render(
        <CharacterAvatar
          avatarUrl={null}
          characterName="Test"
          size="lg"
        />
      );

      const avatar = container.firstChild;
      expect(avatar).toHaveClass('w-12', 'h-12');
    });

    it('applies xl size class', () => {
      const { container: _container } = render(
        <CharacterAvatar
          avatarUrl={null}
          characterName="Test"
          size="xl"
        />
      );

      const avatar = container.firstChild;
      expect(avatar).toHaveClass('w-16', 'h-16');
    });
  });

  it('applies custom className', () => {
    const { container: _container } = render(
      <CharacterAvatar
        avatarUrl={null}
        characterName="Test"
        className="custom-class"
      />
    );

    const avatar = container.firstChild;
    expect(avatar).toHaveClass('custom-class');
  });

  it('shows initials with consistent color for same character', () => {
    const { container: container1 } = render(
      <CharacterAvatar
        avatarUrl={null}
        characterName="Test Character"
      />
    );

    const { container: container2 } = render(
      <CharacterAvatar
        avatarUrl={null}
        characterName="Test Character"
      />
    );

    // Both should have the same background color classes
    const avatar1 = container1.firstChild;
    const avatar2 = container2.firstChild;

    expect(avatar1?.className).toBe(avatar2?.className);
  });
});
