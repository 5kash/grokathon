'use client'

import { useState, useRef } from 'react'
import ReliabilityResults from './ReliabilityResults'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

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
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Use provided videoRef or create a local one
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const actualVideoRef = videoRef || localVideoRef

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type.startsWith('video/')) {
        setSelectedFile(file)
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)
        onVideoUrlChange?.(url)
      } else {
        onError('Please select a valid video file (MP4)')
      }
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      onError('Please select a video file first')
      return
    }

    // Validate file size (reasonable limit for video processing)
    if (selectedFile.size > 100 * 1024 * 1024) {
      onError('Video file too large. Maximum 100MB.')
      return
    }

    onAnalysisStart()

    try {
      const formData = new FormData()
      formData.append('video', selectedFile)
      // Optional: add fps parameter (default 5)
      formData.append('fps', '5')
      // Optional: add ROI parameter (default will be used if not provided)
      // formData.append('roi', JSON.stringify([0.25, 0.6, 0.75, 0.95]))

      const requestStart = Date.now()
      
      // Always use Next.js API route (mock processing) - works without backend
      // Backend is optional and only used if explicitly configured AND available
      const endpoint = '/api/analyze-reliability'
      console.log(`[Frontend] Using Next.js API route: ${endpoint}`)
      
      console.log(`[Frontend] Calling ${endpoint} with file: ${selectedFile.name} (${selectedFile.size} bytes) at`, new Date().toISOString())
      
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
        console.log(`[Frontend] Response received in ${Date.now() - requestStart}ms, status: ${response.status}`)
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
                MP4 format, up to 50MB (Vercel Pro)
              </span>
            </label>
          </div>

          {previewUrl && (
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
