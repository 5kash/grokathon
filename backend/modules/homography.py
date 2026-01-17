"""
Homography Calibration Module
Extracted/adapted from: homography-calibrator

Minimal homography matrix calculation for camera calibration.
"""
import cv2
import numpy as np
from typing import List, Tuple

def calculate_homography(
    source_points: List[Tuple[float, float]],  # Clicked points in image
    target_points: List[Tuple[float, float]]   # Target plane coordinates
) -> np.ndarray:
    """
    Calculate homography matrix H from source to target points.
    
    Args:
        source_points: List of (x, y) points in source image
        target_points: List of (x, y) points in target plane
        
    Returns:
        3x3 homography matrix H
    """
    if len(source_points) != len(target_points):
        raise ValueError("Source and target points must have same length")
    
    if len(source_points) < 4:
        raise ValueError("Need at least 4 point pairs for homography")
    
    # Convert to numpy arrays
    src_pts = np.array(source_points, dtype=np.float32)
    dst_pts = np.array(target_points, dtype=np.float32)
    
    # Calculate homography using OpenCV
    H, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
    
    # Check if homography calculation failed
    if H is None:
        raise ValueError("Could not calculate homography. Points may be collinear or invalid.")
    
    return H

def apply_homography(
    point: Tuple[float, float],
    H: np.ndarray
) -> Tuple[float, float]:
    """
    Transform a point using homography matrix.
    
    Args:
        point: (x, y) point to transform
        H: 3x3 homography matrix
        
    Returns:
        Transformed (x, y) point
    """
    x, y = point
    pt = np.array([[x, y]], dtype=np.float32).reshape(-1, 1, 2)
    transformed = cv2.perspectiveTransform(pt, H)
    return (float(transformed[0][0][0]), float(transformed[0][0][1]))

def validate_homography(H: np.ndarray) -> bool:
    """
    Validate that homography matrix is reasonable.
    
    Args:
        H: 3x3 homography matrix
        
    Returns:
        True if valid
    """
    if H is None or H.shape != (3, 3):
        return False
    
    # Check for NaN or Inf
    if np.any(np.isnan(H)) or np.any(np.isinf(H)):
        return False
    
    # Check determinant (should be non-zero)
    det = np.linalg.det(H)
    if abs(det) < 1e-6:
        return False
    
    return True
