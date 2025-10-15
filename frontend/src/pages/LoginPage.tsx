import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LoginForm } from '../components/LoginForm';
import { RegisterForm } from '../components/RegisterForm';
import { BackendStatus } from '../components/BackendStatus';
import { TestConnection } from '../components/TestConnection';

export const LoginPage = () => {
  const [showRegister, setShowRegister] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSuccess = () => {
    // Redirect to the page they were trying to access, or dashboard if none
    const from = (location.state as any)?.from?.pathname || '/dashboard';
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-extrabold text-gray-900 mb-8">
          ActionPhase
        </h1>

        <BackendStatus />
        <TestConnection />

        <div className="mt-6">
          {showRegister ? (
            <RegisterForm onSuccess={handleSuccess} />
          ) : (
            <LoginForm onSuccess={handleSuccess} />
          )}
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => setShowRegister(!showRegister)}
            className="text-blue-600 hover:text-blue-500 font-medium"
          >
            {showRegister
              ? "Already have an account? Sign in"
              : "Don't have an account? Sign up"
            }
          </button>
        </div>
      </div>
    </div>
  );
};
