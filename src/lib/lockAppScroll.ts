const LOCK_CLASS = 'app-scroll-locked'

/** Prevent the native `.content` scroller from moving while a modal is open. */
export function lockAppScroll(): () => void {
  document.documentElement.classList.add(LOCK_CLASS)
  return () => {
    document.documentElement.classList.remove(LOCK_CLASS)
  }
}
