'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface VideoUploaderProps {
  onAnalysisStart: () => void
  onAnalysisComplete: (result: string) => void
  onError: (error: string) => void
  isAnalyzing: boolean
}

export default function VideoUploader({
  onAnalysisStart,
  onAnalysisComplete,
  onError,
  isAnalyzing,
}: VideoUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type.startsWith('video/')) {
        setSelectedFile(file)
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)
      } else {
        onError('Please select a valid video file')
      }
    }
  }

  const extractFrames = async (videoFile: File, frameCount: number = 5): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }
      
      video.src = URL.createObjectURL(videoFile)
      video.onloadedmetadata = () => {
        const frames: string[] = []
        const duration = video.duration
        const interval = duration / (frameCount + 1)
        
        let loadedFrames = 0
        
        const extractFrame = (time: number) => {
          video.currentTime = time
        }
        
        video.onseeked = () => {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0)
          
          const base64 = canvas.toDataURL('image/jpeg', 0.8)
          frames.push(base64.split(',')[1]) // Remove data:image/jpeg;base64, prefix
          loadedFrames++
          
          if (loadedFrames < frameCount) {
            extractFrame(interval * (loadedFrames + 1))
          } else {
            URL.revokeObjectURL(video.src)
            resolve(frames)
          }
        }
        
        video.onerror = () => {
          URL.revokeObjectURL(video.src)
          reject(new Error('Failed to load video'))
        }
        
        // Start extracting frames
        extractFrame(interval)
      }
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src)
        reject(new Error('Failed to load video'))
      }
    })
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      onError('Please select a video file first')
      return
    }

    onAnalysisStart()

    try {
      // Extract frames from video
      const frames = await extractFrames(selectedFile, 5)
      
      const formData = new FormData()
      formData.append('video', selectedFile)
      // Send frames as JSON
      formData.append('frames', JSON.stringify(frames))

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Analysis failed')
      }

      const data = await response.json()
      onAnalysisComplete(data.analysis)
    } catch (error) {
      onError(
        error instanceof Error ? error.message : 'Failed to analyze video'
      )
    }
  }

  const handleClear = () => {
    setSelectedFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Card className="glass-effect sleek-shadow border-gray-800">
      <CardHeader>
        <CardTitle className="text-white">Upload Video</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-800 rounded-lg p-6 text-center hover:border-gray-700 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
            id="video-upload"
            disabled={isAnalyzing}
          />
          <label
            htmlFor="video-upload"
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
              {selectedFile ? selectedFile.name : 'Click to upload video'}
            </span>
            <span className="mt-1 block text-xs text-gray-400">
              MP4, AVI, MOV, or other video formats
            </span>
          </label>
        </div>

        {previewUrl && (
          <div className="relative">
            <video
              src={previewUrl}
              controls
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
            {isAnalyzing ? 'Analyzing...' : 'Analyze Video'}
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
