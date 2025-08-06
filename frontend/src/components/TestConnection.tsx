import { useState } from 'react';
import { simpleApi } from '../lib/simple-api';

export const TestConnection = () => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [response, setResponse] = useState<string>('');

  const testPing = async () => {
    setStatus('loading');
    try {
      const result = await simpleApi.ping();
      setResponse(result.data);
      setStatus('success');
    } catch (error) {
      setResponse(error instanceof Error ? error.message : 'Unknown error');
      setStatus('error');
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-white">
      <h3 className="text-lg font-semibold mb-4">Test Backend Connection</h3>
      <button
        onClick={testPing}
        disabled={status === 'loading'}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {status === 'loading' ? 'Testing...' : 'Test Ping'}
      </button>

      {status !== 'idle' && (
        <div className={`mt-4 p-3 rounded ${
          status === 'success' ? 'bg-green-50 text-green-800' :
          status === 'error' ? 'bg-red-50 text-red-800' :
          'bg-gray-50 text-gray-800'
        }`}>
          <strong>Status:</strong> {status}<br />
          <strong>Response:</strong> {response}
        </div>
      )}
    </div>
  );
};
