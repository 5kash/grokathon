'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface LiveStreamAnalyzerProps {
  onAnalysisUpdate: (result: string, timestamp: Date) => void
  onError: (error: string) => void
  isStreaming: boolean
  onStreamingChange: (streaming: boolean) => void
}

export default function LiveStreamAnalyzer({
  onAnalysisUpdate,
  onError,
  isStreaming,
  onStreamingChange,
}: LiveStreamAnalyzerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [cameraUrl, setCameraUrl] = useState<string>('')
  const [useWebcam, setUseWebcam] = useState<boolean>(true)
  const [analysisInterval, setAnalysisInterval] = useState<number>(5) // seconds
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Date | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming()
    }
  }, [])

  const stopStreaming = () => {
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current)
      analysisIntervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    onStreamingChange(false)
  }

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      onStreamingChange(true)
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to access webcam. Please check permissions.'
      )
    }
  }

  const startIPCamera = () => {
    if (!cameraUrl.trim()) {
      onError('Please enter a valid camera URL')
      return
    }
    if (videoRef.current) {
      videoRef.current.src = cameraUrl
      videoRef.current.play()
      onStreamingChange(true)
    }
  }

  const extractFrame = (): string | null => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return null

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    ctx.drawImage(video, 0, 0)

    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
  }

  const analyzeFrame = async () => {
    const frame = extractFrame()
    if (!frame) return

    try {
      const formData = new FormData()
      formData.append('frame', frame)
      formData.append('timestamp', new Date().toISOString())

      const response = await fetch('/api/analyze-live', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Analysis failed')
      }

      const data = await response.json()
      setLastAnalysisTime(new Date())
      onAnalysisUpdate(data.analysis, new Date())
    } catch (error) {
      onError(
        error instanceof Error ? error.message : 'Failed to analyze frame'
      )
    }
  }

  useEffect(() => {
    if (!isStreaming) {
      stopStreaming()
      if (videoRef.current) {
        videoRef.current.srcObject = null
        videoRef.current.src = ''
      }
      return
    }

    // Start streaming
    const initializeStream = async () => {
      if (useWebcam) {
        await startWebcam()
      } else {
        startIPCamera()
      }

      // Wait a bit for video to be ready
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Start periodic analysis
      analysisIntervalRef.current = setInterval(() => {
        analyzeFrame()
      }, analysisInterval * 1000)

      // Do initial analysis after a short delay
      setTimeout(() => {
        analyzeFrame()
      }, 2000)
    }

    initializeStream()

    return () => {
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current)
        analysisIntervalRef.current = null
      }
      stopStreaming()
    }
  }, [isStreaming, useWebcam, analysisInterval])

  return (
    <Card className="glass-effect sleek-shadow border-gray-800">
      <CardHeader>
        <CardTitle className="text-white">Live Stream Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
        {/* Source Selection */}
        <div className="flex gap-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white transition-colors">
            <input
              type="radio"
              name="source"
              checked={useWebcam}
              onChange={() => setUseWebcam(true)}
              disabled={isStreaming}
              className="w-4 h-4 accent-white"
            />
            <span>Webcam</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white transition-colors">
            <input
              type="radio"
              name="source"
              checked={!useWebcam}
              onChange={() => setUseWebcam(false)}
              disabled={isStreaming}
              className="w-4 h-4 accent-white"
            />
            <span>IP Camera / RTSP</span>
          </label>
        </div>

        {/* IP Camera URL Input */}
        {!useWebcam && (
          <div>
            <Label htmlFor="camera-url" className="text-gray-300">
              Camera URL (RTSP, HTTP, etc.)
            </Label>
            <Input
              id="camera-url"
              type="text"
              value={cameraUrl}
              onChange={(e) => setCameraUrl(e.target.value)}
              placeholder="rtsp://username:password@ip:port/stream or http://..."
              disabled={isStreaming}
              className="mt-2 bg-gray-900 border-gray-800 text-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              Note: Browser support for RTSP is limited. Consider using a proxy or HLS stream.
            </p>
          </div>
        )}

        {/* Analysis Interval */}
        <div>
          <Label htmlFor="interval" className="text-gray-300">
            Analysis Interval (seconds)
          </Label>
          <Input
            id="interval"
            type="number"
            min="1"
            max="60"
            value={analysisInterval}
            onChange={(e) => setAnalysisInterval(parseInt(e.target.value) || 5)}
            disabled={isStreaming}
            className="mt-2 bg-gray-900 border-gray-800 text-white"
          />
        </div>

        {/* Video Preview */}
        <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '300px' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
            style={{ maxHeight: '400px' }}
          />
          <canvas ref={canvasRef} className="hidden" />
          {!isStreaming && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <svg
                  className="mx-auto h-12 w-12 mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <p>No stream active</p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-4">
          {!isStreaming ? (
            <Button
              onClick={() => onStreamingChange(true)}
              className="flex-1"
              variant="default"
            >
              Start Live Analysis
            </Button>
          ) : (
            <Button
              onClick={() => onStreamingChange(false)}
              className="flex-1"
              variant="secondary"
            >
              Stop Analysis
            </Button>
          )}
        </div>

        {/* Status */}
        {isStreaming && (
          <div className="text-sm text-gray-400">
            <p className="flex items-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              Live analysis active - Analyzing every {analysisInterval} seconds
            </p>
            {lastAnalysisTime && (
              <p className="mt-1 text-gray-500">
                Last analysis: {lastAnalysisTime.toLocaleTimeString()}
              </p>
            )}
          </div>
        )}
        </div>
      </CardContent>
    </Card>
  )
}
