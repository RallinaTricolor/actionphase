import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getSavedDrafts,
  restoreDrafts,
  clearSavedDrafts,
  getDraftMessage,
  type DraftData,
} from '../draftRestoration';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock logger
vi.mock('@/services/LoggingService', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('draftRestoration', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // Clean up any existing DOM elements
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('getSavedDrafts', () => {
    it('should return null when no drafts exist', () => {
      const result = getSavedDrafts();
      expect(result).toBeNull();
    });

    it('should return draft data when valid drafts exist', () => {
      const draftData: DraftData = {
        timestamp: Date.now(),
        path: '/games/123',
        drafts: {
          'message-input': 'Test message',
          'comment-textarea': 'Test comment',
        },
      };

      localStorageMock.setItem('session_expired_drafts', JSON.stringify(draftData));

      const result = getSavedDrafts();
      expect(result).toEqual(draftData);
    });

    it('should discard drafts older than 24 hours', () => {
      const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      const draftData: DraftData = {
        timestamp: oldTimestamp,
        path: '/games/123',
        drafts: {
          'message-input': 'Old message',
        },
      };

      localStorageMock.setItem('session_expired_drafts', JSON.stringify(draftData));

      const result = getSavedDrafts();
      expect(result).toBeNull();
      expect(localStorageMock.getItem('session_expired_drafts')).toBeNull();
    });

    it('should handle invalid JSON gracefully', () => {
      localStorageMock.setItem('session_expired_drafts', 'invalid json');

      const result = getSavedDrafts();
      expect(result).toBeNull();
    });
  });

  describe('restoreDrafts', () => {
    it('should return 0 when no drafts exist', () => {
      const count = restoreDrafts();
      expect(count).toBe(0);
    });

    it('should restore drafts to textarea fields by name', () => {
      // Create a textarea with name attribute
      const textarea = document.createElement('textarea');
      textarea.name = 'message-input';
      document.body.appendChild(textarea);

      // Save draft data
      const draftData: DraftData = {
        timestamp: Date.now(),
        path: '/games/123',
        drafts: {
          'message-input': 'Saved message content',
        },
      };
      localStorageMock.setItem('session_expired_drafts', JSON.stringify(draftData));

      // Restore drafts
      const count = restoreDrafts();

      expect(count).toBe(1);
      expect(textarea.value).toBe('Saved message content');
      // Verify drafts were cleared after restoration
      expect(localStorageMock.getItem('session_expired_drafts')).toBeNull();
    });

    it('should restore drafts to input fields by id', () => {
      // Create an input with id attribute
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'title-input';
      document.body.appendChild(input);

      // Save draft data
      const draftData: DraftData = {
        timestamp: Date.now(),
        path: '/games/123',
        drafts: {
          'title-input': 'Saved title',
        },
      };
      localStorageMock.setItem('session_expired_drafts', JSON.stringify(draftData));

      // Restore drafts
      const count = restoreDrafts();

      expect(count).toBe(1);
      expect(input.value).toBe('Saved title');
    });

    it('should not overwrite existing field values', () => {
      // Create a textarea with existing content
      const textarea = document.createElement('textarea');
      textarea.name = 'message-input';
      textarea.value = 'Existing content';
      document.body.appendChild(textarea);

      // Save draft data with different content
      const draftData: DraftData = {
        timestamp: Date.now(),
        path: '/games/123',
        drafts: {
          'message-input': 'Saved message',
        },
      };
      localStorageMock.setItem('session_expired_drafts', JSON.stringify(draftData));

      // Restore drafts
      const count = restoreDrafts();

      // Should not restore because field already has content
      expect(count).toBe(0);
      expect(textarea.value).toBe('Existing content');
    });

    it('should restore multiple fields', () => {
      // Create multiple fields
      const textarea1 = document.createElement('textarea');
      textarea1.name = 'message-input';
      document.body.appendChild(textarea1);

      const textarea2 = document.createElement('textarea');
      textarea2.name = 'comment-textarea';
      document.body.appendChild(textarea2);

      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'title-input';
      document.body.appendChild(input);

      // Save draft data
      const draftData: DraftData = {
        timestamp: Date.now(),
        path: '/games/123',
        drafts: {
          'message-input': 'Message content',
          'comment-textarea': 'Comment content',
          'title-input': 'Title content',
        },
      };
      localStorageMock.setItem('session_expired_drafts', JSON.stringify(draftData));

      // Restore drafts
      const count = restoreDrafts();

      expect(count).toBe(3);
      expect(textarea1.value).toBe('Message content');
      expect(textarea2.value).toBe('Comment content');
      expect(input.value).toBe('Title content');
    });

    it('should dispatch input events for React to detect changes', () => {
      const textarea = document.createElement('textarea');
      textarea.name = 'message-input';
      document.body.appendChild(textarea);

      // Spy on dispatchEvent
      const dispatchSpy = vi.spyOn(textarea, 'dispatchEvent');

      const draftData: DraftData = {
        timestamp: Date.now(),
        path: '/games/123',
        drafts: {
          'message-input': 'Test content',
        },
      };
      localStorageMock.setItem('session_expired_drafts', JSON.stringify(draftData));

      restoreDrafts();

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'input',
          bubbles: true,
        })
      );
    });
  });

  describe('clearSavedDrafts', () => {
    it('should remove drafts from localStorage', () => {
      const draftData: DraftData = {
        timestamp: Date.now(),
        path: '/games/123',
        drafts: {
          'message-input': 'Test message',
        },
      };
      localStorageMock.setItem('session_expired_drafts', JSON.stringify(draftData));

      clearSavedDrafts();

      expect(localStorageMock.getItem('session_expired_drafts')).toBeNull();
    });
  });

  describe('getDraftMessage', () => {
    it('should generate message for single draft', () => {
      const draftData: DraftData = {
        timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes ago
        path: '/games/123',
        drafts: {
          'message-input': 'Test message',
        },
      };

      const message = getDraftMessage(draftData);
      expect(message).toContain('1 draft');
      expect(message).toContain('5 minutes ago');
    });

    it('should generate message for multiple drafts', () => {
      const draftData: DraftData = {
        timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        path: '/games/123',
        drafts: {
          'message-input': 'Message 1',
          'comment-textarea': 'Message 2',
          'title-input': 'Message 3',
        },
      };

      const message = getDraftMessage(draftData);
      expect(message).toContain('3 drafts');
      expect(message).toContain('2 hours ago');
    });

    it('should handle "just now" timestamp', () => {
      const draftData: DraftData = {
        timestamp: Date.now(),
        path: '/games/123',
        drafts: {
          'message-input': 'Test message',
        },
      };

      const message = getDraftMessage(draftData);
      expect(message).toContain('just now');
    });
  });
});
