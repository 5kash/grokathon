'use client'

import { useEffect, useRef, useState } from 'react'

interface RotatingLinesBackgroundProps {
  className?: string
  intensity?: 'low' | 'medium' | 'high'
}

export default function RotatingLinesBackground({
  className = '',
  intensity = 'medium',
}: RotatingLinesBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const mousePosRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY }
      setMousePos({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener('mousemove', handleMouseMove)

    const lineCount = intensity === 'low' ? 8 : intensity === 'medium' ? 12 : 16
    let centerX = canvas.width / 2
    let centerY = canvas.height / 2
    let rotation = 0

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Smooth center point following mouse
      const targetX = mousePosRef.current.x || canvas.width / 2
      const targetY = mousePosRef.current.y || canvas.height / 2
      
      centerX += (targetX - centerX) * 0.08
      centerY += (targetY - centerY) * 0.08

      // Calculate rotation angle based on mouse position relative to center
      const dx = mousePosRef.current.x - centerX
      const dy = mousePosRef.current.y - centerY
      const targetRotation = Math.atan2(dy, dx) * (180 / Math.PI)
      
      // Smooth rotation interpolation
      let rotationDiff = targetRotation - rotation
      if (rotationDiff > 180) rotationDiff -= 360
      if (rotationDiff < -180) rotationDiff += 360
      rotation += rotationDiff * 0.15

      // Sleek dark theme colors - subtle white/gray lines
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.08)')
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.12)')
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0.08)')

      ctx.strokeStyle = gradient
      ctx.lineWidth = 1.5

      // Draw lines that rotate based on mouse position
      for (let i = 0; i < lineCount; i++) {
        const baseAngle = (360 / lineCount) * i
        const angle = (baseAngle + rotation) * (Math.PI / 180)
        
        // Calculate distance from center to mouse for dynamic length
        const mouseDistance = Math.sqrt(
          Math.pow(mousePosRef.current.x - centerX, 2) + 
          Math.pow(mousePosRef.current.y - centerY, 2)
        )
        
        const baseLength = 250 + (i % 4) * 100
        // Lines extend more when mouse is further from center
        const length = baseLength + (mouseDistance / 20)
        
        const x = centerX + Math.cos(angle) * length
        const y = centerY + Math.sin(angle) * length

        ctx.beginPath()
        ctx.moveTo(centerX, centerY)
        ctx.lineTo(x, y)
        ctx.stroke()
      }

      requestAnimationFrame(draw)
    }

    draw()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [intensity])

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none ${className}`}
      style={{ zIndex: 0 }}
    />
  )
}
