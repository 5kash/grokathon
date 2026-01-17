'use client'

import { useState } from 'react'
import Link from 'next/link'
import LiveStreamAnalyzer from '@/components/LiveStreamAnalyzer'
import AnalysisResults from '@/components/AnalysisResults'
import RotatingLinesBackground from '@/components/RotatingLinesBackground'

export default function LivePage() {
  const [analysisResult, setAnalysisResult] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysisTimestamp, setAnalysisTimestamp] = useState<Date | null>(null)

  const handleLiveAnalysisUpdate = (result: string, timestamp: Date) => {
    setAnalysisResult(result)
    setAnalysisTimestamp(timestamp)
    setIsAnalyzing(false)
    setError(null)
  }

  const handleError = (errorMessage: string) => {
    setError(errorMessage)
    setIsAnalyzing(false)
  }

  return (
    <main className="min-h-screen bg-black relative overflow-hidden">
      <RotatingLinesBackground intensity="medium" />
      
      {/* Navigation Header */}
      <div className="relative z-20 pt-8 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex items-center justify-between mb-12">
          <Link 
            href="/"
            className="text-2xl md:text-3xl font-bold text-white futuristic-glow"
          >
            XUUG
          </Link>
          <div className="flex items-center gap-6 md:gap-8">
            <Link 
              href="/live"
              className="text-base md:text-lg text-white border-b-2 border-white pb-1"
            >
              Live Stream
            </Link>
            <Link 
              href="/upload"
              className="text-base md:text-lg text-gray-400 hover:text-white transition-colors duration-300 border-b-2 border-transparent hover:border-white pb-1"
            >
              Upload Video
            </Link>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="relative z-10 px-6 md:px-12 pb-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <LiveStreamAnalyzer
                onAnalysisUpdate={handleLiveAnalysisUpdate}
                onError={handleError}
                isStreaming={isStreaming}
                onStreamingChange={setIsStreaming}
              />
            </div>

            <div className="space-y-6">
              <AnalysisResults
                result={analysisResult}
                isAnalyzing={isAnalyzing || isStreaming}
                error={error}
                isLive={isStreaming}
                timestamp={analysisTimestamp || undefined}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
