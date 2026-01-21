#!/bin/bash
# Startup script to set LD_LIBRARY_PATH and start uvicorn
# Ensure all output goes to stderr so Railway can capture it

set -e  # Exit on error
exec 2>&1  # Redirect stderr to stdout so Railway captures all output

echo "=== Starting backend ===" >&2
echo "Working directory: $(pwd)" >&2
echo "Python version: $(python --version 2>&1 || echo 'Python not found')" >&2

# Build LD_LIBRARY_PATH with all Nix library directories
LIB_PATHS=""

# Find and add libGL directory
GL_LIB=$(find /nix/store -name 'libGL.so.1' 2>/dev/null | head -1)
if [ -n "$GL_LIB" ]; then
    GL_DIR=$(dirname "$GL_LIB")
    LIB_PATHS="${GL_DIR}:${LIB_PATHS}"
    echo "Found libGL at: ${GL_DIR}" >&2
fi

# Find and add libglib directory  
GLIB_LIB=$(find /nix/store -name 'libglib-2.0.so.0' 2>/dev/null | head -1)
if [ -n "$GLIB_LIB" ]; then
    GLIB_DIR=$(dirname "$GLIB_LIB")
    LIB_PATHS="${GLIB_DIR}:${LIB_PATHS}"
    echo "Found libglib at: ${GLIB_DIR}" >&2
fi

# Find and add libGLU directory
GLU_LIB=$(find /nix/store -name 'libGLU.so.1' 2>/dev/null | head -1)
if [ -n "$GLU_LIB" ]; then
    GLU_DIR=$(dirname "$GLU_LIB")
    LIB_PATHS="${GLU_DIR}:${LIB_PATHS}"
    echo "Found libGLU at: ${GLU_DIR}" >&2
fi

# Find and add libstdc++ (C++ standard library needed by OpenCV)
# Also find gcc lib directory which contains libstdc++
STDCPP_LIB=$(find /nix/store -name 'libstdc++.so.6' 2>/dev/null | head -1)
if [ -n "$STDCPP_LIB" ]; then
    STDCPP_DIR=$(dirname "$STDCPP_LIB")
    LIB_PATHS="${STDCPP_DIR}:${LIB_PATHS}"
    echo "Found libstdc++.so.6 at: ${STDCPP_DIR}" >&2
fi

# Also add gcc lib directories (gcc provides libstdc++)
# Find all gcc-related lib directories
GCC_LIB_DIRS=$(find /nix/store -type d \( -path "*/gcc-*/lib" -o -path "*/gcc*/lib" -o -name "lib" -path "*/gcc*" \) 2>/dev/null | head -10)
for gcc_dir in $GCC_LIB_DIRS; do
    if [ -d "$gcc_dir" ] && [ -n "$(ls -A "$gcc_dir"/*.so* 2>/dev/null)" ]; then
        LIB_PATHS="${gcc_dir}:${LIB_PATHS}"
        echo "Added lib directory: ${gcc_dir}" >&2
    fi
done

# Also try to find libstdc++ directly and add its directory
STDCPP_DIRS=$(find /nix/store -name 'libstdc++.so.6' -o -name 'libstdc++.so' 2>/dev/null | xargs -I {} dirname {} | sort -u | head -5)
for stdcpp_dir in $STDCPP_DIRS; do
    if [ -n "$stdcpp_dir" ] && [ -d "$stdcpp_dir" ]; then
        LIB_PATHS="${stdcpp_dir}:${LIB_PATHS}"
        echo "Added libstdc++ directory: ${stdcpp_dir}" >&2
    fi
done

# Add /usr/lib if it has the libraries
if [ -f "/usr/lib/libGL.so.1" ] || [ -f "/usr/lib/libglib-2.0.so.0" ]; then
    LIB_PATHS="/usr/lib:${LIB_PATHS}"
    echo "Added /usr/lib to library path" >&2
fi

# Set LD_LIBRARY_PATH
export LD_LIBRARY_PATH="${LIB_PATHS}${LD_LIBRARY_PATH}"
echo "LD_LIBRARY_PATH=${LD_LIBRARY_PATH}" >&2

# Verify libGL can be found
if [ -n "$GL_LIB" ] && [ -f "$GL_LIB" ]; then
    echo "libGL.so.1 exists and is accessible" >&2
else
    echo "WARNING: libGL.so.1 not found or not accessible!" >&2
    # Try to find it again with full path
    find /nix/store -name 'libGL.so.1' 2>/dev/null | head -3 >&2
fi

# Use Python from venv
if [ -f "/opt/venv/bin/python" ]; then
    PYTHON="/opt/venv/bin/python"
else
    PYTHON="python"
fi

# Start uvicorn with explicit logging
echo "=== Starting uvicorn ===" >&2
echo "Python: ${PYTHON}" >&2
echo "Port: ${PORT:-8000}" >&2
echo "LD_LIBRARY_PATH: ${LD_LIBRARY_PATH}" >&2

# Export LD_LIBRARY_PATH so Python subprocesses can see it
export LD_LIBRARY_PATH

# Test Python import before starting
echo "Testing Python..." >&2
${PYTHON} -c "import sys; print(f'Python: {sys.version}')" 2>&1 || {
    echo "ERROR: Python test failed!" >&2
    exit 1
}

# Try importing cv2 to see the actual error
echo "Testing cv2 import with LD_LIBRARY_PATH=${LD_LIBRARY_PATH}..." >&2
${PYTHON} -c "
import os
import sys
os.environ['LD_LIBRARY_PATH'] = '${LD_LIBRARY_PATH}'
try:
    import cv2
    print('SUCCESS: cv2 imported successfully')
except Exception as e:
    print(f'ERROR: cv2 import failed: {e}', file=sys.stderr)
    import traceback
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)
" 2>&1 || {
    echo "ERROR: cv2 import test failed!" >&2
    echo "This is preventing startup. Check library paths above." >&2
    exit 1
}

echo "All tests passed, starting uvicorn..." >&2
exec ${PYTHON} -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --log-level info
