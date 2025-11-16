import React, { useState, useRef } from 'react';
import { useUploadCharacterAvatar, useDeleteCharacterAvatar } from '../hooks/useCharacterAvatar';
import CharacterAvatar from './CharacterAvatar';
import { Button, Alert } from './ui';
import { Modal } from './Modal';

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
    // eslint-disable-next-line no-alert
    if (!confirm('Are you sure you want to delete this avatar?')) {
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

  const isUploading = uploadMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const hasError = uploadMutation.isError || deleteMutation.isError;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Upload Avatar for ${characterName}`}>
      <div>
          {/* Current Avatar (if exists) */}
          {currentAvatarUrl && (
            <div className="mb-4">
              <p className="text-sm text-content-secondary mb-2">Current Avatar:</p>
              <div className="flex items-center gap-3">
                <CharacterAvatar
                  avatarUrl={currentAvatarUrl}
                  characterName={characterName}
                  size="lg"
                />
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting || isUploading}
                >
                  {isDeleting ? 'Removing...' : 'Remove Avatar'}
                </Button>
              </div>
            </div>
          )}

          {/* File Input */}
          <div className="mb-4">
            <label
              htmlFor="avatar-file-input"
              className="block text-sm font-medium text-content-primary mb-2"
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
              className="block w-full text-sm text-content-tertiary
                file:mr-4 file:py-2 file:px-4
                file:rounded file:border-0
                file:text-sm file:font-semibold
                file:bg-interactive-primary-subtle file:text-interactive-primary
                hover:file:bg-interactive-primary-subtle
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-content-tertiary">
              JPG, PNG, or WebP. Max 5MB.
            </p>
          </div>

          {/* Preview */}
          {previewUrl && (
            <div className="mb-4">
              <p className="text-sm font-medium text-content-primary mb-2">Preview:</p>
              <div className="flex justify-center">
                <img
                  src={previewUrl}
                  alt="Avatar preview"
                  className="w-32 h-32 rounded-full object-cover border-2 border-theme-default"
                />
              </div>
            </div>
          )}

          {/* Validation Error */}
          {validationError && (
            <Alert variant="danger" className="mb-4">
              {validationError}
            </Alert>
          )}

          {/* Upload/Delete Error */}
          {hasError && (
            <Alert variant="danger" className="mb-4">
              {uploadMutation.error?.message || deleteMutation.error?.message || 'An error occurred'}
            </Alert>
          )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-theme-default">
        <Button
          variant="ghost"
          onClick={handleClose}
          disabled={isUploading || isDeleting}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleUpload}
          disabled={!selectedFile || isUploading || isDeleting || !!validationError}
        >
          {isUploading ? 'Uploading...' : 'Upload'}
        </Button>
      </div>
    </Modal>
  );
};

export default AvatarUploadModal;
