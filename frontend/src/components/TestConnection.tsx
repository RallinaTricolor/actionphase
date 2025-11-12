import { useState } from 'react';
import { simpleApi } from '../lib/simple-api';
import { Button } from './ui';

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
    <div className="p-4 border border-theme-default rounded-lg surface-base">
      <h3 className="text-lg font-semibold text-content-primary mb-4">Test Backend Connection</h3>
      <Button
        variant="primary"
        onClick={testPing}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? 'Testing...' : 'Test Ping'}
      </Button>

      {status !== 'idle' && (
        <div className={`mt-4 p-3 rounded ${
          status === 'success' ? 'bg-semantic-success-subtle text-content-primary' :
          status === 'error' ? 'bg-semantic-danger-subtle text-content-primary' :
          'surface-sunken text-content-primary'
        }`}>
          <strong>Status:</strong> {status}<br />
          <strong>Response:</strong> {response}
        </div>
      )}
    </div>
  );
};
