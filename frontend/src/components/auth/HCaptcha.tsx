import { useRef } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

interface HCaptchaWrapperProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (error: string) => void;
}

/**
 * HCaptcha wrapper component
 *
 * Usage:
 *   const [captchaToken, setCaptchaToken] = useState('');
 *   <HCaptcha onVerify={setCaptchaToken} />
 */
export function HCaptchaWrapper({ onVerify, onExpire, onError }: HCaptchaWrapperProps) {
  const captchaRef = useRef<HCaptcha>(null);

  // Use test site key from .env.example for now
  // TODO: Move to environment variable when setting up production
  const siteKey = import.meta.env.VITE_HCAPTCHA_SITE_KEY || '10000000-ffff-ffff-ffff-000000000001';

  const handleVerify = (token: string) => {
    onVerify(token);
  };

  const handleExpire = () => {
    onExpire?.();
  };

  const handleError = (error: string) => {
    onError?.(error);
  };

  return (
    <div className="flex justify-center">
      <HCaptcha
        ref={captchaRef}
        sitekey={siteKey}
        onVerify={handleVerify}
        onExpire={handleExpire}
        onError={handleError}
      />
    </div>
  );
}
