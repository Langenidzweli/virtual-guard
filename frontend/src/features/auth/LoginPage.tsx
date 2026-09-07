// frontend/src/features/auth/LoginPage.tsx

import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Card, Input, Button } from '@/components/ui';
import { useAuth } from './useAuth';
import { ROUTES } from '@/app/routes';
import logo from '@/assets/logo.png';

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    const redirectTo = (location.state as { from?: Location })?.from?.pathname ?? ROUTES.liveMonitoring;
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate(ROUTES.liveMonitoring, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0 p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="flex flex-col items-center gap-2 pb-6 text-center">
          <img src={logo} alt="" className="h-12 w-12 rounded-lg" />
          <div>
            <p className="text-base font-bold tracking-wide text-text-primary">VIRTUAL GUARD</p>
            <p className="text-xs text-text-muted">Security Operations Center</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="email"
            label="Email"
            type="email"
            autoComplete="username"
            placeholder="you@virtualguard.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="text-xs text-status-alert">{error}</p>}

          <Button type="submit" variant="primary" className="mt-1 w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-6 rounded-lg border border-line bg-surface-2 px-3 py-3 text-xs text-text-muted">
          <p className="font-medium text-text-secondary">Local bootstrap accounts</p>
          <p className="mt-1">admin@virtualguard.com — Admin</p>
          <p>guard@virtualguard.com — Security Guard</p>
        </div>
      </Card>
    </div>
  );
}
