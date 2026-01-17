// Shared TypeScript interfaces for XUUG

export interface ReliabilityResponse {
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

export interface GrokRequestBody {
  model: string
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string | Array<{
      type: 'text' | 'image_url'
      text?: string
      image_url?: {
        url: string
      }
    }>
  }>
  max_tokens?: number
  temperature?: number
}
