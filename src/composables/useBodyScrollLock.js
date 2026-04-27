import { onMounted, onBeforeUnmount } from 'vue'

let lockCount = 0
let savedScrollY = 0

/**
 * Lock body scroll while a modal/sheet is mounted.
 * Multiple modals stack — body unlocks only when the last one unmounts.
 * Preserves scroll position so the user returns to where they were.
 */
export function useBodyScrollLock() {
  onMounted(() => {
    if (lockCount === 0) {
      savedScrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${savedScrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      document.body.style.width = '100%'
    }
    lockCount++
  })

  onBeforeUnmount(() => {
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount === 0) {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.width = ''
      window.scrollTo(0, savedScrollY)
    }
  })
}
