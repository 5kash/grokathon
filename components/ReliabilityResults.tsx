'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, AlertTriangle, Eye, Shield, Clock, Sparkles, ChevronDown, ChevronUp, Download, Maximize2, X } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

interface ReliabilityData {
  reliability_label: 'RELIABLE' | 'NOT RELIABLE'
  reliability_score: number
  why: string
  action: string
  grok_insights?: string // AI-powered insights from Grok
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
  overlay_image?: string // base64 PNG with ROI + boxes drawn
  overlay_image_base64?: string // Alternative field name for overlay image
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
  const [loadingStep, setLoadingStep] = useState<'extracting' | 'detecting' | 'scoring'>('extracting')
  const [grokExpanded, setGrokExpanded] = useState(false)
  const [overlayZoomed, setOverlayZoomed] = useState(false)
  
  const handleJumpToAlert = () => {
    if (videoRef?.current && data?.timestamps.flip_at_s) {
      videoRef.current.currentTime = data.timestamps.flip_at_s
      videoRef.current.pause()
    }
  }
  
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

  // Debug: Log if Grok insights are present (must be before any conditional returns)
  React.useEffect(() => {
    if (data?.grok_insights) {
      console.log('[ReliabilityResults] Grok insights detected:', data.grok_insights.substring(0, 50) + '...')
    } else if (data) {
      console.log('[ReliabilityResults] No Grok insights in data')
    }
  }, [data?.grok_insights])

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

