import React, { type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUploadCharacterAvatar, useDeleteCharacterAvatar } from './useCharacterAvatar';
import { apiClient } from '../lib/api';

// Mock the API client
vi.mock('../lib/api', () => ({
  apiClient: {
    characters: {
      uploadCharacterAvatar: vi.fn(),
      deleteCharacterAvatar: vi.fn(),
    },
  },
}));

// Create a wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useUploadCharacterAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads avatar successfully', async () => {
    const mockResponse = { data: { avatar_url: 'http://example.com/avatar.jpg' } };
    vi.mocked(apiClient.characters.uploadCharacterAvatar).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useUploadCharacterAvatar(), {
      wrapper: createWrapper(),
    });

    const file = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' });

    result.current.mutate({ characterId: 1, file });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.avatar_url).toBe('http://example.com/avatar.jpg');
    expect(apiClient.characters.uploadCharacterAvatar).toHaveBeenCalledWith(1, file);
  });

  it('handles upload error', async () => {
    const mockError = new Error('Upload failed');
    vi.mocked(apiClient.characters.uploadCharacterAvatar).mockRejectedValue(mockError);

    const { result } = renderHook(() => useUploadCharacterAvatar(), {
      wrapper: createWrapper(),
    });

    const file = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' });

    result.current.mutate({ characterId: 1, file });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(mockError);
  });

  it('invalidates character queries on success', async () => {
    const mockResponse = { data: { avatar_url: 'http://example.com/avatar.jpg' } };
    vi.mocked(apiClient.characters.uploadCharacterAvatar).mockResolvedValue(mockResponse);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUploadCharacterAvatar(), { wrapper });

    const file = new File(['test'], 'avatar.jpg', { type: 'image/jpeg' });

    result.current.mutate({ characterId: 123, file });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Should invalidate both specific character and general character queries
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['character', 123] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['characters'] });
  });
});

describe('useDeleteCharacterAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes avatar successfully', async () => {
    vi.mocked(apiClient.characters.deleteCharacterAvatar).mockResolvedValue({ data: undefined });

    const { result } = renderHook(() => useDeleteCharacterAvatar(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.characters.deleteCharacterAvatar).toHaveBeenCalledWith(1);
  });

  it('handles delete error', async () => {
    const mockError = new Error('Delete failed');
    vi.mocked(apiClient.characters.deleteCharacterAvatar).mockRejectedValue(mockError);

    const { result } = renderHook(() => useDeleteCharacterAvatar(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(mockError);
  });

  it('invalidates character queries on success', async () => {
    vi.mocked(apiClient.characters.deleteCharacterAvatar).mockResolvedValue({ data: undefined });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useDeleteCharacterAvatar(), { wrapper });

    result.current.mutate(456);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Should invalidate both specific character and general character queries
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['character', 456] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['characters'] });
  });
});
