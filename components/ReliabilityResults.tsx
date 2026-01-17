'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, AlertTriangle, Eye, Shield, Clock } from 'lucide-react'

interface ReliabilityData {
  reliability_label: 'RELIABLE' | 'NOT RELIABLE'
  reliability_score: number
  why: string
  action: string
  signals: {
    occlusion_pct_avg: number
    occlusion_pct_max: number
    dwell_s_max: number
    blur_score_avg: number
    redundancy: number
  }
  timestamps: {
    flip_at_s: number
    standard_ai_alert_at_s: number
    standard_not_triggered?: boolean
  }
  debug: {
    sampled_frames: number
    fps_used: number
    roi: [number, number, number, number]
  }
  overlay_image?: string
  alert_frame?: string // base64 PNG of frame at flip_at_s
  frame_data?: {
    timestamp: number
    person_boxes: Array<{ x1: number; y1: number; x2: number; y2: number }>
  }
  all_frames?: Array<{
    timestamp: number
    person_boxes: Array<{ x1: number; y1: number; x2: number; y2: number }>
    occlusion_pct: number
  }>
}

interface ReliabilityResultsProps {
  data: ReliabilityData | null
  isAnalyzing: boolean
  error: string | null
  videoUrl?: string
  videoRef?: React.RefObject<HTMLVideoElement>
}

