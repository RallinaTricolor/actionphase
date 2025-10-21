import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input, Card, Alert } from './ui';
import type { RegisterRequest } from '../types/auth';

interface RegisterFormProps {
  onSuccess?: () => void;
}

export const RegisterForm = ({ onSuccess }: RegisterFormProps) => {
  const [formData, setFormData] = useState<RegisterRequest>({
    username: '',
    email: '',
    password: '',
  });
  const { register, isLoading, error } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(formData);
      onSuccess?.();
    } catch (err) {
      // Error is handled by the hook
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const errorMessage = (error as any)?.response?.data?.message || 'Registration failed. Please try again.';

  return (
    <Card variant="elevated" padding="md" className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-content-primary mb-6">Register</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Username"
          id="username"
          name="username"
          type="text"
          required
          value={formData.username}
          onChange={handleChange}
          placeholder="Choose a username"
        />

        <Input
          label="Email"
          id="email"
          name="email"
          type="email"
          required
          value={formData.email}
          onChange={handleChange}
          placeholder="Enter your email"
        />

        <Input
          label="Password"
          id="password"
          name="password"
          type="password"
          required
          value={formData.password}
          onChange={handleChange}
          placeholder="Choose a password"
        />

        {error && (
          <Alert variant="danger">
            {errorMessage}
          </Alert>
        )}

        <Button
          type="submit"
          variant="primary"
          loading={isLoading}
          className="w-full"
        >
          {isLoading ? 'Creating account...' : 'Register'}
        </Button>
      </form>
    </Card>
  );
};
