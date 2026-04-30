import { useEffect, useRef } from 'react'

const FOCUSEABLE_SELECTORS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
) {
  const previousFocus = useRef<Element | null>(null)

  useEffect(() => {
    if (!isOpen) {
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus()
      }
      previousFocus.current = null
      return
    }

    previousFocus.current = document.activeElement

    const container = containerRef.current
    if (!container) return

    const firstFocuseable = container.querySelector<HTMLElement>(FOCUSEABLE_SELECTORS)
    if (firstFocuseable) {
      firstFocuseable.focus()
    } else if (container.tabIndex === -1) {
      container.focus()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focuseables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSEABLE_SELECTORS),
      ).filter(el => !el.closest('[hidden]') && el.offsetParent !== null)

      if (focuseables.length === 0) {
        e.preventDefault()
        return
      }

      const first = focuseables[0]
      const last = focuseables[focuseables.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, containerRef])
}