export default function ReliabilityResults({
  data,
  isAnalyzing,
  error,
  videoUrl,
  videoRef,
}: ReliabilityResultsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  
  const handleJumpToAlert = () => {
    if (videoRef?.current && data?.timestamps.flip_at_s) {
      videoRef.current.currentTime = data.timestamps.flip_at_s
      videoRef.current.pause()
    }
  }
  const [loadingStep, setLoadingStep] = useState<'extracting' | 'detecting' | 'scoring'>('extracting')
  
  // Simulate loading steps (in real app, this would come from backend progress)
  React.useEffect(() => {
    if (isAnalyzing) {
      setLoadingStep('extracting')
      const timer1 = setTimeout(() => setLoadingStep('detecting'), 1000)
      const timer2 = setTimeout(() => setLoadingStep('scoring'), 2000)
      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
      }
    }
  }, [isAnalyzing])

  // Find nearest frame based on timestamp
  const findNearestFrame = useCallback((currentTime: number) => {
    if (!data?.all_frames || data.all_frames.length === 0) return null
    
    let nearest = data.all_frames[0]
    let minDiff = Math.abs(nearest.timestamp - currentTime)
    
    for (const frame of data.all_frames) {
      const diff = Math.abs(frame.timestamp - currentTime)
      if (diff < minDiff) {
        minDiff = diff
        nearest = frame
      }
    }
    
    return nearest
  }, [data?.all_frames])

  // Draw overlay on canvas
  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current
    const video = videoRef?.current
    if (!canvas || !video || !data?.all_frames || data.all_frames.length === 0) return

    // Sync canvas size with video display size
    const rect = video.getBoundingClientRect()
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width
      canvas.height = rect.height
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Find nearest frame
    const frame = findNearestFrame(video.currentTime)
    if (!frame) return

    const roi = data.debug.roi
    const w = canvas.width
    const h = canvas.height

    // Draw ROI rectangle (red border)
    const roiX1 = roi[0] * w
    const roiY1 = roi[1] * h
    const roiX2 = roi[2] * w
    const roiY2 = roi[3] * h
    const roiWidth = roiX2 - roiX1
    const roiHeight = roiY2 - roiY1

    ctx.strokeStyle = '#ef4444' // red-500
    ctx.lineWidth = 3
    ctx.strokeRect(roiX1, roiY1, roiWidth, roiHeight)

    // Draw ROI label background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    const labelText = 'CRITICAL ZONE (assumed safe)'
    ctx.font = 'bold 14px sans-serif'
    const labelMetrics = ctx.measureText(labelText)
    const labelHeight = 20
    const labelY = Math.max(roiY1 - 10, labelHeight + 10)
    ctx.fillRect(roiX1, labelY - labelHeight - 5, labelMetrics.width + 10, labelHeight + 10)
    ctx.fillStyle = '#ef4444'
    ctx.fillText(labelText, roiX1 + 5, labelY)

    // Draw person boxes (green)
    ctx.strokeStyle = '#4ade80' // green-400
    ctx.lineWidth = 2
    frame.person_boxes.forEach((box) => {
      const x1 = box.x1 * w
      const y1 = box.y1 * h
      const x2 = box.x2 * w
      const y2 = box.y2 * h
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
    })

    // Draw occlusion shading (semi-transparent red overlay within ROI)
    if (frame.occlusion_pct > 0) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)' // red-500 with 40% opacity
      ctx.fillRect(roiX1, roiY1, roiWidth, roiHeight)
    }
  }, [videoRef, data, findNearestFrame])

  // Sync canvas with video playback
  useEffect(() => {
    const video = videoRef?.current
    const canvas = canvasRef.current
    if (!video || !canvas || !data?.all_frames) return

    const handleTimeUpdate = () => {
      drawOverlay()
    }

    const handleResize = () => {
      drawOverlay()
    }

    // Use requestAnimationFrame for smooth updates
    const animate = () => {
      drawOverlay()
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    const handlePlay = () => {
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    const handlePause = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      drawOverlay() // Draw once when paused
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('loadedmetadata', drawOverlay)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    window.addEventListener('resize', handleResize)

    // Initial draw
    drawOverlay()

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', drawOverlay)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      window.removeEventListener('resize', handleResize)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [videoRef, data, drawOverlay])
  
  if (isAnalyzing) {
    const stepLabels = {
      extracting: 'Extracting frames...',
      detecting: 'Detecting persons...',
      scoring: 'Scoring reliability...'
    }
    return (
      <Card className="glass-effect sleek-shadow border-gray-800">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            <div className="space-y-2 text-center">
              <span className="text-white font-medium">{stepLabels[loadingStep]}</span>
              <div className="flex gap-2 justify-center">
                <div className={`h-2 w-2 rounded-full ${loadingStep === 'extracting' ? 'bg-white' : 'bg-gray-600'}`}></div>
                <div className={`h-2 w-2 rounded-full ${loadingStep === 'detecting' ? 'bg-white' : 'bg-gray-600'}`}></div>
                <div className={`h-2 w-2 rounded-full ${loadingStep === 'scoring' ? 'bg-white' : 'bg-gray-600'}`}></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="glass-effect sleek-shadow border-gray-800 border-red-500">
        <CardContent className="pt-6">
          <div className="flex items-center text-red-400">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="glass-effect sleek-shadow border-gray-800">
        <CardContent className="pt-6">
          <div className="text-center text-gray-400 py-12">
            Upload a video to see reliability audit results
          </div>
        </CardContent>
      </Card>
    )
  }

  const isReliable = data.reliability_label === 'RELIABLE'
  const scoreColor = isReliable ? 'text-green-400' : 'text-red-400'
  const scoreBgColor = isReliable ? 'bg-green-400/20' : 'bg-red-400/20'
  const hasEarlyAlert = data.timestamps.flip_at_s > 0
  const hasStandardAlert = data.timestamps.standard_ai_alert_at_s > 0
  const alertDifference = hasEarlyAlert && hasStandardAlert 
    ? (data.timestamps.standard_ai_alert_at_s - data.timestamps.flip_at_s).toFixed(1)
    : null

  return (
    <div className="space-y-6">
      {/* Card 1: Reliability Status (BIG) */}
      <Card className="glass-effect sleek-shadow border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2 text-xl">
            {isReliable ? (
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            ) : (
              <XCircle className="w-6 h-6 text-red-400" />
            )}
            Reliability Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Big Score Display */}
            <div className="text-center">
              <div className={`font-bold text-5xl ${scoreColor} mb-2`}>
                {Math.max(0, Math.min(100, data.reliability_score))}/100
              </div>
              <div className={`font-bold text-2xl ${scoreColor} mb-4`}>
                {data.reliability_label}
              </div>
              {/* Score Gauge */}
              <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${isReliable ? 'bg-green-400' : 'bg-red-400'}`}
                  style={{ width: `${Math.max(0, Math.min(100, data.reliability_score))}%` }}
                />
              </div>
            </div>
            
            {/* Early vs Standard Alert Times */}
            <div className="pt-4 border-t border-gray-800 space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-300">Early Alert (XUUG):</span>
                </div>
                <span className="text-green-400 font-bold">
                  {hasEarlyAlert ? `${data.timestamps.flip_at_s.toFixed(1)}s` : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span className="text-sm text-gray-300">Standard AI Alert:</span>
                </div>
                <span className="text-orange-400 font-bold">
                  {data.timestamps.standard_not_triggered 
                    ? `> clip length (not triggered)`
                    : hasStandardAlert 
                      ? `${data.timestamps.standard_ai_alert_at_s.toFixed(1)}s`
                      : 'N/A'}
                </span>
              </div>
              {alertDifference && parseFloat(alertDifference) > 0 && (
                <div className="text-xs text-green-400 text-center pt-2">
                  ⚡ {alertDifference}s faster detection
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Coverage Analysis */}
      <Card className="glass-effect sleek-shadow border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Coverage Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {videoUrl && (
              <div className="relative rounded-lg overflow-hidden border border-gray-700">
                {data.overlay_image ? (
                  <img
                    src={`data:image/png;base64,${data.overlay_image}`}
                    alt="ROI Overlay with Person Boxes"
                    className="w-full"
                  />
                ) : (
                  <div className="relative w-full aspect-video bg-gray-900">
                    <video
                      src={videoUrl}
                      className="w-full h-full object-contain"
                      controls={false}
                    />
                    {/* Draw ROI rectangle */}
                    <div
                      className="absolute border-2 border-red-500 bg-red-500/10"
                      style={{
                        left: `${data.debug.roi[0] * 100}%`,
                        top: `${data.debug.roi[1] * 100}%`,
                        width: `${(data.debug.roi[2] - data.debug.roi[0]) * 100}%`,
                        height: `${(data.debug.roi[3] - data.debug.roi[1]) * 100}%`,
                      }}
                    >
                      <div className="absolute -top-6 left-0 text-xs text-red-400 font-bold bg-black/80 px-2 py-1 rounded">
                        CRITICAL ZONE (assumed safe)
                      </div>
                    </div>
                    
                    {/* Draw person boxes and occluded area from frame data */}
                    {data.all_frames && data.all_frames.length > 0 && (() => {
                      // Use the frame with max occlusion for overlay
                      const maxOcclusionFrame = data.all_frames.reduce((max, f) => 
                        f.occlusion_pct > max.occlusion_pct ? f : max
                      )
                      
                      return (
                        <>
                          {/* Draw person bounding boxes */}
                          {maxOcclusionFrame.person_boxes.map((box, idx) => (
                            <div
                              key={idx}
                              className="absolute border-2 border-green-400 bg-green-400/20"
                              style={{
                                left: `${box.x1 * 100}%`,
                                top: `${box.y1 * 100}%`,
                                width: `${(box.x2 - box.x1) * 100}%`,
                                height: `${(box.y2 - box.y1) * 100}%`,
                              }}
                            />
                          ))}
                          
                          {/* Show occluded area within ROI (semi-transparent red overlay) */}
                          <div
                            className="absolute bg-red-500/40 pointer-events-none"
                            style={{
                              left: `${data.debug.roi[0] * 100}%`,
                              top: `${data.debug.roi[1] * 100}%`,
                              width: `${(data.debug.roi[2] - data.debug.roi[0]) * 100}%`,
                              height: `${(data.debug.roi[3] - data.debug.roi[1]) * 100}%`,
                              clipPath: `inset(${(1 - Math.min(100, maxOcclusionFrame.occlusion_pct) / 100) * 100}% 0 0 0)`,
                            }}
                          />
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>
            )}
            
            {/* Jump to Alert Button + Alert Frame Thumbnail */}
            {hasEarlyAlert && (
              <div className="space-y-3">
                <Button
                  onClick={handleJumpToAlert}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-white flex items-center justify-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  Jump to Alert ({data.timestamps.flip_at_s.toFixed(1)}s)
                </Button>
                
                {/* Alert Frame Thumbnail beside player */}
                {videoUrl && (
                  <div className="flex gap-4 items-start">
                    <div className="flex-1 relative">
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        controls
                        className="w-full rounded-lg"
                        style={{ maxHeight: '300px' }}
                      />
                      {/* Canvas overlay for real-time rendering */}
                      {data.all_frames && data.all_frames.length > 0 && (
                        <canvas
                          ref={canvasRef}
                          className="absolute top-0 left-0 w-full h-full pointer-events-none rounded-lg"
                          style={{ maxHeight: '300px', objectFit: 'contain' }}
                        />
                      )}
                    </div>
                    {data.alert_frame && (
                      <div className="w-48 aspect-video bg-gray-900 rounded-lg border border-gray-700 overflow-hidden flex-shrink-0">
                        <img
                          src={`data:image/png;base64,${data.alert_frame}`}
                          alt="Alert frame with ROI and person boxes"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                  </div>
                )}
                
                {!videoUrl && data.alert_frame && (
                  <div className="relative w-full max-w-xs aspect-video bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                    <img
                      src={`data:image/png;base64,${data.alert_frame}`}
                      alt="Alert frame with ROI and person boxes"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
              </div>
            )}
            
            {/* Legacy alert frame display (if no videoUrl) */}
            {hasEarlyAlert && !videoUrl && !data.alert_frame && data.frame_data && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>Alert Frame at {data.timestamps.flip_at_s.toFixed(1)}s</span>
                </div>
                <div className="relative w-full max-w-xs aspect-video bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
                  {data.frame_data ? (
                    <>
                      {/* Show video frame with overlay */}
                      {videoUrl && (
                        <video
                          src={videoUrl}
                          className="w-full h-full object-contain"
                          controls={false}
                          style={{ position: 'absolute', top: 0, left: 0 }}
                        />
                      )}
                      {/* Draw ROI */}
                      <div
                        className="absolute border-2 border-red-500 bg-red-500/10"
                        style={{
                          left: `${data.debug.roi[0] * 100}%`,
                          top: `${data.debug.roi[1] * 100}%`,
                          width: `${(data.debug.roi[2] - data.debug.roi[0]) * 100}%`,
                          height: `${(data.debug.roi[3] - data.debug.roi[1]) * 100}%`,
                        }}
                      />
                      {/* Draw person boxes at alert time */}
                      {data.frame_data.person_boxes.map((box, idx) => (
                        <div
                          key={idx}
                          className="absolute border-2 border-yellow-400 bg-yellow-400/30"
                          style={{
                            left: `${box.x1 * 100}%`,
                            top: `${box.y1 * 100}%`,
                            width: `${(box.x2 - box.x1) * 100}%`,
                            height: `${(box.y2 - box.y1) * 100}%`,
                          }}
                        />
                      ))}
                    </>
                  ) : null}
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Occlusion (avg):</span>
                <span className="text-white ml-2 font-semibold">
                  {Math.min(100, Math.max(0, data.signals.occlusion_pct_avg)).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-gray-400">Occlusion (max):</span>
                <span className="text-white ml-2 font-semibold">
                  {Math.min(100, Math.max(0, data.signals.occlusion_pct_max)).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-gray-400">Dwell time:</span>
                <span className="text-white ml-2 font-semibold">
                  {data.signals.dwell_s_max.toFixed(1)}s
                </span>
              </div>
              <div>
                <span className="text-gray-400">Blur score:</span>
                <span className="text-white ml-2 font-semibold">
                  {data.signals.blur_score_avg.toFixed(0)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Recommendations + Timing */}
      <Card className="glass-effect sleek-shadow border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Only show action here - no duplicate "why" */}
            <div>
              <h4 className="text-gray-400 text-sm mb-2">Recommended Action:</h4>
              <p className="text-white font-medium">{data.action}</p>
            </div>
            
            {/* Timing Comparison */}
            <div className="pt-4 border-t border-gray-800">
              <h4 className="text-gray-400 text-sm mb-3">Alert Timing:</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-gray-300">Early Alert (XUUG):</span>
                  </div>
                  <span className="text-green-400 font-bold">
                    {hasEarlyAlert ? `${data.timestamps.flip_at_s.toFixed(1)}s` : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-400" />
                    <span className="text-sm text-gray-300">Standard AI Alert:</span>
                  </div>
                  <span className="text-orange-400 font-bold">
                    {data.timestamps.standard_not_triggered 
                      ? `> clip length (not triggered)`
                      : hasStandardAlert 
                        ? `${data.timestamps.standard_ai_alert_at_s.toFixed(1)}s`
                        : 'not triggered in clip'}
                  </span>
                </div>
                {alertDifference && parseFloat(alertDifference) > 0 && (
                  <div className="text-xs text-gray-400 text-center pt-2">
                    ⚡ {alertDifference}s faster detection
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
