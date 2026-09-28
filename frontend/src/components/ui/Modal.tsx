import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const titleId = useId()
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const element = dialog.current
    ;(element?.querySelector('input, textarea, button') as HTMLElement | null)?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current() }
      if (event.key !== 'Tab') return
      const focusable = Array.from(element?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]') ?? []).filter(item=>item.getClientRects().length)
      const first = focusable[0], last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('keydown', keydown); previous?.focus() }
  }, [open])
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative flex max-h-[85vh] w-full max-w-md flex-col rounded-xl border border-line bg-surface-1 shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-sm font-semibold text-text-primary">{title}</h2>
          <IconButton label="Close" onClick={onClose} className="-mr-1.5">
            <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}
