'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'
import { X, Camera } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface BarcodeScannerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBarcodeDetected: (gtin: string) => void
}

export function BarcodeScannerModal({
  open,
  onOpenChange,
  onBarcodeDetected,
}: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Cleanup function to stop camera
  const stopCamera = () => {
    if (readerRef.current) {
      readerRef.current.reset()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraReady(false)
    setIsScanning(false)
  }

  // Start camera and barcode scanning
  useEffect(() => {
    if (!open) {
      stopCamera()
      setError(null)
      return
    }

    const startScanning = async () => {
      setError(null)
      setIsScanning(true)

      try {
        console.log('[Barcode Scanner] Starting camera...')

        // Request camera with high quality constraints
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: 'environment' }, // Back camera on mobile
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream

          // Wait for video to be ready
          await new Promise((resolve) => {
            if (videoRef.current) {
              videoRef.current.onloadedmetadata = () => {
                videoRef.current?.play()
                resolve(true)
              }
            }
          })

          setCameraReady(true)
          console.log('[Barcode Scanner] Camera ready, starting barcode detection...')

          // Initialize ZXing reader
          const codeReader = new BrowserMultiFormatReader()
          readerRef.current = codeReader

          // Start continuous decoding with hints for better detection
          const hints = new Map()
          hints.set(2, true) // PURE_BARCODE

          codeReader.decodeFromVideoElement(
            videoRef.current,
            (result, error) => {
              if (result) {
                const gtin = result.getText()
                console.log('[Barcode Scanner] ✓ Detected barcode:', gtin)

                // Stop camera immediately
                stopCamera()

                // Notify parent
                onBarcodeDetected(gtin)
              }

              // Ignore NotFoundException (just means no barcode in frame yet)
              if (error && !(error instanceof NotFoundException)) {
                console.warn('[Barcode Scanner] Decode error:', error)
              }
            }
          )

          console.log('[Barcode Scanner] Scanning active - point camera at barcode')
        }
      } catch (err: any) {
        console.error('[Barcode Scanner] Camera error:', err)

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Camera permission denied. Please enable camera access in your browser settings.')
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No camera found on this device.')
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('Camera is already in use by another application.')
        } else {
          setError('Failed to access camera. Please try again.')
        }

        setIsScanning(false)
      }
    }

    startScanning()

    // Cleanup on unmount or when modal closes
    return () => {
      stopCamera()
    }
  }, [open, onBarcodeDetected])

  // Don't render if not open
  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-lg bg-elev-1 rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-white" strokeWidth={1.75} />
              <h2 className="text-lg font-semibold text-white">
                Scan Barcode
              </h2>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Close scanner"
            >
              <X className="h-5 w-5 text-white" strokeWidth={2} />
            </button>
          </div>

          {/* Video Container */}
          <div className="relative aspect-[4/3] bg-black">
            {/* Video Element */}
            <video
              ref={videoRef}
              className={cn(
                'w-full h-full object-cover',
                !cameraReady && 'invisible'
              )}
              autoPlay
              playsInline
              muted
            />

            {/* Scanning Overlay */}
            {cameraReady && !error && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {/* Frame box */}
                <div className="relative w-64 h-64">
                  {/* Corner borders */}
                  <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-accent rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-accent rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-accent rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-accent rounded-br-lg" />

                  {/* Scanning line animation */}
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute left-0 right-0 h-0.5 bg-accent animate-scan-line" />
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isScanning && !cameraReady && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-accent border-t-transparent mb-4" />
                <p className="text-sm text-muted">Starting camera...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white p-6">
                <div className="rounded-full bg-red-500/20 p-4 mb-4">
                  <X className="h-8 w-8 text-red-400" strokeWidth={2} />
                </div>
                <p className="text-center text-sm text-red-200 mb-4">
                  {error}
                </p>
                <button
                  onClick={() => onOpenChange(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>

          {/* Instructions */}
          {cameraReady && !error && (
            <div className="p-4 bg-elev-2 border-t border-border">
              <div className="flex items-center justify-center gap-2">
                <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                <p className="text-sm text-center text-muted">
                  Scanning... Position barcode in frame
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
