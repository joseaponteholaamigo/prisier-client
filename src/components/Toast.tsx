import { useEffect, useRef } from 'react'
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import type { ToastItem } from './ToastProvider'

interface ToastProps {
  item: ToastItem
  onClose: (id: string) => void
}

const ICONS = {
  success: <CheckCircle2 size={16} className="text-p-lime shrink-0 mt-0.5" />,
  error: <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />,
  info: <Info size={16} className="text-p-blue shrink-0 mt-0.5" />,
}

export function Toast({ item, onClose }: ToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => onClose(item.id), item.duration)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [item.id, item.duration, onClose])

  return (
    <div
      role={item.kind === 'error' ? 'alert' : 'status'}
      aria-live={item.kind === 'error' ? 'assertive' : 'polite'}
      onClick={() => onClose(item.id)}
      className="glass-panel flex items-start gap-2.5 w-full max-w-xs rounded-xl px-3.5 py-3 cursor-pointer"
    >
      {ICONS[item.kind]}
      <p className="flex-1 text-sm text-white line-clamp-3 leading-snug">{item.message}</p>
      <button
        type="button"
        aria-label="Cerrar notificación"
        onClick={e => { e.stopPropagation(); onClose(item.id) }}
        className="text-p-muted hover:text-white transition-colors shrink-0 mt-0.5"
      >
        <X size={14} />
      </button>
    </div>
  )
}
