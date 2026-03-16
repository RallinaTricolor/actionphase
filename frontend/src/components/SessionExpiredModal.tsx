import { Modal } from './ui/Modal';
import { LoginForm } from './LoginForm';

interface SessionExpiredModalProps {
  isOpen: boolean;
  onSuccess: () => void;
}

/**
 * Shown when the user's session expires mid-session (token refresh failure).
 * Allows re-authentication without leaving the current page, preserving any
 * in-progress form content.
 *
 * Not dismissible — the user must log in to continue.
 */
export function SessionExpiredModal({ isOpen, onSuccess }: SessionExpiredModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}} // Not dismissible
      title="Session Expired"
      size="sm"
      showCloseButton={false}
    >
      <p className="text-content-secondary text-sm mb-4">
        Your session has expired. Please log in again to continue — your work on this page has been preserved.
      </p>
      <LoginForm onSuccess={onSuccess} hideForgotPassword />
    </Modal>
  );
}
