import { useState, useEffect, type FormEvent } from 'react'
import { Modal, Input, Button } from '@/components/ui'
import { GuardStatusBadge } from './GuardStatusBadge'
import type { Guard } from '@/types'
import type { GuardInput } from '@/services/guardService'

type Mode = 'add' | 'edit' | 'view'

interface GuardFormModalProps {
  mode: Mode
  guard: Guard | null
  open: boolean
  onClose: () => void
  onSubmit: (values: GuardInput) => Promise<void>
}

const EMPTY_FORM = { name: '', email: '', phone: '', badgeNumber: '', password: '' }

export function GuardFormModal({ mode, guard, open, onClose, onSubmit }: GuardFormModalProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const readOnly = mode === 'view'

  useEffect(() => {
    setError(null)
    if (guard) {
      setForm({
        name: guard.name,
        email: guard.email,
        phone: guard.phone,
        badgeNumber: guard.badgeNumber, password: '',
      })
    } else {
      setForm(EMPTY_FORM)
    }
  }, [guard, open])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try { await onSubmit(form) }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to save guard') }
    finally { setSaving(false) }
  }

  const title = mode === 'add' ? 'Add Security Guard' : mode === 'edit' ? 'Edit Guard' : 'Guard Details'

  return (
    <Modal open={open} onClose={() => { if (!saving) onClose() }} title={title}>
      <form id="guard-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <p role="alert" className="rounded-lg border border-status-alert/30 bg-status-alert/10 p-3 text-sm text-status-alert">{error}</p>}
        {guard && (
          <div className="flex items-center justify-between rounded-lg border border-line bg-surface-2 px-3 py-2.5">
            <span className="text-xs text-text-secondary">Status</span>
            <GuardStatusBadge status={guard.status} />
          </div>
        )}

        <Input
          id="guard-name"
          label="Full name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          readOnly={readOnly}
          required
        />
        <Input
          id="guard-email"
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          readOnly={readOnly}
          required
        />
        {mode === 'add' && <><Input id="guard-password" label="Initial login password (new accounts)" type="password" autoComplete="new-password" minLength={12} value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} /><p className="text-xs text-text-secondary">Use at least 12 characters for a new login. Leave blank only when linking an existing account.</p></>}
        <Input
          id="guard-phone"
          label="Phone"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          readOnly={readOnly}
          required
        />
        <Input
          id="guard-badge"
          label="Badge number"
          value={form.badgeNumber}
          onChange={(e) => setForm((f) => ({ ...f, badgeNumber: e.target.value }))}
          readOnly={readOnly}
          required
        />

        {guard && (
          <p className="text-xs text-text-muted">
            Joined {new Date(guard.dateJoined).toLocaleDateString('en-US', { dateStyle: 'medium' })}
          </p>
        )}

        {!readOnly && (
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : mode === 'add' ? 'Add Guard' : 'Save Changes'}
            </Button>
          </div>
        )}
      </form>
    </Modal>
  )
}
