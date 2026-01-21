#!/bin/bash
# Startup script to set LD_LIBRARY_PATH and start uvicorn

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
GCC_LIB_DIRS=$(find /nix/store -type d -path "*/gcc-*/lib" 2>/dev/null | head -5)
for gcc_dir in $GCC_LIB_DIRS; do
    if [ -f "${gcc_dir}/libstdc++.so.6" ] || [ -f "${gcc_dir}/libstdc++.so" ]; then
        LIB_PATHS="${gcc_dir}:${LIB_PATHS}"
        echo "Added GCC lib directory: ${gcc_dir}" >&2
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

# Start uvicorn
echo "Starting uvicorn..." >&2
exec ${PYTHON} -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
