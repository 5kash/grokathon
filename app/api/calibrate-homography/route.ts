import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const backendUrl = process.env.ANALYSIS_BACKEND_URL

    if (!backendUrl) {
      return NextResponse.json(
        { error: 'Backend not configured. Please set ANALYSIS_BACKEND_URL in .env.local (e.g., ANALYSIS_BACKEND_URL=http://localhost:8000) and restart the dev server.' },
        { status: 503 }
      )
    }

    // Get form data from request
    const formData = await request.formData()

    // Forward to FastAPI backend
    const backendResponse = await fetch(`${backendUrl}/calibrate-homography`, {
      method: 'POST',
      body: formData,
    })

    if (!backendResponse.ok) {
      let errorMessage = `Backend error: ${backendResponse.status}`
      try {
        const errorData = await backendResponse.json()
        errorMessage = errorData.error || errorMessage
      } catch {
        const errorText = await backendResponse.text()
        errorMessage = errorText || errorMessage
      }
      console.error('[Homography API] Backend error:', errorMessage)
      return NextResponse.json(
        { error: errorMessage },
        { status: backendResponse.status }
      )
    }

    const data = await backendResponse.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('[Homography API] Error:', error)
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to calibrate homography'
    
    // Provide helpful error message for connection errors
    if (errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { error: 'Cannot connect to backend. Make sure the backend is running on ' + (process.env.ANALYSIS_BACKEND_URL || 'localhost:8000') },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
