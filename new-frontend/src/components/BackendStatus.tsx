import { usePing } from '../hooks/useAuth';

export const BackendStatus = () => {
  const { isLoading, error } = usePing();

  return (
    <div className="mb-4 p-4 border rounded-lg">
      <div className="flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${
          isLoading ? 'bg-yellow-500' :
          error ? 'bg-red-500' : 'bg-green-500'
        }`}></div>
        <span className="font-medium">
          Backend Status: {
            isLoading ? 'Checking...' :
            error ? 'Offline' : 'Online'
          }
        </span>
      </div>
      {error && (
        <p className="text-sm text-red-600 mt-2">
          Make sure the Go backend is running on port 3000
        </p>
      )}
    </div>
  );
};
