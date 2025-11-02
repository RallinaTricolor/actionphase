import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { Card, CardHeader, CardBody, Input, Button, Alert } from './ui';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

export function ChangeUsernameForm() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const changeUsernameMutation = useMutation({
    mutationFn: async (data: { new_username: string; current_password: string }) => {
      await apiClient.auth.changeUsername(data);
    },
    onSuccess: () => {
      showToast('Username changed successfully. Please log in again with your new username.', 'success');
      setNewUsername('');
      setCurrentPassword('');
      setError(null);
      // Optionally redirect to login or refresh
      window.location.reload();
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || 'Failed to change username';
      setError(message);
      showToast(message, 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newUsername.trim()) {
      setError('New username is required');
      return;
    }

    if (!currentPassword) {
      setError('Current password is required');
      return;
    }

    changeUsernameMutation.mutate({
      new_username: newUsername.trim(),
      current_password: currentPassword,
    });
  };

  return (
    <Card variant="default" padding="md">
      <CardHeader>
        <h3 className="text-lg font-semibold text-text-heading">Change Username</h3>
        <p className="text-sm text-text-secondary mt-1">
          Current username: <span className="font-medium">{user?.username}</span>
        </p>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="danger" dismissible onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Input
            id="new-username"
            label="New Username"
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="Enter new username"
            disabled={changeUsernameMutation.isPending}
          />

          <Input
            id="current-password"
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Confirm with your password"
            disabled={changeUsernameMutation.isPending}
          />

          <Button
            type="submit"
            variant="primary"
            loading={changeUsernameMutation.isPending}
          >
            Change Username
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
