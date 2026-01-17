'use client'

interface RotatingLinesProps {
  className?: string
  intensity?: 'low' | 'medium' | 'high'
}

export default function RotatingLines({ 
  className = '', 
  intensity = 'medium' 
}: RotatingLinesProps) {
  const lineCount = intensity === 'low' ? 8 : intensity === 'medium' ? 12 : 16
  
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(59, 130, 246, 0.3)" />
            <stop offset="50%" stopColor="rgba(147, 51, 234, 0.3)" />
            <stop offset="100%" stopColor="rgba(59, 130, 246, 0.3)" />
          </linearGradient>
          <linearGradient id="lineGradientDark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(96, 165, 250, 0.2)" />
            <stop offset="50%" stopColor="rgba(167, 139, 250, 0.2)" />
            <stop offset="100%" stopColor="rgba(96, 165, 250, 0.2)" />
          </linearGradient>
        </defs>
        {Array.from({ length: lineCount }).map((_, i) => {
          const angle = (360 / lineCount) * i
          const delay = (i / lineCount) * 2
          const duration = 20 + (i % 3) * 5
          const length = 300 + (i % 4) * 100
          
          return (
            <g key={i}>
              <line
                x1="500"
                y1="500"
                x2={500 + length * Math.cos((angle * Math.PI) / 180)}
                y2={500 + length * Math.sin((angle * Math.PI) / 180)}
                stroke="url(#lineGradient)"
                strokeWidth="2"
                className="dark:hidden"
                style={{
                  transformOrigin: '500px 500px',
                  animation: `rotate-${i} ${duration}s linear infinite`,
                  animationDelay: `${delay}s`,
                }}
              />
              <line
                x1="500"
                y1="500"
                x2={500 + length * Math.cos((angle * Math.PI) / 180)}
                y2={500 + length * Math.sin((angle * Math.PI) / 180)}
                stroke="url(#lineGradientDark)"
                strokeWidth="2"
                className="hidden dark:block"
                style={{
                  transformOrigin: '500px 500px',
                  animation: `rotate-${i} ${duration}s linear infinite`,
                  animationDelay: `${delay}s`,
                }}
              />
            </g>
          )
        })}
      </svg>
      <style jsx>{`
        ${Array.from({ length: lineCount })
          .map(
            (_, i) => `
          @keyframes rotate-${i} {
            from {
              transform: rotate(${i * (360 / lineCount)}deg);
            }
            to {
              transform: rotate(${i * (360 / lineCount) + 360}deg);
            }
          }
        `
          )
          .join('')}
      `}</style>
    </div>
  )
}
