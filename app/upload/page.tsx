'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import VideoUploaderReliability from '@/components/VideoUploaderReliability'
import ReliabilityResults from '@/components/ReliabilityResults'
import HomographyCalibration from '@/components/HomographyCalibration'
import RotatingLinesBackground from '@/components/RotatingLinesBackground'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function UploadPage() {
  const [reliabilityData, setReliabilityData] = useState<any>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleAnalysisComplete = (data: any) => {
    setReliabilityData(data)
    setIsAnalyzing(false)
    setError(null)
  }

  const handleAnalysisStart = () => {
    setIsAnalyzing(true)
    setReliabilityData(null)
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
              className="text-base md:text-lg text-gray-400 hover:text-white transition-colors duration-300 border-b-2 border-transparent hover:border-white pb-1"
            >
              Live Stream
            </Link>
            <Link 
              href="/upload"
              className="text-base md:text-lg text-white border-b-2 border-white pb-1"
            >
              Upload Video
            </Link>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="relative z-10 px-6 md:px-12 pb-16">
        <div className="max-w-7xl mx-auto">
          <Tabs defaultValue="analysis" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-8 bg-gray-900 border-gray-800">
              <TabsTrigger value="analysis" className="data-[state=active]:bg-gray-800">
                Reliability Analysis
              </TabsTrigger>
              <TabsTrigger value="calibration" className="data-[state=active]:bg-gray-800">
                Calibration (Optional)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="analysis" className="space-y-8">
              {/* Top Section: Upload Controls */}
              <div className="max-w-4xl mx-auto">
                <VideoUploaderReliability
                  onAnalysisStart={handleAnalysisStart}
                  onAnalysisComplete={handleAnalysisComplete}
                  onError={handleError}
                  isAnalyzing={isAnalyzing}
                  onVideoUrlChange={setVideoUrl}
                  videoRef={videoRef}
                />
              </div>

              {/* Results Section: Better Grid Layout */}
              {reliabilityData && (
                <ReliabilityResults
                  data={reliabilityData}
                  isAnalyzing={isAnalyzing}
                  error={error}
                  videoUrl={videoUrl || undefined}
                  videoRef={videoRef}
                />
              )}
            </TabsContent>

            <TabsContent value="calibration" className="space-y-6">
              <div className="max-w-3xl mx-auto">
                <HomographyCalibration
                  onCalibrationComplete={(matrix) => {
                    console.log('Homography matrix:', matrix)
                    // Store homography matrix for later use in coverage polygon drawing
                  }}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  )
}
