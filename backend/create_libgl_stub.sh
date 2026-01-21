#!/bin/bash
# Create a minimal libGL stub if the real one isn't available
# This allows OpenCV to load even if libGL isn't fully functional

mkdir -p /usr/lib

# Create a minimal stub library that OpenCV can link against
cat > /tmp/libgl_stub.c << 'EOF'
#include <dlfcn.h>
void* glXGetProcAddress(const char* name) { return NULL; }
void* glXGetProcAddressARB(const char* name) { return NULL; }
void* glXGetProcAddressEXT(const char* name) { return NULL; }
EOF

# Try to compile the stub (if gcc is available)
if command -v gcc >/dev/null 2>&1; then
    gcc -shared -fPIC -o /usr/lib/libGL.so.1 /tmp/libgl_stub.c -ldl 2>/dev/null || true
fi

# If compilation failed or gcc not available, try to copy from Nix store
if [ ! -f "/usr/lib/libGL.so.1" ]; then
    GL_LIB=$(find /nix/store -name 'libGL.so.1' 2>/dev/null | head -1)
    if [ -n "$GL_LIB" ]; then
        cp "$GL_LIB" /usr/lib/libGL.so.1
    fi
fi
