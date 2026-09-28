import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Input, Button } from '@/components/ui'
import { useAuth } from './useAuth'
export function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth()
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null)
    if (password !== confirm) { setError('New passwords do not match.'); return }
    if (new TextEncoder().encode(password).length > 72) { setError('Use no more than 72 UTF-8 bytes.'); return }
    setSaving(true)
    try { await changePassword(current, password, confirm); navigate('/', { replace: true }) }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to change password') }
    finally { setSaving(false) }
  }
  return <main className="flex min-h-dvh items-center justify-center p-4"><Card className="w-full max-w-md p-6">
    <h1 className="text-2xl font-semibold">Change password</h1>
    <p className="mt-2 text-sm text-text-secondary">{user?.mustChangePassword ? 'Your administrator reset your password. Choose a new password before continuing.' : 'Choose a new password for your account.'}</p>
    <p className="mt-2 break-all text-sm text-text-secondary">{user?.email}</p>
    <form onSubmit={submit} className="mt-6 space-y-4">
      <Input label="Current or temporary password" type="password" autoComplete="current-password" required maxLength={72} value={current} onChange={e=>setCurrent(e.target.value)}/>
      <Input label="New password" type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)}/>
      <Input label="Confirm new password" type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={confirm} onChange={e=>setConfirm(e.target.value)}/>
      <p className="text-xs text-text-secondary">Use at least 12 characters and a different password from your temporary password.</p>
      {error && <p role="alert" className="text-sm text-status-alert">{error}</p>}
      <Button type="submit" variant="primary" className="w-full" disabled={saving}>{saving ? 'Saving...' : 'Save new password'}</Button>
      <Button type="button" variant="ghost" className="w-full" disabled={saving} onClick={()=>{logout();navigate('/login', {replace:true})}}>Log out</Button>
    </form>
  </Card></main>
}
