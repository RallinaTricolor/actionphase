import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { apiClient } from '../lib/api';
import { Textarea, Button, Modal } from './ui';
import { MarkdownPreview } from './MarkdownPreview';
import { getInitials, getAvatarColor } from '../utils/avatar';

export function ProfileSection() {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [bio, setBio] = useState(currentUser?.bio || '');
  const [showBioPreview, setShowBioPreview] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { bio?: string }) => {
      await apiClient.users.updateUserProfile(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      showToast('Bio updated successfully', 'success');
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update bio';
      showToast(message, 'danger');
    },
  });

  // Avatar upload mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      await apiClient.users.uploadUserAvatar(file);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      setAvatarFile(null);
      setAvatarPreview(null);
      showToast('Avatar uploaded successfully', 'success');
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to upload avatar';
      showToast(message, 'danger');
    },
  });

  // Avatar delete mutation
  const deleteAvatarMutation = useMutation({
    mutationFn: async () => {
      await apiClient.users.deleteUserAvatar();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      showToast('Avatar deleted successfully', 'success');
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete avatar';
      showToast(message, 'danger');
    },
  });

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setAvatarError(null);

    if (!file) {
      setAvatarFile(null);
      setAvatarPreview(null);
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setAvatarError('Invalid file type. Only JPG, PNG, and WebP are allowed.');
      setAvatarFile(null);
      setAvatarPreview(null);
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
      setAvatarError(`File too large. Maximum size is 5MB (your file is ${fileSizeMB}MB).`);
      setAvatarFile(null);
      setAvatarPreview(null);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setAvatarFile(file);
  };

  const handleUploadAvatar = () => {
    if (!avatarFile) return;
    uploadAvatarMutation.mutate(avatarFile);
  };

  const handleDeleteAvatar = () => {
    deleteAvatarMutation.mutate();
    setShowDeleteModal(false);
  };

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({
      bio: bio || undefined,
    });
  };

  const displayNameForAvatar = currentUser?.username || 'User';
  const currentAvatar = avatarPreview || currentUser?.avatar_url;
  const hasChanges = bio !== (currentUser?.bio || '');
  const isLoading =
    updateProfileMutation.isPending ||
    uploadAvatarMutation.isPending ||
    deleteAvatarMutation.isPending;

  return (
    <div className="bg-surface-base rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-content-primary">
          Profile
        </h2>
        {currentUser && (
          <Link
            to={`/users/${currentUser.username}`}
            className="text-sm text-interactive-primary hover:text-interactive-primary-hover"
          >
            View Public Profile →
          </Link>
        )}
      </div>

      <div className="space-y-6">
        {/* Avatar Section */}
        <div>
          <h3 className="text-lg font-semibold text-content-primary mb-4">Avatar</h3>

          {/* Current Avatar Display */}
          <div className="flex items-center gap-4 mb-6">
            {currentAvatar ? (
              <img
                src={currentAvatar}
                alt="Profile avatar"
                className="w-24 h-24 rounded-full object-cover ring-4 ring-border-primary"
              />
            ) : (
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center text-white font-semibold text-2xl ring-4 ring-border-primary ${getAvatarColor(
                  displayNameForAvatar
                )}`}
              >
                {getInitials(displayNameForAvatar)}
              </div>
            )}
            {currentUser?.avatar_url && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowDeleteModal(true)}
                disabled={isLoading}
              >
                Delete Avatar
              </Button>
            )}
          </div>

          {/* Upload New Avatar */}
          <div className="space-y-3">
            <div>
              <label
                htmlFor="avatar-upload"
                className="block text-sm font-medium text-content-primary mb-2"
              >
                Upload New Avatar
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarSelect}
                disabled={isLoading}
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

            {avatarError && (
              <p className="text-sm text-semantic-danger">{avatarError}</p>
            )}

            {avatarFile && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleUploadAvatar}
                loading={uploadAvatarMutation.isPending}
                disabled={isLoading}
              >
                Upload
              </Button>
            )}
          </div>
        </div>

        {/* Bio Field */}
        <div className="pt-6 border-t border-theme-default">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-content-primary">
                  Bio
                </label>
                <button
                  type="button"
                  onClick={() => setShowBioPreview(!showBioPreview)}
                  className="text-sm text-interactive-primary hover:text-interactive-primary-hover"
                  disabled={isLoading}
                >
                  {showBioPreview ? 'Edit' : 'Preview'}
                </button>
              </div>

              {showBioPreview ? (
                <div className="min-h-[120px] p-3 rounded-md border border-theme-default bg-surface-base">
                  {bio ? (
                    <MarkdownPreview content={bio} />
                  ) : (
                    <p className="text-content-secondary italic">No bio</p>
                  )}
                </div>
              ) : (
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself... (Markdown supported)"
                  rows={6}
                  disabled={isLoading}
                />
              )}
              <p className="mt-2 text-xs text-content-secondary">
                Markdown formatting supported
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="pt-4">
            <Button
              variant="primary"
              onClick={handleSaveProfile}
              loading={updateProfileMutation.isPending}
              disabled={isLoading}
            >
              Save Bio
            </Button>
          </div>
        )}
      </div>

      {/* Delete Avatar Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Avatar"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAvatar}
              loading={deleteAvatarMutation.isPending}
            >
              Delete
            </Button>
          </>
        }
      >
        <p>Are you sure you want to delete your avatar? This action cannot be undone.</p>
      </Modal>
    </div>
  );
}
