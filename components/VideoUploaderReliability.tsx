'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import ReliabilityResults from './ReliabilityResults'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'

interface VideoUploaderReliabilityProps {
  onAnalysisStart: () => void
  onAnalysisComplete: (data: any) => void
  onError: (error: string) => void
  isAnalyzing: boolean
  onVideoUrlChange?: (url: string | null) => void
  videoRef?: React.RefObject<HTMLVideoElement>
}

export default function VideoUploaderReliability({
  onAnalysisStart,
  onAnalysisComplete,
  onError,
  isAnalyzing,
  onVideoUrlChange,
  videoRef,
}: VideoUploaderReliabilityProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fps, setFps] = useState<number>(5)
  const [roiPoints, setRoiPoints] = useState<Array<{ x: number; y: number }>>([])
  const [showRoiDraw, setShowRoiDraw] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  // Use provided videoRef or create a local one
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const actualVideoRef = videoRef || localVideoRef

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('video/') && !file.name.toLowerCase().endsWith('.mp4')) {
        onError('Please select a valid MP4 video file')
        return
      }
      
      // Validate file size (5-20s recommendation, but allow up to 50MB)
      if (file.size > 50 * 1024 * 1024) {
        onError('Video file too large. Maximum 50MB. For best results, use 5-20 second clips.')
        return
      }
      
      setSelectedFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      onVideoUrlChange?.(url)
      setRoiPoints([]) // Reset ROI when new file selected
    }
  }

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || roiPoints.length >= 4) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    
    setRoiPoints(prev => [...prev, { x, y }])
  }, [])

  const handleClearRoi = () => {
    setRoiPoints([])
  }

  // Redraw canvas when roiPoints change
  useEffect(() => {
    if (!showRoiDraw || !canvasRef.current || !actualVideoRef.current) return
    
    const canvas = canvasRef.current
    const video = actualVideoRef.current
    
    const draw = () => {
      const rect = video.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      
      canvas.width = rect.width
      canvas.height = rect.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      roiPoints.forEach((point, idx) => {
        const x = point.x * canvas.width
        const y = point.y * canvas.height
        ctx.fillStyle = '#4ade80'
        ctx.beginPath()
        ctx.arc(x, y, 8, 0, 2 * Math.PI)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 12px sans-serif'
        ctx.fillText(`P${idx + 1}`, x + 12, y + 4)
      })
      if (roiPoints.length === 4) {
        // Draw ROI rectangle
        const xs = roiPoints.map(p => p.x * canvas.width).sort((a, b) => a - b)
        const ys = roiPoints.map(p => p.y * canvas.height).sort((a, b) => a - b)
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 2
        ctx.strokeRect(xs[0], ys[0], xs[3] - xs[0], ys[3] - ys[0])
      }
    }
    
    draw()
    const handleResize = () => draw()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [roiPoints, showRoiDraw])

  const handleUpload = async () => {
    if (!selectedFile) {
      onError('Please select a video file first')
      return
    }

    // Validate file size
    if (selectedFile.size > 50 * 1024 * 1024) {
      onError('Video file too large. Maximum 50MB. For best results, use 5-20 second clips.')
      return
    }

    // Validate video duration (estimate from size, roughly 1MB per second for MP4)
    const estimatedDuration = selectedFile.size / (1024 * 1024)
    if (estimatedDuration > 20) {
      onError('Clip too long—try <20s for best results.')
      return
    }

    onAnalysisStart()

    try {
      const formData = new FormData()
      formData.append('video', selectedFile)
      formData.append('fps', fps.toString())
      
      // Add ROI if 4 points are drawn, otherwise use default
      if (roiPoints.length === 4) {
        // Convert points to ROI format [x1, y1, x2, y2]
        const xs = roiPoints.map(p => p.x).sort((a, b) => a - b)
        const ys = roiPoints.map(p => p.y).sort((a, b) => a - b)
        const roi = [xs[0], ys[0], xs[3], ys[3]] as [number, number, number, number]
        formData.append('roi', JSON.stringify(roi))
      }

      const requestStart = Date.now()
      
      // Always use Next.js API route (mock processing) - works without backend
      // Backend is optional and only used if explicitly configured AND available
      const endpoint = '/api/analyze-reliability'
      
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Frontend] Using Next.js API route: ${endpoint}`)
        console.log(`[Frontend] Calling ${endpoint} with file: ${selectedFile.name} (${selectedFile.size} bytes) at`, new Date().toISOString())
      }
      
      // Add timeout (65 seconds for Vercel)
      const timeout = 65000
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      
      let response: Response
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        })
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Frontend] Response received in ${Date.now() - requestStart}ms, status: ${response.status}`)
        }
      } catch (fetchError) {
        console.error('[Frontend] Fetch error:', fetchError)
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error(`Request timed out after ${timeout / 1000} seconds`)
        }
        throw fetchError
      }

      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorMessage = 'Reliability analysis failed'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          const statusText = response.status === 413 
            ? 'File too large (413 Payload Too Large). Vercel has a 4.5MB limit. Use NEXT_PUBLIC_ANALYSIS_BACKEND_URL to upload directly to backend.'
            : response.statusText
          errorMessage = `Server error: ${response.status} ${statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      onAnalysisComplete(data)
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          onError('Request timed out. The video might be too large or processing took too long.')
        } else {
          onError(error.message)
        }
      } else {
        onError('Failed to analyze video reliability')
      }
    }
  }

  const handleClear = () => {
    setSelectedFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    onVideoUrlChange?.(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Card className="glass-effect sleek-shadow border-gray-800">
      <CardHeader>
        <CardTitle className="text-white">Upload Video for Reliability Audit</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-800 rounded-lg p-6 text-center hover:border-gray-700 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4"
              onChange={handleFileSelect}
              className="hidden"
              id="video-upload-reliability"
              disabled={isAnalyzing}
            />
            <label
              htmlFor="video-upload-reliability"
              className={`cursor-pointer block ${
                isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="mt-2 block text-sm font-medium text-white">
                {selectedFile ? selectedFile.name : 'Click to upload MP4 video'}
              </span>
              <span className="mt-1 block text-xs text-gray-400">
                MP4 format, 5-20s recommended, up to 50MB
              </span>
            </label>
          </div>

          {/* FPS Slider */}
          <div className="space-y-2">
            <Label className="text-white text-sm">FPS (Frames per second): {fps}</Label>
            <Slider
              value={[fps]}
              onValueChange={(value) => setFps(value[0])}
              min={1}
              max={10}
              step={1}
              disabled={isAnalyzing}
              className="w-full"
            />
            <p className="text-xs text-gray-400">Lower FPS = faster processing, higher FPS = more accurate</p>
          </div>

          {/* ROI Draw Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="roi-draw-toggle"
              checked={showRoiDraw}
              onChange={(e) => setShowRoiDraw(e.target.checked)}
              disabled={!previewUrl || isAnalyzing}
              className="rounded"
            />
            <Label htmlFor="roi-draw-toggle" className="text-white text-sm cursor-pointer">
              Draw ROI (4 points) - Optional
            </Label>
            {roiPoints.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearRoi}
                className="text-xs text-gray-400 hover:text-white"
              >
                Clear ({roiPoints.length}/4)
              </Button>
            )}
          </div>

          {previewUrl && (
            <div className="relative">
              {showRoiDraw ? (
                <div className="relative">
                  <video
                    ref={actualVideoRef}
                    src={previewUrl}
                    className="w-full rounded-lg"
                    style={{ maxHeight: '400px' }}
                    controls={false}
                    muted
                  />
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    className="absolute top-0 left-0 w-full h-full cursor-crosshair rounded-lg pointer-events-auto"
                    style={{ maxHeight: '400px' }}
                  />
                  <button
                    onClick={handleClear}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 z-10"
                    disabled={isAnalyzing}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <video
                    ref={actualVideoRef}
                    src={previewUrl}
                    controls
                    autoPlay
                    muted
                    loop
                    className="w-full rounded-lg"
                    style={{ maxHeight: '400px' }}
                  />
                  <button
                    onClick={handleClear}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600"
                    disabled={isAnalyzing}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-4">
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isAnalyzing}
              className="flex-1"
              variant={!selectedFile || isAnalyzing ? 'secondary' : 'default'}
            >
              {isAnalyzing ? 'Analyzing...' : 'Run Audit'}
            </Button>
          </div>

          {selectedFile && (
            <div className="text-sm text-gray-400">
              <p>File: {selectedFile.name}</p>
              <p>Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
              <p>Type: {selectedFile.type}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
