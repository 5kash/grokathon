import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60 // 1 minute for live analysis

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const frameBase64 = formData.get('frame') as string
    const timestamp = formData.get('timestamp') as string

    if (!frameBase64) {
      return NextResponse.json(
        { error: 'No frame provided' },
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

    // Prepare the analysis prompt for live footage
    const analysisPrompt = `You are analyzing LIVE CCTV footage in real-time. This is a single frame from a continuous stream. Provide a concise but detailed analysis including:

1. **Current Scene**: What is visible in this frame right now?
2. **People/Objects**: Describe any people, vehicles, or objects currently visible
3. **Activity**: What activity or movement is happening?
4. **Alerts**: Are there any concerning, suspicious, or unusual activities that require attention?
5. **Context**: How does this frame relate to typical CCTV monitoring?

Be specific and actionable. Focus on what's happening NOW in this live feed.`

    const grokApiUrl = process.env.GROK_API_URL || 'https://api.x.ai/v1'
    // Try grok-beta first, then fallback to grok-4-0709
    const modelName = process.env.GROK_MODEL || 'grok-beta'

    // Call Grok Vision API with the frame
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
            content: [
              {
                type: 'text',
                text: analysisPrompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${frameBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000, // Shorter for live analysis
        temperature: 0.3, // Lower temperature for more consistent live analysis
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Grok API error:', errorData)
      return NextResponse.json(
        { error: `Grok API error: ${response.statusText}. Details: ${errorData}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const analysis = data.choices?.[0]?.message?.content || 'No analysis available'

    return NextResponse.json({
      analysis,
      timestamp: timestamp || new Date().toISOString(),
    })
  } catch (error) {
    console.error('Live analysis error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to analyze frame',
      },
      { status: 500 }
    )
  }
}
