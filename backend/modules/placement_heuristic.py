"""
Camera Placement Heuristic
Extracted/adapted from: Optimization_of_camera_placement

Minimal camera placement recommendation algorithm.
"""
from typing import List, Tuple, Dict
import math

def calculate_placement_score(
    camera_position: Tuple[float, float, float],  # (x, y, height)
    target_roi: Tuple[float, float, float, float],  # (x1, y1, x2, y2)
    existing_cameras: List[Tuple[float, float, float]] = None
) -> Dict[str, float]:
    """
    Calculate placement score for a camera position.
    
    Args:
        camera_position: Proposed camera position (x, y, height)
        target_roi: Target region of interest
        existing_cameras: List of existing camera positions
        
    Returns:
        Dictionary with score breakdown
    """
    if existing_cameras is None:
        existing_cameras = []
    
    # Calculate distance to ROI center
    roi_center_x = (target_roi[0] + target_roi[2]) / 2
    roi_center_y = (target_roi[1] + target_roi[3]) / 2
    
    distance = math.sqrt(
        (camera_position[0] - roi_center_x) ** 2 +
        (camera_position[1] - roi_center_y) ** 2
    )
    
    # Distance score (closer is better, but not too close)
    optimal_distance = 5.0  # meters
    distance_score = 1.0 / (1.0 + abs(distance - optimal_distance) / optimal_distance)
    
    # Height score (higher is generally better for coverage)
    optimal_height = 3.0  # meters
    height_score = 1.0 / (1.0 + abs(camera_position[2] - optimal_height) / optimal_height)
    
    # Redundancy score (overlap with existing cameras)
    redundancy_score = 0.0
    if existing_cameras:
        min_distance = min([
            math.sqrt(
                (camera_position[0] - cam[0]) ** 2 +
                (camera_position[1] - cam[1]) ** 2
            )
            for cam in existing_cameras
        ])
        # Some overlap is good, but not too much
        optimal_overlap = 3.0  # meters
        redundancy_score = 1.0 / (1.0 + abs(min_distance - optimal_overlap) / optimal_overlap)
    else:
        redundancy_score = 0.5  # Neutral if no existing cameras
    
    # Combined score
    total_score = (
        distance_score * 0.4 +
        height_score * 0.3 +
        redundancy_score * 0.3
    )
    
    return {
        "total_score": total_score,
        "distance_score": distance_score,
        "height_score": height_score,
        "redundancy_score": redundancy_score,
        "recommendation": "GOOD" if total_score > 0.7 else "FAIR" if total_score > 0.5 else "POOR"
    }

def recommend_placement(
    target_roi: Tuple[float, float, float, float],
    existing_cameras: List[Tuple[float, float, float]] = None,
    candidate_positions: List[Tuple[float, float, float]] = None
) -> List[Dict]:
    """
    Recommend best camera placement from candidate positions.
    
    Args:
        target_roi: Target region of interest
        existing_cameras: List of existing camera positions
        candidate_positions: List of candidate positions to evaluate
        
    Returns:
        List of scored positions, sorted by score (best first)
    """
    if candidate_positions is None:
        # Generate default candidates around ROI
        roi_center_x = (target_roi[0] + target_roi[2]) / 2
        roi_center_y = (target_roi[1] + target_roi[3]) / 2
        
        candidate_positions = [
            (roi_center_x - 5, roi_center_y, 3.0),
            (roi_center_x + 5, roi_center_y, 3.0),
            (roi_center_x, roi_center_y - 5, 3.0),
            (roi_center_x, roi_center_y + 5, 3.0),
            (roi_center_x, roi_center_y, 4.0),  # Higher position
        ]
    
    scored_positions = []
    for pos in candidate_positions:
        score_data = calculate_placement_score(pos, target_roi, existing_cameras)
        scored_positions.append({
            "position": pos,
            **score_data
        })
    
    # Sort by total score (best first)
    scored_positions.sort(key=lambda x: x["total_score"], reverse=True)
    
    return scored_positions
