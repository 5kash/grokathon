'use client'

import Link from 'next/link'
import RotatingLinesBackground from '@/components/RotatingLinesBackground'
import { Users, Eye, Shield } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen bg-black relative overflow-hidden">
      <RotatingLinesBackground intensity="medium" />
      
      {/* Hero Section - x.ai style */}
      <div className="relative z-10 pt-32 pb-32 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          {/* Main Heading */}
          <div className="text-center mb-20">
            <h1 className="text-7xl md:text-8xl font-bold text-white tracking-tight mb-12 futuristic-glow">
              XUUG
            </h1>
            <div className="text-lg md:text-xl text-gray-400 font-light">
              Powered by <span className="text-white">Grok</span>
            </div>
          </div>

          {/* Feature Boxes - x.ai style with titles inside */}
          <div className="text-center mb-24">
            <div className="grid md:grid-cols-3 gap-8 md:gap-12 max-w-6xl mx-auto">
              <div className="glass-effect rounded-xl p-8 border border-gray-800 hover:border-gray-700 transition-all duration-300 hover:scale-105 group">
                <div className="flex justify-center mb-6">
                  <Users className="w-16 h-16 text-white stroke-1 opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="text-xl md:text-2xl font-bold text-white mb-4 tracking-wider futuristic-glow">
                  DEMOCRATIZATION
                </div>
                <p className="text-gray-400 text-base md:text-lg font-light leading-relaxed">
                  CCTV trust audits for anyone.
                </p>
              </div>
              
              <div className="glass-effect rounded-xl p-8 border border-gray-800 hover:border-gray-700 transition-all duration-300 hover:scale-105 group">
                <div className="flex justify-center mb-6">
                  <Eye className="w-16 h-16 text-white stroke-1 opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="text-xl md:text-2xl font-bold text-white mb-4 tracking-wider futuristic-glow">
                  DETECTION
                </div>
                <p className="text-gray-400 text-base md:text-lg font-light leading-relaxed">
                  Detect when coverage becomes unreliable.
                </p>
              </div>
              
              <div className="glass-effect rounded-xl p-8 border border-gray-800 hover:border-gray-700 transition-all duration-300 hover:scale-105 group">
                <div className="flex justify-center mb-6">
                  <Shield className="w-16 h-16 text-white stroke-1 opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="text-xl md:text-2xl font-bold text-white mb-4 tracking-wider futuristic-glow">
                  PREVENTION
                </div>
                <p className="text-gray-400 text-base md:text-lg font-light leading-relaxed">
                  Fix weak coverage before it's exploited.
                </p>
              </div>
            </div>
          </div>

          {/* Trailer Video Embed */}
          <div className="mb-16 max-w-4xl mx-auto">
            <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-gray-800 glass-effect">
              {/* Video player */}
              <video
                className="w-full h-full object-cover"
                controls
                autoPlay
                loop
                muted
                playsInline
                onError={(e) => {
                  // Fallback to placeholder if video fails to load
                  const target = e.target as HTMLVideoElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              >
                <source src="/xuug_intro.mp4" type="video/mp4" />
              </video>
              {/* Fallback placeholder if video doesn't load */}
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900" style={{ display: 'none' }}>
                <div className="text-center">
                  <div className="text-8xl md:text-9xl font-bold text-white mb-4 futuristic-glow animate-pulse">
                    XUUG
                  </div>
                  <div className="text-xl md:text-2xl text-gray-400 font-light">
                    CCTV Reliability Audit Platform
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links - x.ai style */}
          <div className="flex items-center justify-center gap-8 md:gap-12 pt-16">
            <Link 
              href="/live"
              className="text-lg md:text-xl text-gray-400 hover:text-white transition-colors duration-300 border-b-2 border-transparent hover:border-white pb-2"
            >
              Live Stream
            </Link>
            <Link 
              href="/upload"
              className="text-lg md:text-xl text-gray-400 hover:text-white transition-colors duration-300 border-b-2 border-transparent hover:border-white pb-2"
            >
              Upload Video
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
