# XUUG - CCTV Reliability Audits Powered by Grok

XUUG is a full-stack application for analyzing CCTV video reliability, detecting coverage gaps, and providing AI-powered recommendations using Grok Vision API.

## Features

- **Reliability Analysis**: Upload videos to analyze coverage reliability, occlusion, dwell time, and blur
- **Live Stream Analysis**: Real-time analysis of live camera feeds
- **AI-Powered Insights**: Grok Vision API provides contextual analysis and recommendations
- **ROI Customization**: Draw custom regions of interest for critical zones
- **Homography Calibration**: Optional calibration for ground-plane mapping

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: FastAPI, Python, OpenCV, YOLOv8n
- **AI**: Grok Vision API (xAI)
- **Visualization**: Recharts, Canvas API

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- Grok API key from [x.ai](https://x.ai/api)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/5kash/grokathon.git
   cd grokathon
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Set up Python backend** (optional - app works without it)
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cd ..
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and add your Grok API key:
   ```
   GROK_API_KEY=your_actual_api_key_here
   ANALYSIS_BACKEND_URL=http://localhost:8000  # Optional
   ```

### Running the Application

**Option 1: Start both frontend and backend** (recommended)
```bash
npm run start:all
```

**Option 2: Start separately**
```bash
# Terminal 1: Backend
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## Project Structure

```
Grokathon/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── analyze/       # General video analysis
│   │   ├── analyze-live/  # Live stream analysis
│   │   ├── analyze-reliability/  # Reliability audit
│   │   └── calibrate-homography/  # Homography calibration
│   ├── live/              # Live stream page
│   ├── upload/             # Upload video page
│   └── page.tsx           # Homepage
├── backend/               # FastAPI backend
│   ├── main.py            # Main API server
│   ├── modules/           # Python modules
│   │   ├── coverage_metrics.py
│   │   ├── homography.py
│   │   ├── motion_detector.py
│   │   └── rtsp_handler.py
│   └── requirements.txt   # Python dependencies
├── components/            # React components
│   ├── ReliabilityResults.tsx
│   ├── VideoUploaderReliability.tsx
│   ├── LiveStreamAnalyzer.tsx
│   └── ui/                # shadcn/ui components
└── lib/                   # Utilities
```

## Environment Variables

See `.env.example` for all available environment variables:

- `ANALYSIS_BACKEND_URL`: FastAPI backend URL (optional)
- `GROK_API_KEY`: Your Grok API key (required)
- `GROK_API_URL`: Grok API endpoint (optional, defaults to https://api.x.ai/v1)
- `GROK_MODEL`: Grok model to use (optional, defaults to grok-4)

## Usage

1. **Upload Video Analysis**: 
   - Go to `/upload`
   - Upload an MP4 video (5-20s recommended, max 50MB)
   - Optionally draw ROI (4 points)
   - Adjust FPS slider (1-10, default 5)
   - Click "Run Audit"

2. **Live Stream Analysis**:
   - Go to `/live`
   - Connect webcam or IP camera
   - View real-time Grok analysis

3. **Homography Calibration** (Optional):
   - Go to `/upload` → "Calibration" tab
   - Upload a reference image
   - Click 4 points to map to real-world coordinates

## API Endpoints

### Frontend API Routes (Next.js)
- `POST /api/analyze-reliability` - Analyze video reliability
- `POST /api/analyze-live` - Analyze live stream frame
- `POST /api/analyze` - General video analysis
- `POST /api/calibrate-homography` - Calibrate homography matrix

### Backend API Routes (FastAPI)
- `POST /analyze-reliability` - YOLO-based reliability analysis
- `POST /calibrate-homography` - Calculate homography matrix
- `GET /health` - Health check

## Development

- Frontend runs on port 3000 (Next.js dev server)
- Backend runs on port 8000 (FastAPI/uvicorn)
- Hot reload enabled for both

## Notes

- The app works **without the backend** using mock processing
- Backend provides real YOLO person detection for more accurate results
- Grok API key is required for AI insights
- Video files are processed in-memory (not saved to disk)

## License

MIT
