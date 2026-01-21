#!/bin/bash
# Startup script to set LD_LIBRARY_PATH and start uvicorn

# Find all Nix library directories and add to LD_LIBRARY_PATH
NIX_LIBS=$(find /nix/store -type d -name lib 2>/dev/null | head -20 | tr '\n' ':' | sed 's/:$//')

# Set LD_LIBRARY_PATH with /usr/lib (for symlinks) and Nix store paths
export LD_LIBRARY_PATH="/usr/lib:${NIX_LIBS}:${LD_LIBRARY_PATH}"

# Debug: print LD_LIBRARY_PATH
echo "LD_LIBRARY_PATH=${LD_LIBRARY_PATH}" >&2

# Check if libGL exists
if [ -f "/usr/lib/libGL.so.1" ]; then
    echo "Found libGL.so.1 at /usr/lib/libGL.so.1" >&2
elif [ -n "$(find /nix/store -name 'libGL.so.1' 2>/dev/null | head -1)" ]; then
    GL_LIB=$(find /nix/store -name 'libGL.so.1' 2>/dev/null | head -1)
    echo "Found libGL.so.1 at ${GL_LIB}" >&2
    export LD_LIBRARY_PATH="${GL_LIB%/*}:${LD_LIBRARY_PATH}"
else
    echo "WARNING: libGL.so.1 not found!" >&2
fi

# Use Python from venv or system
if [ -f "/opt/venv/bin/python" ]; then
    PYTHON="/opt/venv/bin/python"
    echo "Using venv Python: ${PYTHON}" >&2
else
    PYTHON="python"
    echo "Using system Python: ${PYTHON}" >&2
fi

# Start uvicorn
exec ${PYTHON} -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
