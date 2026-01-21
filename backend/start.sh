#!/bin/bash
# Startup script to set LD_LIBRARY_PATH and start uvicorn

# Find libGL and add its directory to LD_LIBRARY_PATH
GL_LIB=$(find /nix/store -name 'libGL.so.1' 2>/dev/null | head -1)
if [ -n "$GL_LIB" ]; then
    GL_DIR=$(dirname "$GL_LIB")
    export LD_LIBRARY_PATH="${GL_DIR}:${LD_LIBRARY_PATH}"
    echo "Added libGL path: ${GL_DIR}" >&2
fi

# Also check /usr/lib for symlinks
if [ -f "/usr/lib/libGL.so.1" ]; then
    export LD_LIBRARY_PATH="/usr/lib:${LD_LIBRARY_PATH}"
    echo "Using /usr/lib/libGL.so.1" >&2
fi

# Find and add other OpenCV dependencies
for lib in libglib-2.0.so.0 libGLU.so.1; do
    LIB_PATH=$(find /nix/store -name "$lib" 2>/dev/null | head -1)
    if [ -n "$LIB_PATH" ]; then
        LIB_DIR=$(dirname "$LIB_PATH")
        export LD_LIBRARY_PATH="${LIB_DIR}:${LD_LIBRARY_PATH}"
    fi
done

# Use Python from venv
if [ -f "/opt/venv/bin/python" ]; then
    PYTHON="/opt/venv/bin/python"
else
    PYTHON="python"
fi

# Start uvicorn
exec ${PYTHON} -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
