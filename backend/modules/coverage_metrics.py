"""
Coverage Metrics Module
Extracted/adapted from: AVSensorCoverage

Standardized coverage metric definitions and calculations.
"""
from typing import Dict, List, Tuple
from dataclasses import dataclass

@dataclass
class CoverageMetrics:
    """
    Standardized coverage metrics for camera reliability.
    """
    occlusion_pct_avg: float
    occlusion_pct_max: float
    dwell_s_max: float
    blur_score_avg: float
    redundancy: float  # 0-1, coverage overlap with other cameras
    coverage_score: float  # 0-100, overall coverage quality
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for API response."""
        return {
            "occlusion_pct_avg": self.occlusion_pct_avg,
            "occlusion_pct_max": self.occlusion_pct_max,
            "dwell_s_max": self.dwell_s_max,
            "blur_score_avg": self.blur_score_avg,
            "redundancy": self.redundancy,
            "coverage_score": self.coverage_score,
        }

def calculate_redundancy(
    camera1_coverage: List[Tuple[float, float]],  # List of (x, y) covered points
    camera2_coverage: List[Tuple[float, float]],
    roi_area: float
) -> float:
    """
    Calculate redundancy between two camera views.
    
    Args:
        camera1_coverage: Covered points from camera 1
        camera2_coverage: Covered points from camera 2
        roi_area: Total ROI area
        
    Returns:
        Redundancy score (0-1): 1 = full overlap, 0 = no overlap
    """
    if not camera1_coverage or not camera2_coverage:
        return 0.0
    
    # Simple overlap calculation (can be enhanced with proper geometric intersection)
    # For MVP: approximate overlap as intersection of coverage areas
    overlap_count = 0
    total_count = len(camera1_coverage)
    
    # Convert to sets for faster lookup (simplified - would need proper geometric intersection)
    camera2_set = set(camera2_coverage)
    for point in camera1_coverage:
        if point in camera2_set:
            overlap_count += 1
    
    if total_count == 0:
        return 0.0
    
    redundancy = overlap_count / total_count
    return min(1.0, max(0.0, redundancy))

def calculate_coverage_score(metrics: CoverageMetrics) -> float:
    """
    Calculate overall coverage score from metrics.
    
    Args:
        metrics: CoverageMetrics object
        
    Returns:
        Coverage score (0-100)
    """
    # Normalize occlusion_pct_max (0-100) to 0-1 before weighting
    # risk = 0.6*(occlusion_pct_max/100) + 0.3*min(dwell_s_max/5,1) + 0.1*blur_term
    occlusion_normalized = metrics.occlusion_pct_max / 100.0  # Normalize 0-100 to 0-1
    blur_term = max(0, 1 - (metrics.blur_score_avg / 3000))  # Normalize blur (lower = blurrier)
    
    risk = 0.6 * occlusion_normalized + \
           0.3 * min(metrics.dwell_s_max / 5.0, 1.0) + \
           0.1 * blur_term
    
    # Clamp score to 0-100 (never negative)
    score = max(0, min(100, 100 * (1 - risk)))
    
    return score
