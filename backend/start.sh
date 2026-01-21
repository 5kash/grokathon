#!/bin/bash
# Startup script to set LD_LIBRARY_PATH and start uvicorn

# Find all Nix library directories and add to LD_LIBRARY_PATH
NIX_LIBS=$(find /nix/store -type d -name lib 2>/dev/null | tr '\n' ':' | sed 's/:$//')

# Set LD_LIBRARY_PATH with /usr/lib (for symlinks) and Nix store paths
export LD_LIBRARY_PATH="/usr/lib:${NIX_LIBS}:${LD_LIBRARY_PATH}"

# Activate venv if it exists
if [ -d "/opt/venv" ]; then
    source /opt/venv/bin/activate
fi

# Start uvicorn
exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
