"""
Motion Detection Module
Extracted/adapted from: PhazerTech/yolo-rtsp-security-cam

Minimal motion detection to skip frames with no activity.
Reduces processing load by only analyzing frames with motion.
"""
import cv2
import numpy as np
from typing import Tuple, Optional

class MotionDetector:
    """
    Simple motion detector using frame differencing.
    """
    def __init__(self, threshold: float = 30.0, min_area: int = 500):
        """
        Args:
            threshold: Pixel difference threshold for motion
            min_area: Minimum area of motion to consider significant
        """
        self.threshold = threshold
        self.min_area = min_area
        self.previous_frame: Optional[np.ndarray] = None
    
    def has_motion(self, frame: np.ndarray) -> Tuple[bool, float]:
        """
        Check if frame has significant motion compared to previous frame.
        
        Args:
            frame: Current frame (BGR)
            
        Returns:
            (has_motion: bool, motion_score: float)
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)
        
        if self.previous_frame is None:
            self.previous_frame = gray
            return False, 0.0
        
        # Calculate frame difference
        frame_delta = cv2.absdiff(self.previous_frame, gray)
        thresh = cv2.threshold(frame_delta, self.threshold, 255, cv2.THRESH_BINARY)[1]
        thresh = cv2.dilate(thresh, None, iterations=2)
        
        # Find contours
        contours, _ = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Check for significant motion
        motion_area = 0
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > self.min_area:
                motion_area += area
        
        # Update previous frame
        self.previous_frame = gray
        
        # Motion score: percentage of frame with motion
        frame_area = frame.shape[0] * frame.shape[1]
        motion_score = (motion_area / frame_area) * 100 if frame_area > 0 else 0.0
        
        has_motion = motion_area > 0
        
        return has_motion, motion_score
    
    def reset(self):
        """Reset motion detector (clear previous frame)."""
        self.previous_frame = None
