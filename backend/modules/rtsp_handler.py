"""
RTSP Stream Handler
Extracted/adapted from: PhazerTech/yolo-rtsp-security-cam

Minimal RTSP connection handler for live camera streams.
"""
import cv2
from typing import Optional, Tuple
import time

class RTSPHandler:
    """
    Simple RTSP stream handler for camera feeds.
    """
    def __init__(self, rtsp_url: str, reconnect_delay: int = 5):
        """
        Args:
            rtsp_url: RTSP stream URL (e.g., rtsp://user:pass@ip:port/stream)
            reconnect_delay: Seconds to wait before reconnecting on failure
        """
        self.rtsp_url = rtsp_url
        self.reconnect_delay = reconnect_delay
        self.cap: Optional[cv2.VideoCapture] = None
        self.last_frame_time = 0
    
    def connect(self) -> bool:
        """
        Connect to RTSP stream.
        
        Returns:
            True if connected successfully
        """
        try:
            self.cap = cv2.VideoCapture(self.rtsp_url)
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Reduce latency
            return self.cap.isOpened()
        except Exception as e:
            print(f"[RTSP] Connection error: {e}")
            return False
    
    def read_frame(self, timeout: float = 5.0) -> Optional[Tuple[float, any]]:
        """
        Read a frame from RTSP stream.
        
        Args:
            timeout: Maximum seconds to wait for frame
            
        Returns:
            (timestamp, frame) or None if failed
        """
        if self.cap is None or not self.cap.isOpened():
            if not self.connect():
                return None
        
        start_time = time.time()
        while time.time() - start_time < timeout:
            ret, frame = self.cap.read()
            if ret and frame is not None:
                timestamp = time.time()
                self.last_frame_time = timestamp
                return (timestamp, frame)
            time.sleep(0.1)
        
        # Reconnect if timeout
        print(f"[RTSP] Timeout reading frame, reconnecting...")
        self.disconnect()
        if self.connect():
            return self.read_frame(timeout)
        
        return None
    
    def disconnect(self):
        """Disconnect from RTSP stream."""
        if self.cap is not None:
            self.cap.release()
            self.cap = None
    
    def is_connected(self) -> bool:
        """Check if stream is connected."""
        return self.cap is not None and self.cap.isOpened()
