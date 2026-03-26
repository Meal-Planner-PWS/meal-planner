import { ref } from 'vue'

export function useBarcodeScanner() {
  const scanning = ref(false)
  const error = ref(null)
  const permissionDenied = ref(false)
  let reader = null
  let controls = null

  async function startScanning(videoElement, onDetected) {
    try {
      permissionDenied.value = false
      error.value = null

      // Check if camera API is available (requires HTTPS)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        permissionDenied.value = true
        error.value = 'no_camera_api'
        return
      }

      // Request camera permission explicitly first — this triggers the browser prompt
      await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          // Permission granted — stop this temporary stream, @zxing will open its own
          stream.getTracks().forEach((t) => t.stop())
        })

      // Dynamic import to avoid loading @zxing/browser until needed
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      reader = new BrowserMultiFormatReader()
      scanning.value = true

      controls = await reader.decodeFromVideoDevice(
        undefined,
        videoElement,
        (result, err) => {
          if (result) {
            onDetected(result.getText())
            stopScanning()
          }
          if (err && err.name !== 'NotFoundException') {
            // NotFoundException is expected when no barcode is in frame
          }
        }
      )
    } catch (e) {
      scanning.value = false

      if (
        e.name === 'NotAllowedError' ||
        e.message?.includes('Permission') ||
        e.message?.includes('permission')
      ) {
        permissionDenied.value = true
        error.value = 'denied'
      } else if (
        e.name === 'NotFoundError' ||
        e.message?.includes('Requested device not found')
      ) {
        error.value = 'No camera found on this device.'
      } else {
        error.value = e.message || 'Could not start camera.'
      }
    }
  }

  function stopScanning() {
    if (controls && typeof controls.stop === 'function') {
      controls.stop()
      controls = null
    }
    if (reader) {
      reader = null
    }
    scanning.value = false
  }

  return { scanning, error, permissionDenied, startScanning, stopScanning }
}
