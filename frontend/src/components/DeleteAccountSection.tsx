import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { Card, CardHeader, CardBody, Button, Alert } from './ui';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

export function DeleteAccountSection() {
  const { showToast } = useToast();
  const { logout } = useAuth();
  const [showConfirmation, setShowConfirmation] = useState(false);

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      await apiClient.auth.deleteAccount();
    },
    onSuccess: () => {
      showToast('Account deleted successfully. You have 30 days to restore it.', 'success');
      // Log out the user
      setTimeout(() => {
        logout();
      }, 2000);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || 'Failed to delete account';
      showToast(message, 'error');
      setShowConfirmation(false);
    },
  });

  const handleDeleteClick = () => {
    setShowConfirmation(true);
  };

  const handleConfirmDelete = () => {
    deleteAccountMutation.mutate();
  };

  const handleCancelDelete = () => {
    setShowConfirmation(false);
  };

  return (
    <Card variant="default" padding="md">
      <CardHeader>
        <h3 className="text-lg font-semibold text-text-heading">Delete Account</h3>
        <p className="text-sm text-text-secondary mt-1">
          Permanently delete your account and all associated data
        </p>
      </CardHeader>
      <CardBody>
        <div className="space-y-4">
          <Alert variant="warning">
            <strong>Warning:</strong> This action will delete your account. You will have 30 days to restore it before it is permanently deleted.
          </Alert>

          {!showConfirmation ? (
            <Button
              variant="danger"
              onClick={handleDeleteClick}
            >
              Delete My Account
            </Button>
          ) : (
            <div className="space-y-4">
              <Alert variant="danger">
                <strong>Are you sure?</strong> This will delete your account and log you out. You can restore your account within 30 days by logging back in.
              </Alert>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  onClick={handleConfirmDelete}
                  loading={deleteAccountMutation.isPending}
                >
                  Yes, Delete My Account
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleCancelDelete}
                  disabled={deleteAccountMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
