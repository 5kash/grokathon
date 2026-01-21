#!/bin/bash

# Start both frontend and backend

echo "🚀 Starting XUUG application..."
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo "✅ Backend stopped"
    fi
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT SIGTERM

# Start backend in background
echo "🐍 Starting Python backend on port 8000..."
cd backend
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Please run: cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

source venv/bin/activate
# Use full path to uvicorn to ensure it works in background
./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
echo "⏳ Waiting for backend to start..."
sleep 3

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Backend failed to start"
    exit 1
fi

echo "✅ Backend started (PID: $BACKEND_PID)"
echo ""

# Start frontend
echo "⚛️  Starting Next.js frontend on port 3000..."
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8000"
echo ""
npm run dev

# When frontend stops, cleanup
cleanup
