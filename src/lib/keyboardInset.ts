import { Keyboard } from '@capacitor/keyboard'
import { isNativeApp } from './platform'

const TEXTUAL = new Set(['', 'text', 'email', 'password', 'search', 'tel', 'url', 'number'])

let nativeReported = 0
let baselineInner = 0
let installed = false

export function isTextField(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly
  if (el instanceof HTMLInputElement) {
    return TEXTUAL.has(el.type) && !el.disabled && !el.readOnly
  }
  return false
}

function isField(el: EventTarget | null): el is HTMLElement {
  return isTextField(el) || (el instanceof HTMLSelectElement && !el.disabled)
}

function keyboardIsUp(): boolean {
  return nativeReported > 0 || isField(document.activeElement)
}

/**
 * Keyboard overlap that CSS still has to clear.
 * Once the field blurs and the native keyboard reports closed, the inset is 0
 * even if the visual viewport has not caught up yet. That lets the sheet grow
 * back into the space the keyboard was using.
 */
export function keyboardOverlap(): number {
  if (!keyboardIsUp()) return 0
  const vv = window.visualViewport
  const viewportInset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0
  const shrunk = Math.max(0, baselineInner - window.innerHeight)
  const nativeOverlay = Math.max(0, nativeReported - shrunk)
  return Math.max(viewportInset, nativeOverlay)
}

function readInset(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--keyboard-inset')
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

function publish(): void {
  const inset = Math.round(keyboardOverlap())
  const root = document.documentElement
  const next = `${inset}px`
  if (root.style.getPropertyValue('--keyboard-inset') !== next) {
    root.style.setProperty('--keyboard-inset', next)
  }
  const open = inset > 0
  if (root.classList.contains('keyboard-open') !== open) root.classList.toggle('keyboard-open', open)
  if (inset === 0) baselineInner = window.innerHeight
}

function findScroller(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement
  while (node && node !== document.body) {
    const overflow = getComputedStyle(node).overflowY
    if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight + 2) {
      return node
    }
    node = node.parentElement
  }
  return null
}

let suppressScrollDismiss = 0
let suppressScrollDismissUntil = 0

function holdScrollDismiss(ms: number) {
  suppressScrollDismissUntil = Math.max(suppressScrollDismissUntil, Date.now() + ms)
}

/** True when a finger-scroll should put the keyboard away so the rest of the form is visible. */
export function shouldDismissKeyboardOnScroll(): boolean {
  if (suppressScrollDismiss > 0) return false
  if (Date.now() < suppressScrollDismissUntil) return false
  // An open place or region list is still being edited. Scrolling to reach a
  // suggestion must not blur the field and throw away the text.
  if (document.querySelector('[data-combobox-open="true"]')) return false
  return keyboardOverlap() > 0 || document.documentElement.classList.contains('keyboard-open')
}

/**
 * Drop a body height the iOS keyboard plugin set while the keyboard was open.
 * If that pixel height sticks after the keyboard is gone, the webview's dark
 * backdrop shows through as a black band above the tab bar.
 */
export function releaseKeyboardFrame(): void {
  nativeReported = 0
  if (document.body.style.height) document.body.style.height = ''
  publish()
}

/** Clear a stuck keyboard frame now and again after the plugin's delayed resize. */
export function releaseKeyboardFrameSoon(): void {
  releaseKeyboardFrame()
  window.setTimeout(releaseKeyboardFrame, 80)
  window.setTimeout(releaseKeyboardFrame, 400)
  window.setTimeout(releaseKeyboardFrame, 900)
}

