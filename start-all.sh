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

# Kill any existing process on port 8000
if lsof -ti:8000 > /dev/null 2>&1; then
    echo "⚠️  Port 8000 is in use. Killing existing process..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null
    sleep 1
fi

cd backend
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Creating it now..."
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    echo "✅ Virtual environment created and dependencies installed"
fi

# Check if venv python exists
if [ ! -f "venv/bin/python" ] && [ ! -f "venv/bin/python3" ]; then
    echo "❌ Virtual environment is broken. Recreating..."
    rm -rf venv
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
fi

# Use python from venv to run uvicorn (python -m is more reliable)
if [ -f "venv/bin/python" ]; then
    PYTHON_BIN="venv/bin/python"
elif [ -f "venv/bin/python3" ]; then
    PYTHON_BIN="venv/bin/python3"
else
    echo "❌ Python not found in venv"
    exit 1
fi

# Start uvicorn using python -m to avoid interpreter issues
# Run in a subshell with venv activated to ensure all paths work
(
    cd "$(pwd)"
    source venv/bin/activate
    $PYTHON_BIN -m uvicorn main:app --host 0.0.0.0 --port 8000
) > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
echo "⏳ Waiting for backend to start..."
sleep 5

# Check if backend is running and responding
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Backend process died. Check /tmp/backend.log for errors:"
    tail -20 /tmp/backend.log 2>/dev/null || echo "No log file found"
    exit 1
fi

# Verify backend is actually responding
if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "⚠️  Backend process running but not responding. Check /tmp/backend.log:"
    tail -20 /tmp/backend.log 2>/dev/null || echo "No log file found"
    echo "Waiting a bit more..."
    sleep 3
    if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "❌ Backend failed to start properly"
        exit 1
    fi
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
