import type { Directive } from 'vue'

function handleWheel(e: Event, el: HTMLInputElement) {
  const wheelEvent = e as WheelEvent
  wheelEvent.preventDefault()

  const step = parseFloat(el.step) || 1
  const min = el.min !== '' ? parseFloat(el.min) : null
  const max = el.max !== '' ? parseFloat(el.max) : null

  const direction = wheelEvent.deltaY > 0 ? -1 : 1

  let value = parseFloat(el.value)
  if (isNaN(value)) value = 0

  const multiplier = wheelEvent.shiftKey ? 0.1 : wheelEvent.ctrlKey || wheelEvent.metaKey ? 10 : 1
  value += direction * step * multiplier

  if (min !== null) value = Math.max(min, value)
  if (max !== null) value = Math.min(max, value)

  el.value = String(value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function handleSelectWheel(e: Event, el: HTMLSelectElement) {
  const wheelEvent = e as WheelEvent
  wheelEvent.preventDefault()

  const direction = wheelEvent.deltaY > 0 ? 1 : -1
  const newIndex = el.selectedIndex + direction

  if (newIndex >= 0 && newIndex < el.options.length) {
    el.selectedIndex = newIndex
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
}

export const vWheelStep: Directive = {
  mounted(el: HTMLElement) {
    if (el instanceof HTMLSelectElement) {
      el.addEventListener('wheel', (e) => handleSelectWheel(e, el), { passive: false })
    } else if (el instanceof HTMLInputElement) {
      el.addEventListener('wheel', (e) => handleWheel(e, el), { passive: false })
    }
  },
  unmounted(el: HTMLElement) {
    if (el instanceof HTMLSelectElement || el instanceof HTMLInputElement) {
      el.removeEventListener('wheel', (e) => {
        if (el instanceof HTMLSelectElement) handleSelectWheel(e, el)
        else handleWheel(e, el as HTMLInputElement)
      })
    }
  },
}
