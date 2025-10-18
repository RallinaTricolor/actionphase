import React, { useState, useRef } from 'react';
import { useUploadCharacterAvatar, useDeleteCharacterAvatar } from '../hooks/useCharacterAvatar';
import CharacterAvatar from './CharacterAvatar';

interface AvatarUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterId: number;
  characterName: string;
  currentAvatarUrl?: string | null;
  onUploadSuccess?: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Modal for uploading or deleting character avatars
 *
 * Features:
 * - File selection with preview
 * - Client-side validation (type and size)
 * - Upload with progress indication
 * - Delete existing avatar (with confirmation)
 * - Error handling and display
 *
 * @example
 * ```tsx
 * <AvatarUploadModal
 *   isOpen={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 *   characterId={character.id}
 *   characterName={character.name}
 *   currentAvatarUrl={character.avatar_url}
 *   onUploadSuccess={() => {
 *     console.log('Avatar uploaded!');
 *   }}
 * />
 * ```
 */
const AvatarUploadModal: React.FC<AvatarUploadModalProps> = ({
  isOpen,
  onClose,
  characterId,
  characterName,
  currentAvatarUrl,
  onUploadSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadCharacterAvatar();
  const deleteMutation = useDeleteCharacterAvatar();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setValidationError(null);

    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setValidationError('Only JPG, PNG, and WebP images are allowed');
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setValidationError('File size must be less than 5MB');
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    setSelectedFile(file);
  };

  const handleUpload = () => {
    if (!selectedFile) return;

    uploadMutation.mutate(
      { characterId, file: selectedFile },
      {
        onSuccess: () => {
          // Reset form
          setSelectedFile(null);
          setPreviewUrl(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }

          // Call success callback and close modal
          onUploadSuccess?.();
          onClose();
        },
      }
    );
  };

  const handleDelete = () => {
    if (!confirm('Are you sure you want to remove this avatar?')) {
      return;
    }

    deleteMutation.mutate(characterId, {
      onSuccess: () => {
        onUploadSuccess?.();
        onClose();
      },
    });
  };

  const handleClose = () => {
    // Reset state when closing
    setSelectedFile(null);
    setPreviewUrl(null);
    setValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  if (!isOpen) return null;

  const isUploading = uploadMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const hasError = uploadMutation.isError || deleteMutation.isError;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            Upload Avatar for {characterName}
          </h2>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {/* Current Avatar (if exists) */}
          {currentAvatarUrl && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Current Avatar:</p>
              <div className="flex items-center gap-3">
                <CharacterAvatar
                  avatarUrl={currentAvatarUrl}
                  characterName={characterName}
                  size="lg"
                />
                <button
                  onClick={handleDelete}
                  disabled={isDeleting || isUploading}
                  className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? 'Removing...' : 'Remove Avatar'}
                </button>
              </div>
            </div>
          )}

          {/* File Input */}
          <div className="mb-4">
            <label
              htmlFor="avatar-file-input"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Choose File
            </label>
            <input
              id="avatar-file-input"
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={isUploading || isDeleting}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-500">
              JPG, PNG, or WebP. Max 5MB.
            </p>
          </div>

          {/* Preview */}
          {previewUrl && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
              <div className="flex justify-center">
                <img
                  src={previewUrl}
                  alt="Avatar preview"
                  className="w-32 h-32 rounded-full object-cover border-2 border-gray-200"
                />
              </div>
            </div>
          )}

          {/* Validation Error */}
          {validationError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-600">{validationError}</p>
            </div>
          )}

          {/* Upload/Delete Error */}
          {hasError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-600">
                {uploadMutation.error?.message || deleteMutation.error?.message || 'An error occurred'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={isUploading || isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading || isDeleting || !!validationError}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvatarUploadModal;
