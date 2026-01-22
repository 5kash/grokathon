import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300 // 300 seconds (5 minutes) - Vercel Pro allows up to 300s for video processing

// Types
interface ReliabilityResponse {
  reliability_label: 'RELIABLE' | 'NOT RELIABLE'
  reliability_score: number
  why: string
  action: string
  grok_insights?: string // Optional AI-powered insights from Grok
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
    roi_source?: 'AUTO' | 'USER' // Whether ROI was auto-generated or user-drawn
  }
  overlay_image?: string // base64 PNG with ROI + boxes drawn
  overlay_image_base64?: string // Alternative field name for overlay image
  alert_frame?: string // base64 PNG of frame at flip_at_s
  frame_data?: {
    // Frame at flip_at_s for thumbnail
    timestamp: number
    person_boxes: Array<{ x1: number; y1: number; x2: number; y2: number }>
  }
  all_frames?: Array<{
    // All frames with person boxes for overlay
    timestamp: number
    person_boxes: Array<{ x1: number; y1: number; x2: number; y2: number }>
    occlusion_pct: number
  }>
}

// Default Region of Interest (full screen) - [x1, y1, x2, y2] as percentage
const DEFAULT_ROI: [number, number, number, number] = [0, 0, 1, 1]

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log('[Reliability API] Request started at', new Date().toISOString())
  
  try {
    // Check for RTSP URL in query params (for live stream simulation)
    const url = new URL(request.url)
    const rtspUrl = url.searchParams.get('rtsp_url')
    
    // Check if FastAPI backend is configured
    const backendUrl = process.env.ANALYSIS_BACKEND_URL
    
    if (backendUrl) {
      // Proxy to FastAPI backend for real YOLO analysis
      console.log(`[Reliability API] Proxying to backend: ${backendUrl}`)
      
      try {
        const formData = await request.formData()
        const videoFile = formData.get('video') as File
        
        if (!videoFile) {
          return NextResponse.json(
            { error: 'No video file provided' },
            { status: 400 }
          )
        }
        
        // Create new FormData for backend
        const backendFormData = new FormData()
        backendFormData.append('video', videoFile)
        
        const fpsParam = formData.get('fps')
        const roiParam = formData.get('roi')
        const roiSource = roiParam ? 'USER' : 'AUTO' // Track ROI source
        if (fpsParam) {
          backendFormData.append('fps', fpsParam as string)
        }
        if (roiParam) {
          backendFormData.append('roi', roiParam as string)
        }
        
        // Forward to FastAPI backend with extended timeout
        // Backend video processing can take 30-60 seconds
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minute timeout
        
        try {
          const backendResponse = await fetch(`${backendUrl}/analyze-reliability`, {
            method: 'POST',
            body: backendFormData,
            signal: controller.signal,
            // Don't set timeout header - let it use the signal timeout
          })
          
          clearTimeout(timeoutId)
        
        if (!backendResponse.ok) {
          const errorData = await backendResponse.text()
          console.error('[Reliability API] Backend error:', errorData)
          return NextResponse.json(
            { error: `Backend analysis failed: ${errorData}` },
            { status: backendResponse.status }
          )
        }
        
          const data = await backendResponse.json()
          const elapsed = Date.now() - startTime
          console.log(`[Reliability API] Backend processing completed in ${elapsed}ms`)
          console.log('[Reliability API] Backend response keys:', Object.keys(data))
        console.log('[Reliability API] Has overlay_image:', !!data.overlay_image)
        console.log('[Reliability API] Has alert_frame:', !!data.alert_frame)
        
        // Track ROI source (USER if ROI was provided, AUTO otherwise)
        if (!data.debug) {
          data.debug = {}
        }
        if (!data.debug.roi_source) {
          data.debug.roi_source = roiSource
        }
        
        // Enhance with Grok AI insights if available
        const grokApiKey = process.env.GROK_API_KEY
        if (grokApiKey) {
          try {
            console.log('[Reliability API] Attempting Grok AI enhancement with backend data...')
            
            // Use alert_frame if available (most relevant), otherwise overlay_image, otherwise metrics-only
            const frameToAnalyze = data.alert_frame || data.overlay_image
            const hasFrame = !!frameToAnalyze
            
            const grokPrompt = hasFrame
              ? data.reliability_label === 'RELIABLE'
                ? `Analyze this CCTV frame showing a Region of Interest (red rectangle) with detected persons (green boxes). Metrics: Occlusion avg ${data.signals.occlusion_pct_avg}%, max ${data.signals.occlusion_pct_max}%, dwell max ${data.signals.dwell_s_max}s, blur avg ${data.signals.blur_score_avg}, reliability ${data.reliability_score}/100.

This zone is RELIABLE. Explain in one sentence why the coverage is adequate and trustworthy based on what you see in the frame.

Then provide maintenance recommendations. Examples: "Continue monitoring with current setup" or "Consider periodic calibration checks" or "Maintain current camera positioning".`
                : `Analyze this CCTV frame showing a Region of Interest (red rectangle) with detected persons (green boxes). Metrics: Occlusion avg ${data.signals.occlusion_pct_avg}%, max ${data.signals.occlusion_pct_max}%, dwell max ${data.signals.dwell_s_max}s, blur avg ${data.signals.blur_score_avg}, reliability ${data.reliability_score}/100.

This zone is NOT RELIABLE. First, explain in one sentence why this zone is unreliable.

Then, analyze the frame visually: Where are the blind spots? Where are people being detected? What's the camera angle? Based on what you see, provide a SPECIFIC camera placement recommendation. Examples: "Add camera at top-left corner pointing down at 45° angle" or "Install overhead camera 3 meters above the ROI center" or "Position second camera opposite side of room at eye level". Be specific about location and angle.`
              : data.reliability_label === 'RELIABLE'
                ? `CCTV reliability audit: Occlusion avg ${data.signals.occlusion_pct_avg}%, max ${data.signals.occlusion_pct_max}%, dwell max ${data.signals.dwell_s_max}s, blur avg ${data.signals.blur_score_avg}, reliability ${data.reliability_score}/100.

This zone is RELIABLE. Explain in one sentence why the coverage is adequate and trustworthy.

Then provide maintenance recommendations. Examples: "Continue monitoring with current setup" or "Consider periodic calibration checks" or "Maintain current camera positioning".`
                : `CCTV reliability audit: Occlusion avg ${data.signals.occlusion_pct_avg}%, max ${data.signals.occlusion_pct_max}%, dwell max ${data.signals.dwell_s_max}s, blur avg ${data.signals.blur_score_avg}, reliability ${data.reliability_score}/100.

This zone is NOT RELIABLE. Explain in one sentence why this zone is unreliable.

Then provide a SPECIFIC camera placement recommendation based on the occlusion patterns. Examples: "Add camera opposite the Region of Interest at 3m height" or "Install overhead camera above the Region of Interest" or "Position second camera at left edge pointing right". Be specific about location and angle.`

            const grokApiUrl = process.env.GROK_API_URL || 'https://api.x.ai/v1'
            const modelName = process.env.GROK_MODEL || 'grok-4'
            
            const grokRequestBody: any = {
              model: modelName,
              messages: [
                {
                  role: 'user',
                  content: hasFrame
                    ? [
                        {
                          type: 'text',
                          text: grokPrompt,
                        },
                        {
                          type: 'image_url',
                          image_url: {
                            url: `data:image/png;base64,${frameToAnalyze}`,
                          },
                        },
                      ]
                    : grokPrompt,
                },
              ],
              max_tokens: 800, // Increased for more detailed analysis
              temperature: 0.7,
            }
            
            console.log(`[Reliability API] Calling Grok API: ${grokApiUrl} with model: ${modelName}, hasFrame: ${hasFrame}`)
            
            const grokResponse = await fetch(`${grokApiUrl}/chat/completions`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${grokApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(grokRequestBody),
            })
            
            if (grokResponse.ok) {
              const grokData = await grokResponse.json()
              const grokInsights = grokData.choices?.[0]?.message?.content || null
              if (grokInsights) {
                console.log('[Reliability API] Grok insights received:', grokInsights.substring(0, 100) + '...')
                data.grok_insights = grokInsights
                // Parse Grok response - extract detailed why and action
                // Try to find "why" section (first paragraph or sentences explaining the reliability)
                // Try to find "action" section (recommendations)
                
                // Split by double newlines (paragraphs) or single newlines
                const paragraphs = grokInsights.split(/\n\s*\n/).filter((p: string) => p.trim().length > 10)
                const lines = grokInsights.split(/\n/).filter((l: string) => l.trim().length > 10)
                
                // Look for "why" - usually first 1-2 sentences or first paragraph
                // For RELIABLE: explanation of why coverage is adequate
                // For NOT RELIABLE: explanation of why it's unreliable
                if (paragraphs.length > 0) {
                  // Use first paragraph as "why" (more detailed)
                  const firstPara = paragraphs[0].trim()
                  // Remove quotes if present
                  data.why = firstPara.replace(/^["']|["']$/g, '').replace(/\n/g, ' ').trim()
                  if (!data.why.match(/[.!?]$/)) {
                    data.why += '.'
                  }
                } else if (lines.length > 0) {
                  // Use first 2-3 sentences from first line
                  const firstLine = lines[0].trim()
                  const sentences = firstLine.match(/[^.!?]+[.!?]+/g) || []
                  if (sentences.length > 0) {
                    // Take first 2 sentences for more detail
                    data.why = sentences.slice(0, 2).join(' ').trim().replace(/^["']|["']$/g, '')
                  } else {
                    data.why = firstLine.replace(/^["']|["']$/g, '')
                  }
                }
                
                // Look for "action" - usually contains keywords like "add", "install", "recommend", etc.
                const actionKeywords = data.reliability_label === 'RELIABLE'
                  ? /(?:continue|monitor|maintain|calibration|periodic|setup|current|recommend|suggest)/i
                  : /(?:add|install|position|place|recommend|suggest|camera|overhead|opposite|angle|height|corner|edge|should|consider)/i
                
                let actionFound = false
                
                // Try to find action in paragraphs (usually second paragraph)
                if (paragraphs.length > 1) {
                  for (let i = 1; i < paragraphs.length; i++) {
                    if (actionKeywords.test(paragraphs[i])) {
                      data.action = paragraphs[i].trim().replace(/^["']|["']$/g, '').replace(/\n/g, ' ').trim()
                      if (!data.action.match(/[.!?]$/)) {
                        data.action += '.'
                      }
                      actionFound = true
                      break
                    }
                  }
                }
                
                // If not found in paragraphs, search in lines
                if (!actionFound && lines.length > 1) {
                  for (let i = 1; i < lines.length; i++) {
                    if (actionKeywords.test(lines[i])) {
                      // Take this line and potentially next line for more detail
                      const actionLines = [lines[i]]
                      if (i + 1 < lines.length && lines[i + 1].trim().length > 20) {
                        actionLines.push(lines[i + 1])
                      }
                      data.action = actionLines.join(' ').trim().replace(/^["']|["']$/g, '')
                      if (!data.action.match(/[.!?]$/)) {
                        data.action += '.'
                      }
                      actionFound = true
                      break
                    }
                  }
                }
                
                // Fallback: use remaining text after "why"
                if (!actionFound && paragraphs.length > 1) {
                  const remainingText = paragraphs.slice(1).join(' ').trim()
                  if (remainingText.length > 20) {
                    data.action = remainingText.replace(/^["']|["']$/g, '').replace(/\n/g, ' ').trim()
                    if (!data.action.match(/[.!?]$/)) {
                      data.action += '.'
                    }
                  }
                }
              } else {
                console.warn('[Reliability API] Grok response had no content')
              }
            } else {
              const errorText = await grokResponse.text()
              console.error('[Reliability API] Grok API error:', grokResponse.status, errorText)
            }
          } catch (grokError) {
            console.error('[Reliability API] Grok enhancement failed:', grokError)
            // Continue without Grok enhancement
          }
        } else {
          console.log('[Reliability API] Grok API key not found, skipping AI enhancement')
        }
        
        // Add overlay_image_base64 if available
        if (data.overlay_image) {
          data.overlay_image_base64 = data.overlay_image
        }
        
        // Add roi_source if not present (for backend responses)
        if (!data.debug.roi_source) {
          data.debug.roi_source = 'AUTO' // Default to AUTO if not specified
        }
        
          return NextResponse.json(data)
        } catch (fetchError) {
          clearTimeout(timeoutId)
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            console.error('[Reliability API] Backend request timed out after 2 minutes')
            return NextResponse.json(
              { error: 'Backend processing timed out. The video analysis is taking too long. Please try a shorter video or lower FPS.' },
              { status: 504 }
            )
          }
          throw fetchError // Re-throw to be caught by outer catch
        }
      } catch (proxyError) {
        console.error('[Reliability API] Backend connection failed:', proxyError)
        console.warn('[Reliability API] Backend connection failed, falling back to mock processing:', proxyError)
        // Fall through to mock processing instead of erroring
      }
    }
    
    // Fallback to mock processing (backend not configured or connection failed)
    console.log('[Reliability API] Using mock processing (backend not available)')
    
    // For mock processing, we don't need the actual file content
    // Just get metadata to avoid Vercel's file buffering delay
    // This makes it instant like localhost
    
    // Try to get formData, but don't wait too long
    let formData: FormData | null = null
    let videoFile: File | null = null
    let fileSize = 0
      let fps = 5
      let roi: [number, number, number, number] = DEFAULT_ROI
      let roiSource: 'AUTO' | 'USER' = 'AUTO'
      
      try {
        const formDataPromise = request.formData()
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('FormData timeout')), 2000)
        )
        formData = await Promise.race([formDataPromise, timeoutPromise])
        videoFile = formData.get('video') as File
        
        if (videoFile) {
          fileSize = videoFile.size
          console.log('[Reliability API] Got file metadata:', videoFile.name, fileSize, 'bytes')
        }
        
        // Get parameters
        const fpsParam = formData.get('fps')
        const roiParam = formData.get('roi')
        fps = fpsParam ? Number(fpsParam) : 5
        
        if (roiParam) {
          try {
            const parsed = JSON.parse(roiParam as string)
            if (Array.isArray(parsed) && parsed.length === 4) {
              roi = parsed as [number, number, number, number]
              roiSource = 'USER' // User-drawn ROI
            }
          } catch (e) {
            console.warn('[Reliability API] Invalid ROI format, using default')
          }
        }
    } catch (formError) {
      // If formData parsing fails/times out, use default values for mock processing
      console.warn('[Reliability API] FormData parsing issue, using defaults:', formError)
      fileSize = 10 * 1024 * 1024 // Default 10MB for mock
    }
    
    if (!videoFile && fileSize === 0) {
      return NextResponse.json(
        { error: 'No video file provided' },
        { status: 400 }
      )
    }
    
    // Check file size (Vercel Pro: 50MB limit)
    if (fileSize > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Video file too large. Maximum 50MB.' },
        { status: 400 }
      )
    }
    
    // Don't read the file into memory - just use metadata for mock processing
    // This avoids memory issues on Vercel
    // For Vercel Hobby (10s timeout), we need to return quickly

    console.log(`[Reliability API] Parameters - fps: ${fps}, roi: ${roi}, fileSize: ${fileSize}`)
    console.log('[Reliability API] Starting mock processing (no file I/O)...')

    // TODO: For full implementation, use:
    // - ffmpeg-python or fluent-ffmpeg to extract frames
    // - ultralytics YOLOv8n for person detection
    // - opencv-python for blur detection and image processing
    // 
    // For Vercel serverless, consider:
    // 1. Using a separate backend service (e.g., Railway, Render)
    // 2. Using edge functions with WebAssembly
    // 3. Client-side processing with TensorFlow.js
    //
    // For MVP, we'll use mock processing with realistic calculations

    try {
      // Mock frame sampling (replace with actual ffmpeg extraction)
      // Estimate duration from file size (rough approximation: ~1MB per second for MP4)
      const estimatedDuration = Math.max(5, Math.min(20, fileSize / (1024 * 1024)))
      const videoDuration = estimatedDuration
      const sampledFrames = Math.ceil(videoDuration * fps)
      
      console.log(`[Reliability API] Estimated duration: ${videoDuration}s, frames: ${sampledFrames}`)
      
      // Mock person detection results per frame
      // Store frames with person boxes for overlay rendering
      const frames: Array<{
        timestamp: number
        personBoxes: Array<{ x1: number; y1: number; x2: number; y2: number }>
        blurScore: number
      }> = []

      for (let i = 0; i < sampledFrames; i++) {
        const timestamp = (i / fps)
        // Mock: random person boxes (would use YOLOv8n in production)
        // Make boxes more likely to intersect ROI for realistic occlusion
        const personBoxes: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
        
        // Simulate person detection - higher probability in ROI area
        const hasPerson = Math.random() > 0.4
        if (hasPerson) {
          const numPeople = Math.floor(Math.random() * 3) + 1
          for (let j = 0; j < numPeople; j++) {
            // Bias boxes toward ROI area (center-lower) for realistic occlusion
            const centerX = roi[0] + (roi[2] - roi[0]) * (0.3 + Math.random() * 0.4)
            const centerY = roi[1] + (roi[3] - roi[1]) * (0.2 + Math.random() * 0.6)
            const boxWidth = 0.1 + Math.random() * 0.15
            const boxHeight = 0.15 + Math.random() * 0.2
            
            personBoxes.push({
              x1: Math.max(0, centerX - boxWidth / 2),
              y1: Math.max(0, centerY - boxHeight / 2),
              x2: Math.min(1, centerX + boxWidth / 2),
              y2: Math.min(1, centerY + boxHeight / 2),
            })
          }
        }
        
        // Mock blur score (variance of Laplacian, normalized)
        const blurScore = 500 + Math.random() * 2000
        
        frames.push({ timestamp, personBoxes, blurScore })
      }

      // Calculate occlusion percentages using UNION area (no double counting)
      const occlusionPcts: number[] = []
      
      frames.forEach(frame => {
        const roiArea = (roi[2] - roi[0]) * (roi[3] - roi[1])
        if (roiArea <= 0) {
          occlusionPcts.push(0)
          return
        }
        
        // Calculate union of all person boxes intersecting with ROI
        // Use a simple approach: merge overlapping boxes into union rectangles
        const intersections: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
        
        frame.personBoxes.forEach(box => {
          // Calculate intersection of box with ROI
          const x1 = Math.max(box.x1, roi[0])
          const y1 = Math.max(box.y1, roi[1])
          const x2 = Math.min(box.x2, roi[2])
          const y2 = Math.min(box.y2, roi[3])
          
          if (x2 > x1 && y2 > y1) {
            intersections.push({ x1, y1, x2, y2 })
          }
        })
        
        // Calculate union area (simplified: merge overlapping boxes)
        // For MVP, we'll use a grid-based approach to avoid double counting
        let unionArea = 0
        if (intersections.length > 0) {
          // Simple union: if boxes overlap, merge them
          const merged: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
          
          intersections.forEach(intersection => {
            let mergedInto = false
            for (let i = 0; i < merged.length; i++) {
              const m = merged[i]
              // Check if intersection overlaps with merged box
              if (!(intersection.x2 < m.x1 || intersection.x1 > m.x2 || 
                    intersection.y2 < m.y1 || intersection.y1 > m.y2)) {
                // Merge: expand merged box to include intersection
                m.x1 = Math.min(m.x1, intersection.x1)
                m.y1 = Math.min(m.y1, intersection.y1)
                m.x2 = Math.max(m.x2, intersection.x2)
                m.y2 = Math.max(m.y2, intersection.y2)
                mergedInto = true
                break
              }
            }
            if (!mergedInto) {
              merged.push({ ...intersection })
            }
          })
          
          // Calculate total area of merged boxes
          unionArea = merged.reduce((sum, box) => {
            return sum + (box.x2 - box.x1) * (box.y2 - box.y1)
          }, 0)
        }
        
        // Clamp occlusion to 0-100%
        const occlusionPct = Math.min(100, Math.max(0, (unionArea / roiArea) * 100))
        occlusionPcts.push(occlusionPct)
      })

      const occlusionPctAvg = occlusionPcts.reduce((a, b) => a + b, 0) / occlusionPcts.length
      const occlusionPctMax = Math.max(...occlusionPcts)

      // Calculate dwell time (longest continuous seconds with occlusion > 10%)
      let dwellSMax = 0
      let currentDwell = 0
      
      occlusionPcts.forEach((pct, idx) => {
        if (pct > 10) {
          currentDwell += 1 / fps
          dwellSMax = Math.max(dwellSMax, currentDwell)
        } else {
          currentDwell = 0
        }
      })

      // Calculate blur score average
      const blurScoreAvg = frames.reduce((sum, f) => sum + f.blurScore, 0) / frames.length

      // Calculate flip_at_s (early alert): first time occlusion > 30% for at least 0.5s OR dwell > 2s
      let flipAtS = 0
      let occlusion30Duration = 0
      let cumulativeDwell = 0
      let alertFrameIndex = -1
      
      for (let i = 0; i < occlusionPcts.length; i++) {
        const frameTime = frames[i].timestamp
        
        // Check occlusion > 30% for 0.5s
        if (occlusionPcts[i] > 30) {
          occlusion30Duration += 1 / fps
          if (occlusion30Duration >= 0.5 && flipAtS === 0) {
            flipAtS = frameTime
            alertFrameIndex = i
          }
        } else {
          occlusion30Duration = 0
        }
        
        // Check dwell > 2s (occlusion > 10%)
        if (occlusionPcts[i] > 10) {
          cumulativeDwell += 1 / fps
          if (cumulativeDwell > 2 && flipAtS === 0) {
            flipAtS = frameTime
            alertFrameIndex = i
          }
        } else {
          cumulativeDwell = 0
        }
      }
      
      // Store alert frame data for thumbnail
      type AlertFrameData = { timestamp: number; personBoxes: Array<{ x1: number; y1: number; x2: number; y2: number }> }
      let alertFrameData: AlertFrameData | null = null
      
      if (alertFrameIndex >= 0 && alertFrameIndex < frames.length) {
        alertFrameData = {
          timestamp: frames[alertFrameIndex].timestamp,
          personBoxes: frames[alertFrameIndex].personBoxes,
        }
      }

      // Calculate standard_ai_alert_at_s (later threshold): dwell >= 4s OR occlusion > 60% for 2s
      let standardAiAlertAtS = 0
      cumulativeDwell = 0
      let occlusion60Duration = 0
      
      for (let i = 0; i < occlusionPcts.length; i++) {
        const frameTime = frames[i].timestamp
        
        // Check occlusion > 60% for 2s
        if (occlusionPcts[i] > 60) {
          occlusion60Duration += 1 / fps
          if (occlusion60Duration >= 2 && standardAiAlertAtS === 0) {
            standardAiAlertAtS = frameTime
          }
        } else {
          occlusion60Duration = 0
        }
        
        // Check dwell >= 4s
        if (occlusionPcts[i] > 10) {
          cumulativeDwell += 1 / fps
          if (cumulativeDwell >= 4 && standardAiAlertAtS === 0) {
            standardAiAlertAtS = frameTime
          }
        } else {
          cumulativeDwell = 0
        }
      }

      // Calculate reliability score
      // risk = 0.6*(occlusion_pct_max/100) + 0.3*min(dwell_s_max/5,1) + 0.1*blur_term
      // Normalize blur score: handle 0 case and normalize to [0,1]
      // Typical range: 0-5000, but 0 means very blurry, so we need to handle it
      const blurMax = 3000 // Maximum expected blur score
      const blurNormalized = blurScoreAvg > 0 
        ? Math.min(1, blurScoreAvg / blurMax) 
        : 0 // If 0, treat as maximum blur
      const blurTerm = 1 - blurNormalized // Invert: higher score = less blur
      
      const risk = 0.6 * (occlusionPctMax / 100) + 
                   0.3 * Math.min(dwellSMax / 5, 1) + 
                   0.1 * blurTerm
      // Clamp score to 0-100 (never negative)
      const reliabilityScore = Math.max(0, Math.min(100, Math.round(100 * (1 - risk))))
      const reliabilityLabel = reliabilityScore < 70 ? 'NOT RELIABLE' : 'RELIABLE'

      // Generate explanation and action
      // Try to enhance with Grok AI if available, otherwise use templated response
      let why = ''
      let action = ''
      let grokInsights: string | null = null
      
      // Only show occlusion if it's significant
      const occlusionText = occlusionPctMax > 5 
        ? `${Math.round(occlusionPctMax)}% occlusion` 
        : 'minimal occlusion'
      
      // Try to get Grok AI insights (optional enhancement)
      // Note: In mock mode, we use metrics-only analysis
      // When backend is running, it provides actual frames which are used for richer analysis
      const grokApiKey = process.env.GROK_API_KEY
      if (grokApiKey) {
        try {
          console.log('[Reliability API] Attempting Grok AI enhancement...')
          // Use metrics-based analysis for mock mode
          // (Backend mode uses actual frames - see backend response handling above)
          const grokPrompt = reliabilityLabel === 'RELIABLE'
            ? `CCTV reliability audit: Occlusion avg ${Math.round(occlusionPctAvg)}%, max ${Math.round(occlusionPctMax)}%, dwell max ${dwellSMax.toFixed(1)}s, blur avg ${Math.round(blurScoreAvg)}, reliability ${reliabilityScore}/100.

This zone is RELIABLE. Explain in one sentence why the coverage is adequate and trustworthy.

Then provide maintenance recommendations. Examples: "Continue monitoring with current setup" or "Consider periodic calibration checks" or "Maintain current camera positioning".`
            : `CCTV reliability audit: Occlusion avg ${Math.round(occlusionPctAvg)}%, max ${Math.round(occlusionPctMax)}%, dwell max ${dwellSMax.toFixed(1)}s, blur avg ${Math.round(blurScoreAvg)}, reliability ${reliabilityScore}/100.

This zone is NOT RELIABLE. Explain in one sentence why this zone is unreliable.

Then provide a SPECIFIC camera placement recommendation based on the occlusion patterns. Examples: "Add camera opposite the Region of Interest at 3m height" or "Install overhead camera above the Region of Interest" or "Position second camera at left edge pointing right". Be specific about location and angle.`

          const grokApiUrl = process.env.GROK_API_URL || 'https://api.x.ai/v1'
          const modelName = process.env.GROK_MODEL || 'grok-4'
          
          console.log(`[Reliability API] Calling Grok API: ${grokApiUrl} with model: ${modelName}`)
          
          const grokResponse = await fetch(`${grokApiUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${grokApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: modelName,
              messages: [
                {
                  role: 'user',
                  content: grokPrompt,
                },
              ],
              max_tokens: 800, // Increased for more detailed analysis
              temperature: 0.7,
            }),
          })
          
          if (grokResponse.ok) {
            const grokData = await grokResponse.json()
            grokInsights = grokData.choices?.[0]?.message?.content || null
            
            if (grokInsights) {
              console.log('[Reliability API] Grok insights received:', grokInsights.substring(0, 100) + '...')
              // Parse Grok response - extract detailed why and action (same logic as backend mode)
              const paragraphs = grokInsights.split(/\n\s*\n/).filter((p: string) => p.trim().length > 10)
              const lines = grokInsights.split(/\n/).filter((l: string) => l.trim().length > 10)
              
              // Extract "why" - first paragraph or first 2 sentences
              if (paragraphs.length > 0) {
                const firstPara = paragraphs[0].trim()
                why = firstPara.replace(/^["']|["']$/g, '').replace(/\n/g, ' ').trim()
                if (!why.match(/[.!?]$/)) {
                  why += '.'
                }
              } else if (lines.length > 0) {
                const firstLine = lines[0].trim()
                const sentences = firstLine.match(/[^.!?]+[.!?]+/g) || []
                if (sentences.length > 0) {
                  why = sentences.slice(0, 2).join(' ').trim().replace(/^["']|["']$/g, '')
                } else {
                  why = firstLine.replace(/^["']|["']$/g, '')
                }
              }
              
              // Extract "action" - look for recommendation keywords
              const actionKeywords = reliabilityLabel === 'RELIABLE'
                ? /(?:continue|monitor|maintain|calibration|periodic|setup|current|recommend|suggest)/i
                : /(?:add|install|position|place|recommend|suggest|camera|overhead|opposite|angle|height|corner|edge|should|consider)/i
              
              let actionFound = false
              
              if (paragraphs.length > 1) {
                for (let i = 1; i < paragraphs.length; i++) {
                  if (actionKeywords.test(paragraphs[i])) {
                    action = paragraphs[i].trim().replace(/^["']|["']$/g, '').replace(/\n/g, ' ').trim()
                    if (!action.match(/[.!?]$/)) {
                      action += '.'
                    }
                    actionFound = true
                    break
                  }
                }
              }
              
              if (!actionFound && lines.length > 1) {
                for (let i = 1; i < lines.length; i++) {
                  if (actionKeywords.test(lines[i])) {
                    const actionLines = [lines[i]]
                    if (i + 1 < lines.length && lines[i + 1].trim().length > 20) {
                      actionLines.push(lines[i + 1])
                    }
                    action = actionLines.join(' ').trim().replace(/^["']|["']$/g, '')
                    if (!action.match(/[.!?]$/)) {
                      action += '.'
                    }
                    actionFound = true
                    break
                  }
                }
              }
              
              if (!actionFound && paragraphs.length > 1) {
                const remainingText = paragraphs.slice(1).join(' ').trim()
                if (remainingText.length > 20) {
                  action = remainingText.replace(/^["']|["']$/g, '').replace(/\n/g, ' ').trim()
                  if (!action.match(/[.!?]$/)) {
                    action += '.'
                  }
                }
              }
            } else {
              console.warn('[Reliability API] Grok response had no content')
            }
          } else {
            const errorText = await grokResponse.text()
            console.error('[Reliability API] Grok API error:', grokResponse.status, errorText)
          }
        } catch (grokError) {
          console.error('[Reliability API] Grok enhancement failed:', grokError)
        }
      } else {
        console.log('[Reliability API] Grok API key not found, skipping AI enhancement')
      }
      
      // Fallback to templated response if Grok not available or failed
      if (!why) {
        if (reliabilityLabel === 'RELIABLE') {
          why = `Coverage is adequate with ${occlusionText} and low dwell time, providing reliable monitoring.`
        } else {
          why = `Single view with ${occlusionText} means this zone can't be verified independently.`
        }
      }
      if (!action) {
        if (reliabilityLabel === 'RELIABLE') {
          action = 'Continue monitoring with current setup. Consider periodic calibration checks.'
        } else {
          // More specific fallback based on occlusion level for NOT RELIABLE
          if (occlusionPctMax > 60) {
            action = 'Add second camera opposite the ROI to provide coverage overlap.'
          } else if (occlusionPctMax > 30) {
            action = 'Reposition camera or add overhead camera to reduce occlusion.'
          } else {
            action = 'Consider adding camera redundancy for Region of Interest coverage.'
          }
        }
      }

      // Store frame data for overlay rendering (frontend will draw)
      // In production: use opencv-python to generate base64 PNG with ROI + boxes
      const overlayImage = undefined // base64 PNG (would be generated server-side)
      
      // Store alert frame data for thumbnail rendering
      // Frontend will use this to show the frame at flip_at_s
      const alertFrame = undefined // base64 PNG (would be extracted at flip_at_s)
      
      // Prepare frame data for frontend
      let frameDataForResponse: { timestamp: number; person_boxes: Array<{ x1: number; y1: number; x2: number; y2: number }> } | undefined = undefined
      if (alertFrameData) {
        frameDataForResponse = {
          timestamp: alertFrameData.timestamp,
          person_boxes: alertFrameData.personBoxes,
        }
      }

      const response: ReliabilityResponse = {
        reliability_label: reliabilityLabel,
        reliability_score: reliabilityScore,
        why,
        action,
        ...(grokInsights ? { grok_insights: grokInsights } : {}),
        signals: {
          occlusion_pct_avg: Math.round(occlusionPctAvg * 10) / 10,
          occlusion_pct_max: Math.round(occlusionPctMax * 10) / 10,
          dwell_s_max: Math.round(dwellSMax * 10) / 10,
          blur_score_avg: Math.round(blurScoreAvg),
          redundancy: 0,
        },
        timestamps: {
          flip_at_s: Math.round(flipAtS * 10) / 10,
          standard_ai_alert_at_s: Math.round(standardAiAlertAtS * 10) / 10,
        },
        debug: {
          sampled_frames: sampledFrames,
          fps_used: fps,
          roi,
          roi_source: roiSource,
        },
        ...(overlayImage ? { overlay_image: overlayImage } : {}),
        ...(alertFrame ? { alert_frame: alertFrame } : {}),
        // Include frame data for frontend overlay rendering
        ...(frameDataForResponse ? { frame_data: frameDataForResponse } : {}),
        // Include all frames with occlusion data for overlay
        all_frames: frames.map((f, idx) => ({
          timestamp: f.timestamp,
          person_boxes: f.personBoxes,
          occlusion_pct: occlusionPcts[idx] || 0,
        })),
        // Add overlay_image_base64 (same as overlay_image for compatibility)
        ...(overlayImage ? { overlay_image_base64: overlayImage } : {}),
      }

      const elapsed = Date.now() - startTime
      console.log(`[Reliability API] Processing completed in ${elapsed}ms`)
      console.log(`[Reliability API] Response: ${JSON.stringify({ reliability_label: reliabilityLabel, reliability_score: reliabilityScore })}`)
      
      // Ensure response is sent immediately
      const jsonResponse = NextResponse.json(response)
      jsonResponse.headers.set('Cache-Control', 'no-cache')
      return jsonResponse
    } catch (processingError) {
      console.error('[Reliability API] Processing error:', processingError)
      throw processingError
    }
  } catch (error) {
    const elapsed = Date.now() - startTime
    console.error(`[Reliability API] Error after ${elapsed}ms:`, error)
    console.error('[Reliability API] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Reliability analysis failed: ${error.message}`
            : 'Failed to analyze video reliability',
      },
      { status: 500 }
    )
  }
}