    // Draw occlusion shading (semi-transparent red overlay within ROI, clipped by occlusion percentage)
    if (frame.occlusion_pct > 0) {
      ctx.save()
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)' // red-500 with 40% opacity
      // Clip to show only the occluded portion (from bottom up)
      const occlusionHeight = (frame.occlusion_pct / 100) * roiHeight
      ctx.fillRect(roiX1, roiY2 - occlusionHeight, roiWidth, occlusionHeight)
      ctx.restore()
    }

    // Draw camera recommendation arrow if reliability is low
    const isReliable = data.reliability_label === 'RELIABLE'
    if (!isReliable && data.reliability_score < 70) {
      // Calculate recommended camera position: opposite side of ROI
      const roiCenterX = (roiX1 + roiX2) / 2
      const roiCenterY = (roiY1 + roiY2) / 2
      
      // Place arrow on opposite side of frame from ROI center
      // If ROI is on left side, recommend camera on right, and vice versa
      const arrowX = roiCenterX < w / 2 ? w * 0.85 : w * 0.15
      const arrowY = h * 0.2 // Top 20% of frame
      
      // Draw arrow pointing to ROI
      ctx.save()
      ctx.strokeStyle = '#fbbf24' // amber-400
      ctx.fillStyle = '#fbbf24'
      ctx.lineWidth = 3
      
      // Arrow line
      ctx.beginPath()
      ctx.moveTo(arrowX, arrowY)
      ctx.lineTo(roiCenterX, roiCenterY)
      ctx.stroke()
      
      // Arrowhead
      const angle = Math.atan2(roiCenterY - arrowY, roiCenterX - arrowX)
      const arrowLength = 20
      const arrowAngle = Math.PI / 6 // 30 degrees
      
      ctx.beginPath()
      ctx.moveTo(roiCenterX, roiCenterY)
      ctx.lineTo(
        roiCenterX - arrowLength * Math.cos(angle - arrowAngle),
        roiCenterY - arrowLength * Math.sin(angle - arrowAngle)
      )
      ctx.lineTo(
        roiCenterX - arrowLength * Math.cos(angle + arrowAngle),
        roiCenterY - arrowLength * Math.sin(angle + arrowAngle)
      )
      ctx.closePath()
      ctx.fill()
      
      // Draw label background
      const labelText = 'ADD CAMERA HERE'
      ctx.font = 'bold 16px sans-serif'
      const labelMetrics = ctx.measureText(labelText)
      const labelPadding = 8
      const labelX = arrowX - labelMetrics.width / 2
      const labelY = arrowY - 30
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)'
      ctx.fillRect(
        labelX - labelPadding,
        labelY - 20,
        labelMetrics.width + labelPadding * 2,
        24
      )
      
      // Draw label text
      ctx.fillStyle = '#fbbf24'
      ctx.fillText(labelText, labelX, labelY)
      
      ctx.restore()
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
    <>
      {/* Fullscreen Overlay Zoom Modal */}
      {overlayZoomed && (data.overlay_image || data.overlay_image_base64) && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setOverlayZoomed(false)}
        >
          <div className="relative max-w-7xl max-h-full">
            <img
              src={`data:image/png;base64,${data.overlay_image || data.overlay_image_base64}`}
              alt="ROI Overlay Fullscreen"
              className="max-w-full max-h-[90vh] object-contain"
            />
            <button
              onClick={() => setOverlayZoomed(false)}
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white rounded-full p-2"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
      
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
            {data.grok_insights && (
              <span className="ml-auto flex items-center gap-1 text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full border border-purple-500/30 animate-pulse">
                <Sparkles className="w-3 h-3" />
                AI
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Big Score Display with Recharts Gauge */}
            <div className="text-center relative">
              <div className="w-full max-w-xs mx-auto mb-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Score', value: Math.max(0, Math.min(100, data.reliability_score)), fill: isReliable ? '#4ade80' : '#ef4444' },
                        { name: 'Remaining', value: Math.max(0, 100 - data.reliability_score), fill: '#1f2937' }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      animationDuration={1000}
                    >
                      <Cell key="score" fill={isReliable ? '#4ade80' : '#ef4444'} />
                      <Cell key="remaining" fill="#1f2937" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginTop: '-200px', height: '200px' }}>
                  <div className={`font-bold text-4xl ${scoreColor} mb-1`}>
                    {Math.max(0, Math.min(100, data.reliability_score))}
                  </div>
                  <div className={`font-bold text-lg ${scoreColor}`}>
                    {data.reliability_label}
                  </div>
                </div>
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
                {data.overlay_image || data.overlay_image_base64 ? (
                  <div className="relative group cursor-pointer" onClick={() => setOverlayZoomed(true)}>
                    <img
                      src={`data:image/png;base64,${data.overlay_image || data.overlay_image_base64}`}
                      alt="ROI Overlay with Person Boxes"
                      className="w-full transition-transform group-hover:scale-105"
                    />
                    <div className="absolute top-2 right-2 bg-black/50 rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize2 className="w-4 h-4 text-white" />
                    </div>
                  </div>
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
            {data.grok_insights && (
              <span className="ml-auto flex items-center gap-1 text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full border border-purple-500/30">
                <Sparkles className="w-3 h-3" />
                AI Enhanced
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Why (one sentence max, styled as quote) */}
            <div className="border-l-4 border-gray-600 pl-4 py-2">
              <h4 className="text-gray-400 text-xs mb-2 uppercase tracking-wide">Why</h4>
              <p className="text-white text-sm italic">
                "{(() => {
                  const firstSentenceMatch = data.why.match(/^[^.!?]+[.!?]/)
                  return firstSentenceMatch ? firstSentenceMatch[0].trim() : data.why.split(/[.!?]/)[0] + '.'
                })()}"
              </p>
            </div>
            
            {/* Recommended Action (styled as quote) */}
            <div className="border-l-4 border-gray-600 pl-4 py-2">
              <h4 className="text-gray-400 text-xs mb-2 uppercase tracking-wide">Action</h4>
              <p className="text-white font-medium italic">"{data.action}"</p>
            </div>
            
            {/* Share Report Button */}
            <div className="pt-4 border-t border-gray-800">
              <Button
                onClick={() => {
                  const reportData = {
                    reliability_score: data.reliability_score,
                    reliability_label: data.reliability_label,
                    why: data.why,
                    action: data.action,
                    signals: data.signals,
                    timestamps: data.timestamps,
                    generated_at: new Date().toISOString()
                  }
                  
                  // Download as JSON
                  const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `xuug-report-${Date.now()}.json`
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                  URL.revokeObjectURL(url)
                }}
                className="w-full bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Share Report (JSON)
              </Button>
            </div>
            
            {/* Grok AI Insights Section (Expandable) */}
            {data.grok_insights && (
              <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg overflow-hidden">
                <button
                  onClick={() => setGrokExpanded(!grokExpanded)}
                  className="w-full flex items-center justify-between p-4 hover:bg-purple-500/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <h4 className="text-purple-400 text-sm font-semibold">Grok AI Analysis</h4>
                  </div>
                  {grokExpanded ? (
                    <ChevronUp className="w-4 h-4 text-purple-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-purple-400" />
                  )}
                </button>
                {grokExpanded && (
                  <div className="px-4 pb-4">
                    <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{data.grok_insights}</p>
                  </div>
                )}
              </div>
            )}
            
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
    </>
  )
}
