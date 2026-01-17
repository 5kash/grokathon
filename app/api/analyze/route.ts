import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const videoFile = formData.get('video') as File
    const framesData = formData.get('frames') as string | null

    if (!videoFile) {
      return NextResponse.json(
        { error: 'No video file provided' },
        { status: 400 }
      )
    }

    // Get Grok API key from environment
    const apiKey = process.env.GROK_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Grok API key not configured. Please set GROK_API_KEY in .env.local' },
        { status: 500 }
      )
    }

    // Grok Vision API works with images, not videos directly
    // We'll use the frames extracted client-side
    let frames: string[] = []
    
    if (framesData) {
      try {
        frames = JSON.parse(framesData)
      } catch (e) {
        console.error('Failed to parse frames:', e)
      }
    }
    
    if (frames.length === 0) {
      return NextResponse.json(
        { error: 'No frames extracted from video. Please try again.' },
        { status: 400 }
      )
    }
    
    // Prepare the analysis prompt
    const analysisPrompt = `You are analyzing CCTV footage. I'm providing you with ${frames.length} key frames extracted from the video at different timestamps. Based on these frames, provide a detailed analysis including:

1. **Summary of Activities**: What activities are observed across the frames?
2. **People/Objects Detected**: Describe any people, vehicles, or objects visible in the frames
3. **Timeline of Events**: Note any significant events or changes between frames
4. **Suspicious Activity**: Identify any unusual, suspicious, or concerning activities
5. **Recommendations**: Provide any recommendations or alerts if needed

Please analyze all frames and provide a comprehensive report.`

    const grokApiUrl = process.env.GROK_API_URL || 'https://api.x.ai/v1'
    // Grok Vision models: grok-beta, grok-4-0709, grok-4, or similar (check xAI docs)
    const modelName = process.env.GROK_MODEL || 'grok-beta'
    
    // Build content array with text prompt and all frames
    const content: any[] = [
      {
        type: 'text',
        text: analysisPrompt,
      },
    ]
    
    // Add all frames as images
    frames.forEach((frameBase64) => {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${frameBase64}`,
        },
      })
    })
    
    // Call Grok Vision API with extracted frames
    const response = await fetch(`${grokApiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'user',
            content: content,
          },
        ],
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Grok API error:', errorData)
      
      // If video doesn't work, suggest frame extraction
      if (response.status === 400 || response.status === 422) {
        return NextResponse.json(
          { 
            error: `Grok API doesn't support video directly. Please extract frames from the video first, or check Grok's API documentation for video support. Error: ${errorData}` 
          },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        { error: `Grok API error: ${response.statusText}. Details: ${errorData}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const analysis = data.choices?.[0]?.message?.content || 'No analysis available'

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to analyze video',
      },
      { status: 500 }
    )
  }
}
