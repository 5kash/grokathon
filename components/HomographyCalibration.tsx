'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, X, CheckCircle2, AlertCircle } from 'lucide-react'

interface Point {
  x: number
  y: number
}

interface HomographyCalibrationProps {
  onCalibrationComplete?: (homographyMatrix: number[][]) => void
}

export default function HomographyCalibration({
  onCalibrationComplete,
}: HomographyCalibrationProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [clickedPoints, setClickedPoints] = useState<Point[]>([])
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [calibrationResult, setCalibrationResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      setClickedPoints([])
      setCalibrationResult(null)
      setError(null)
    } else {
      setError('Please select a valid image file')
    }
  }

  const drawImageOnCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img || !img.complete) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Calculate display size (max 800px width, maintain aspect ratio)
    const maxWidth = 800
    const scale = Math.min(1, maxWidth / img.naturalWidth)
    const displayWidth = img.naturalWidth * scale
    const displayHeight = img.naturalHeight * scale

    // Set canvas display size (CSS)
    canvas.style.width = `${displayWidth}px`
    canvas.style.height = `${displayHeight}px`

    // Set canvas internal size (for drawing)
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight

    // Draw image
    ctx.drawImage(img, 0, 0)

    // Draw clicked points
    clickedPoints.forEach((point, index) => {
      ctx.fillStyle = '#00ff00' // Green for source points
      ctx.beginPath()
      ctx.arc(point.x, point.y, 8, 0, 2 * Math.PI)
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()
      
      // Label
      ctx.fillStyle = '#ffffff'
      ctx.font = '16px Arial'
      ctx.fillText(`P${index + 1}`, point.x + 12, point.y - 12)
    })

    // Draw lines connecting points (if 4 points clicked)
    if (clickedPoints.length === 4) {
      ctx.strokeStyle = '#00ff00'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(clickedPoints[0].x, clickedPoints[0].y)
      for (let i = 1; i < clickedPoints.length; i++) {
        ctx.lineTo(clickedPoints[i].x, clickedPoints[i].y)
      }
      ctx.closePath()
      ctx.stroke()
    }
  }, [clickedPoints])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (clickedPoints.length >= 4) return // Only allow 4 points

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    setClickedPoints([...clickedPoints, { x, y }])
  }

  const handleImageLoad = () => {
    drawImageOnCanvas()
  }

  // Redraw when points change or image loads
  useEffect(() => {
    if (previewUrl && imageRef.current?.complete) {
      drawImageOnCanvas()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clickedPoints, previewUrl])

  const handleCalibrate = async () => {
    if (clickedPoints.length !== 4) {
      setError('Please click exactly 4 points on the image')
      return
    }

    if (!selectedFile) {
      setError('Please select an image first')
      return
    }

    setIsCalibrating(true)
    setError(null)

    try {
      // For now, use a simple target plane (e.g., 10m x 10m square)
      // In a real app, user could input these coordinates
      const defaultTargetPoints: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ]

      const formData = new FormData()
      formData.append('frame', selectedFile)
      // Convert {x, y} objects to [x, y] arrays for backend
      const sourcePointsArray = clickedPoints.map(p => [p.x, p.y])
      const targetPointsArray = defaultTargetPoints.map(p => [p.x, p.y])
      formData.append('source_points', JSON.stringify(sourcePointsArray))
      formData.append('target_points', JSON.stringify(targetPointsArray))

      // Always use Next.js API route (consistent with reliability analysis)
      // The API route will proxy to backend if ANALYSIS_BACKEND_URL is set
      const endpoint = '/api/calibrate-homography'
      
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = `Server error: ${response.status} ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      setCalibrationResult(data)
      onCalibrationComplete?.(data.homography_matrix)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calibration failed')
    } finally {
      setIsCalibrating(false)
    }
  }

  const handleClear = () => {
    setSelectedFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setClickedPoints([])
    setCalibrationResult(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }


  return (
    <Card className="glass-effect sleek-shadow border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Homography Calibration (Optional)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {!previewUrl ? (
            <div className="border-2 border-dashed border-gray-800 rounded-lg p-6 text-center hover:border-gray-700 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="calibration-image-upload"
              />
              <label
                htmlFor="calibration-image-upload"
                className="cursor-pointer block"
              >
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <span className="mt-2 block text-sm font-medium text-white">
                  Click to upload calibration frame
                </span>
                <span className="mt-1 block text-xs text-gray-400">
                  Upload a frame from your camera, then click 4 points on the ground plane
                </span>
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative border border-gray-700 rounded-lg overflow-hidden bg-gray-900">
                <img
                  ref={imageRef}
                  src={previewUrl}
                  alt="Calibration frame"
                  onLoad={handleImageLoad}
                  className="hidden"
                />
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  className="cursor-crosshair mx-auto block"
                  style={{ maxWidth: '100%', maxHeight: '500px' }}
                />
                <div className="absolute top-2 left-2 bg-black/80 text-white px-3 py-1 rounded text-sm">
                  Click 4 points on the ground plane ({clickedPoints.length}/4)
                </div>
              </div>

              {clickedPoints.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {clickedPoints.map((point, index) => (
                    <div
                      key={index}
                      className="bg-gray-800 text-white px-3 py-1 rounded text-sm flex items-center gap-2"
                    >
                      <span>P{index + 1}: ({Math.round(point.x)}, {Math.round(point.y)})</span>
                      <button
                        onClick={() => {
                          const newPoints = clickedPoints.filter((_, i) => i !== index)
                          setClickedPoints(newPoints)
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {clickedPoints.length === 4 && !calibrationResult && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">
                    Target plane: 10m × 10m square (0,0) to (10,10)
                  </p>
                  <Button
                    onClick={handleCalibrate}
                    disabled={isCalibrating}
                    className="w-full"
                  >
                    {isCalibrating ? 'Calibrating...' : 'Calculate Homography'}
                  </Button>
                </div>
              )}

              {calibrationResult && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-400 mb-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-semibold">Calibration Complete</span>
                  </div>
                  <p className="text-sm text-gray-300">
                    Homography matrix calculated successfully. You can now use ground-plane coordinates for coverage analysis.
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <Button
                onClick={handleClear}
                variant="outline"
                className="w-full"
              >
                Clear & Start Over
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
