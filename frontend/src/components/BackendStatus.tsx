import { usePing } from '../hooks/useAuth';

export const BackendStatus = () => {
  const { isLoading, error } = usePing();

  return (
    <div className="mb-4 p-4 border border-theme-default rounded-lg surface-base">
      <div className="flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${
          isLoading ? 'bg-semantic-warning' :
          error ? 'bg-semantic-danger' : 'bg-semantic-success'
        }`}></div>
        <span className="font-medium text-content-primary">
          Backend Status: {
            isLoading ? 'Checking...' :
            error ? 'Offline' : 'Online'
          }
        </span>
      </div>
      {error && (
        <p className="text-sm text-semantic-danger mt-2">
          Make sure the Go backend is running on port 3000
        </p>
      )}
    </div>
  );
};