/** Slide the focused field (and its label) into the band above the keyboard. */
export function revealFocusedField(): void {
  const el = document.activeElement
  if (!isField(el)) return
  suppressScrollDismiss += 1
  // scrollTop can notify the form after this function returns, especially on iOS.
  holdScrollDismiss(500)
  const label = el.closest('label')
  const target = label instanceof HTMLElement ? label : el
  const scroller = findScroller(el)
  const scrollerRect = scroller?.getBoundingClientRect()
  const inset = Math.max(keyboardOverlap(), readInset())
  const viewTop = Math.max(scrollerRect?.top ?? 0, 0) + 8
  const keyboardLine = window.innerHeight - inset - 16
  const viewBottom = Math.min(scrollerRect?.bottom ?? keyboardLine, keyboardLine)
  const rect = target.getBoundingClientRect()
  let delta = 0
  if (rect.bottom > viewBottom) delta = rect.bottom - viewBottom
  else if (rect.top < viewTop) delta = rect.top - viewTop
  const releaseSuppress = () => {
    window.requestAnimationFrame(() => {
      suppressScrollDismiss = Math.max(0, suppressScrollDismiss - 1)
    })
  }
  if (Math.abs(delta) < 1) {
    releaseSuppress()
    return
  }
  if (scroller) scroller.scrollTop += delta
  else window.scrollBy(0, delta)
  releaseSuppress()
}

/** Close the software keyboard. A finished scan should leave the fields visible, not covered. */
export function dismissKeyboard(): void {
  const active = document.activeElement
  if (active instanceof HTMLElement && active !== document.body) active.blur()
  if (isNativeApp()) {
    void Keyboard.hide()
    return
  }
  nativeReported = 0
  publish()
}

export function focusNextTextField(current: HTMLElement, root: ParentNode = document): boolean {
  const fields = [...root.querySelectorAll<HTMLElement>('input, textarea')].filter((el) => {
    if (!isTextField(el)) return false
    if (el.tabIndex < 0) return false
    return el.getClientRects().length > 0
  })
  const index = fields.indexOf(current)
  const next = index >= 0 ? fields[index + 1] : undefined
  if (!next) return false
  next.focus()
  return true
}

export function installKeyboardInset(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  baselineInner = window.innerHeight

  const onGeometry = () => {
    publish()
    if (keyboardOverlap() > 0) revealFocusedField()
  }
  window.visualViewport?.addEventListener('resize', onGeometry)
  window.visualViewport?.addEventListener('scroll', publish)
  window.addEventListener('resize', () => {
    if (nativeReported === 0) baselineInner = window.innerHeight
    onGeometry()
  })
  const releaseInset = () => {
    window.requestAnimationFrame(() => {
      publish()
      window.setTimeout(publish, 60)
      window.setTimeout(publish, 320)
    })
  }
  document.addEventListener('focusin', (event) => {
    if (!isField(event.target)) return
    window.setTimeout(revealFocusedField, 50)
    window.setTimeout(revealFocusedField, 320)
  })
  document.addEventListener('focusout', (event) => {
    if (!isField(event.target)) return
    releaseInset()
  })
  // The sheet shrinks when the keyboard inset lands. Pull the field back into
  // that band even if it was already focused (autofocus) and never got a new focus event.
  let quickReveal = 0
  let lateReveal = 0
  const scheduleReveal = () => {
    if (readInset() <= 0) return
    window.clearTimeout(quickReveal)
    window.clearTimeout(lateReveal)
    quickReveal = window.setTimeout(revealFocusedField, 40)
    lateReveal = window.setTimeout(revealFocusedField, 320)
  }
  new MutationObserver(scheduleReveal).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style'],
  })

  if (isNativeApp()) {
    // The webview's own "scroll focused field into view" fights the sheet scroller.
    void Keyboard.setScroll({ isDisabled: true })
    void Keyboard.addListener('keyboardWillShow', (info) => {
      nativeReported = info.keyboardHeight
      onGeometry()
    })
    void Keyboard.addListener('keyboardDidShow', (info) => {
      // A late show after the field is already gone leaves the body short and
      // paints the webview's dark backdrop over the Add screen.
      if (!isField(document.activeElement)) {
        releaseKeyboardFrameSoon()
        return
      }
      nativeReported = info.keyboardHeight
      onGeometry()
      window.setTimeout(revealFocusedField, 50)
    })
    const hide = () => {
      const active = document.activeElement
      if (isField(active)) active.blur()
      releaseKeyboardFrameSoon()
      releaseInset()
    }
    void Keyboard.addListener('keyboardWillHide', hide)
    void Keyboard.addListener('keyboardDidHide', hide)
  }

  publish()
}
