import { Eye, EyeOff } from 'lucide-react'

import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Card, Input, Button } from '@/components/ui';
import { useAuth } from './useAuth';
import { ROUTES } from '@/app/routes';
import logo from '@/assets/logo.png';

export function LoginPage() {
  const { login, isAuthenticated, user, isInitializing } = useAuth();
  const location = useLocation();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isInitializing) return <p role="status" className="p-8 text-center">Loading account...</p>;
  if (isAuthenticated) {
    if (user?.mustChangePassword) return <Navigate to={ROUTES.changePassword} replace />;
    const requested = (location.state as { from?: Location })?.from?.pathname;
    const redirectTo = requested && requested !== ROUTES.changePassword && requested !== ROUTES.login ? requested : ROUTES.liveMonitoring;
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
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
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="button" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="flex items-center gap-2 self-start text-xs text-text-secondary">{showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}{showPassword ? 'Hide password' : 'Show password'}</button>
          {error && <p role="alert" className="text-xs text-status-alert">{error}</p>}

          <Button type="submit" variant="primary" className="mt-1 w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

      </Card>
    </div>
  );
}
