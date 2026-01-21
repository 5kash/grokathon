from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
# Disable OpenGL/GUI features in OpenCV before import
os.environ['OPENCV_IO_ENABLE_OPENEXR'] = '0'
os.environ['OPENCV_IO_ENABLE_OPENEXR'] = '0'
# Try to prevent libGL loading
os.environ['QT_QPA_PLATFORM'] = 'offscreen'
import cv2
import numpy as np
import base64
import tempfile
import os
from pathlib import Path
from typing import Optional, List, Tuple, Dict
import json
import subprocess
import time

# Fix PyTorch 2.6 YOLO loading issue - MUST be before YOLO import
try:
    import torch
    # Patch torch.load for YOLO compatibility (PyTorch 2.6+)
    _original_load = torch.load
    def _patched_load(*args, **kwargs):
        if 'weights_only' not in kwargs:
            kwargs['weights_only'] = False
        return _original_load(*args, **kwargs)
    torch.load = _patched_load
except ImportError:
    pass

# Now import YOLO (after patching torch.load)
# Import YOLO lazily to avoid startup issues
try:
    from ultralytics import YOLO
except ImportError as e:
    print(f"[Backend] Warning: YOLO import failed: {e}. Some features may not work.")
    YOLO = None

# Import extracted modules
from modules.motion_detector import MotionDetector
from modules.coverage_metrics import CoverageMetrics, calculate_coverage_score

app = FastAPI(title="XAnalyzer Reliability Backend")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load YOLOv8n model lazily (only when needed)
# This avoids PyTorch 2.6 weights_only loading issues at startup
model = None

def get_model():
    """Lazy load YOLO model on first use."""
    global model
    if YOLO is None:
        raise ImportError("YOLO (ultralytics) is not available. Please install ultralytics package.")
    if model is None:
        print("[Backend] Loading YOLOv8n model...")
        # YOLO will auto-download yolov8n.pt if it doesn't exist
        model_path = 'yolov8n.pt'
        if not os.path.exists(model_path):
            print("[Backend] Model file not found, YOLO will download it automatically...")
        model = YOLO(model_path)
        print("[Backend] YOLOv8n model loaded successfully!")
    return model

# Default Region of Interest (full screen) - [x1, y1, x2, y2] as percentage
DEFAULT_ROI = [0, 0, 1, 1]

def extract_frames_ffmpeg(video_path: str, fps: float = 5) -> List[Tuple[float, np.ndarray]]:
    """
    Extract frames from video using OpenCV at specified fps.
    Returns list of (timestamp, frame) tuples.
    """
    frames = []
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {video_path}")
    
    video_fps = cap.get(cv2.CAP_PROP_FPS)
    if video_fps <= 0:
        video_fps = 30  # Default fallback
    
    frame_interval = max(1, int(video_fps / fps))
    frame_count = 0
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        if frame_count % frame_interval == 0:
            timestamp = frame_count / video_fps
            frames.append((timestamp, frame))
        
        frame_count += 1
    
    cap.release()
    
    if not frames:
        raise ValueError("No frames extracted from video")
    
    return frames

def calculate_blur_score(frame: np.ndarray) -> float:
    """
    Calculate blur score using variance of Laplacian.
    Higher value = sharper image.
    """
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    return laplacian_var

def calculate_union_area(boxes: List[Tuple[float, float, float, float]], roi: List[float], frame_shape: Tuple[int, int]) -> float:
    """
    Calculate union area of person boxes intersecting ROI using mask union.
    Creates ROI mask grid (200x200), fills person bbox ∩ ROI regions, calculates filled_pixels/total_pixels.
    Returns occlusion ratio (0-1). No double counting (union operation).
    """
    if not boxes:
        return 0.0
    
    h, w = frame_shape[:2]
    roi_x1, roi_y1, roi_x2, roi_y2 = roi[0] * w, roi[1] * h, roi[2] * w, roi[3] * h
    
    # Create ROI mask grid (200x200 for efficiency)
    grid_size = 200
    roi_width = roi_x2 - roi_x1
    roi_height = roi_y2 - roi_y1
    
    if roi_width <= 0 or roi_height <= 0:
        return 0.0
    
    # Scale factors for grid
    scale_x = grid_size / roi_width if roi_width > 0 else 1
    scale_y = grid_size / roi_height if roi_height > 0 else 1
    
    # Create union mask grid (all zeros initially)
    union_mask = np.zeros((grid_size, grid_size), dtype=np.uint8)
    
    for box in boxes:
        # Convert box to pixel coordinates
        x1, y1, x2, y2 = box[0] * w, box[1] * h, box[2] * w, box[3] * h
        
        # Find intersection with ROI
        intersect_x1 = max(x1, roi_x1)
        intersect_y1 = max(y1, roi_y1)
        intersect_x2 = min(x2, roi_x2)
        intersect_y2 = min(y2, roi_y2)
        
        if intersect_x2 > intersect_x1 and intersect_y2 > intersect_y1:
            # Convert to grid coordinates
            grid_x1 = int((intersect_x1 - roi_x1) * scale_x)
            grid_y1 = int((intersect_y1 - roi_y1) * scale_y)
            grid_x2 = int((intersect_x2 - roi_x1) * scale_x)
            grid_y2 = int((intersect_y2 - roi_y1) * scale_y)
            
            # Clamp to grid bounds
            grid_x1 = max(0, min(grid_x1, grid_size - 1))
            grid_y1 = max(0, min(grid_y1, grid_size - 1))
            grid_x2 = max(0, min(grid_x2, grid_size))
            grid_y2 = max(0, min(grid_y2, grid_size))
            
            # Fill union mask (no double counting - union operation)
            union_mask[grid_y1:grid_y2, grid_x1:grid_x2] = 1
    
    # Calculate occluded pixels (union area)
    filled_pixels = np.sum(union_mask > 0)
    total_pixels = grid_size * grid_size
    
    # Return occlusion ratio (0-1)
    occlusion_ratio = filled_pixels / total_pixels if total_pixels > 0 else 0.0
    return min(1.0, max(0.0, occlusion_ratio))

def calculate_box_overlap(box1: Tuple[float, float, float, float], box2: Tuple[float, float, float, float]) -> float:
    """
    Calculate IoU (Intersection over Union) between two normalized bounding boxes.
    Returns value between 0 and 1.
    """
    x1_1, y1_1, x2_1, y2_1 = box1
    x1_2, y1_2, x2_2, y2_2 = box2
    
    # Calculate intersection
    inter_x1 = max(x1_1, x1_2)
    inter_y1 = max(y1_1, y1_2)
    inter_x2 = min(x2_1, x2_2)
    inter_y2 = min(y2_1, y2_2)
    
    if inter_x2 <= inter_x1 or inter_y2 <= inter_y1:
        return 0.0
    
    inter_area = (inter_x2 - inter_x1) * (inter_y2 - inter_y1)
    
    # Calculate union
    box1_area = (x2_1 - x1_1) * (y2_1 - y1_1)
    box2_area = (x2_2 - x1_2) * (y2_2 - y1_2)
    union_area = box1_area + box2_area - inter_area
    
    if union_area <= 0:
        return 0.0
    
    return inter_area / union_area

def detect_persons(frame: np.ndarray) -> List[Tuple[float, float, float, float]]:
    """
    Detect persons in frame using YOLOv8n.
    Returns list of normalized bounding boxes [x1, y1, x2, y2] (0-1 range).
    """
    yolo_model = get_model()
    results = yolo_model(frame, classes=[0], verbose=False)  # class 0 = person
    boxes = []
    
    for result in results:
        for box in result.boxes:
            # Get normalized coordinates
            x1, y1, x2, y2 = box.xyxyn[0].cpu().numpy()
            boxes.append((float(x1), float(y1), float(x2), float(y2)))
    
    return boxes

def draw_overlay(frame: np.ndarray, roi: List[float], person_boxes: List[Tuple[float, float, float, float]], 
                 occlusion_pct: float = 0, dwell_max: float = 0, occlusion_max: float = 0,
                 reliability_score: int = 0, reliability_label: str = "RELIABLE") -> np.ndarray:
    """
    Draw ROI rectangle, person boxes, occlusion overlay, and text labels on frame.
    Returns frame with overlays.
    """
    h, w = frame.shape[:2]
    overlay = frame.copy()
    
    # Draw ROI rectangle
    roi_x1, roi_y1, roi_x2, roi_y2 = int(roi[0] * w), int(roi[1] * h), int(roi[2] * w), int(roi[3] * h)
    cv2.rectangle(overlay, (roi_x1, roi_y1), (roi_x2, roi_y2), (0, 0, 255), 3)
    
    # Add ROI label with background
    label = "REGION OF INTEREST (assumed safe)"
    font_scale = 0.7
    thickness = 2
    (text_width, text_height), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
    label_y = max(roi_y1 - 10, text_height + 10)
    cv2.rectangle(overlay, (roi_x1, label_y - text_height - 5), (roi_x1 + text_width + 10, label_y + 5), (0, 0, 0), -1)
    cv2.putText(overlay, label, (roi_x1 + 5, label_y), cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 255), thickness)
    
    # Draw person boxes (green with label)
    for i, box in enumerate(person_boxes):
        x1, y1, x2, y2 = int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        if x2 > x1 and y2 > y1:
            cv2.rectangle(overlay, (x1, y1), (x2, y2), (0, 255, 0), 2)
            # Add person label
            person_label = f"Person {i+1}"
            (p_text_width, p_text_height), _ = cv2.getTextSize(person_label, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)
            cv2.rectangle(overlay, (x1, y1 - p_text_height - 4), (x1 + p_text_width + 4, y1), (0, 255, 0), -1)
            cv2.putText(overlay, person_label, (x1 + 2, y1 - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1)
    
    # Draw occluded area inside ROI (union mask with semi-transparent red fill)
    if occlusion_pct > 0:
        # Create mask for person boxes within ROI
        roi_mask = np.zeros((h, w), dtype=np.uint8)
        cv2.rectangle(roi_mask, (roi_x1, roi_y1), (roi_x2, roi_y2), 255, -1)
        
        person_mask = np.zeros((h, w), dtype=np.uint8)
        for box in person_boxes:
            x1, y1, x2, y2 = int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            if x2 > x1 and y2 > y1:
                # Only draw intersection with ROI
                inter_x1, inter_y1 = max(roi_x1, x1), max(roi_y1, y1)
                inter_x2, inter_y2 = min(roi_x2, x2), min(roi_y2, y2)
                if inter_x2 > inter_x1 and inter_y2 > inter_y1:
                    cv2.rectangle(person_mask, (inter_x1, inter_y1), (inter_x2, inter_y2), 255, -1)
        
        # Get union of person boxes within ROI
        occluded_mask = cv2.bitwise_and(roi_mask, person_mask)
        
        # Apply semi-transparent red overlay to occluded area
        overlay[occluded_mask > 0] = (overlay[occluded_mask > 0] * 0.5 + np.array([0, 0, 255]) * 0.5).astype(np.uint8)
    
    # Add text labels at top-left corner (stacked)
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.7
    thickness = 2
    text_color = (255, 255, 255)  # White
    bg_color = (0, 0, 0)  # Black
    line_spacing = 35
    start_y = 30
    
    # 1. OCCLUSION MAX: XX%
    occlusion_text = f"OCCLUSION MAX: {occlusion_max:.1f}%"
    (occ_width, occ_height), _ = cv2.getTextSize(occlusion_text, font, font_scale, thickness)
    occl_y = start_y
    cv2.rectangle(overlay, (10, occl_y - occ_height - 5), (10 + occ_width + 10, occl_y + 5), bg_color, -1)
    cv2.putText(overlay, occlusion_text, (15, occl_y), font, font_scale, text_color, thickness, cv2.LINE_AA)
    
    # 2. DWELL MAX: Ys
    dwell_text = f"DWELL MAX: {dwell_max:.1f}s"
    (dwell_width, dwell_height), _ = cv2.getTextSize(dwell_text, font, font_scale, thickness)
    dwell_y = occl_y + line_spacing
    cv2.rectangle(overlay, (10, dwell_y - dwell_height - 5), (10 + dwell_width + 10, dwell_y + 5), bg_color, -1)
    cv2.putText(overlay, dwell_text, (15, dwell_y), font, font_scale, text_color, thickness, cv2.LINE_AA)
    
    # 3. RELIABILITY: NN/100
    if reliability_score is not None:
        reliability_text = f"RELIABILITY: {reliability_score}/100"
        (rel_width, rel_height), _ = cv2.getTextSize(reliability_text, font, font_scale, thickness)
        rel_y = dwell_y + line_spacing
        # Color based on reliability: green if >= 70, red if < 70
        rel_color = (0, 255, 0) if reliability_score >= 70 else (0, 0, 255)  # Green or Red
        cv2.rectangle(overlay, (10, rel_y - rel_height - 5), (10 + rel_width + 10, rel_y + 5), bg_color, -1)
        cv2.putText(overlay, reliability_text, (15, rel_y), font, font_scale, rel_color, thickness, cv2.LINE_AA)
    
    return overlay

def frame_to_base64(frame: np.ndarray) -> str:
    """Convert OpenCV frame to base64 PNG string."""
    _, buffer = cv2.imencode('.png', frame)
    return base64.b64encode(buffer).decode('utf-8')

@app.post("/analyze-reliability")
async def analyze_reliability(
    video: Optional[UploadFile] = File(None),
    rtsp_url: Optional[str] = Form(None),
    fps: Optional[float] = Form(5),
    roi: Optional[str] = Form(None),
    mode: Optional[str] = Form("upload"),  # "upload" or "live_sim"
    rtsp_duration: Optional[float] = Form(10.0)  # Seconds to capture from RTSP
):
    """
    Analyze video reliability using YOLOv8n person detection.
    
    Supports:
    - Video file upload (multipart)
    - RTSP stream URL (for live cameras)
    """
    try:
        # Validate input: either video file or RTSP URL required
        if not video and not rtsp_url:
            return JSONResponse(
                {"error": "Either 'video' file or 'rtsp_url' must be provided"},
                status_code=400
            )
        
        if video and rtsp_url:
            return JSONResponse(
                {"error": "Provide either 'video' file OR 'rtsp_url', not both"},
                status_code=400
            )
        
        # Parse ROI
        roi_coords = DEFAULT_ROI
        if roi:
            roi_coords = json.loads(roi)
            if not isinstance(roi_coords, list) or len(roi_coords) != 4:
                roi_coords = DEFAULT_ROI
        
        # A) INGEST: Handle video upload or RTSP stream
        video_path = None
        frames_data: List[Tuple[float, np.ndarray]] = []
        
        if video:
            # Video file upload
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp_file:
                content = await video.read()
                tmp_file.write(content)
                video_path = tmp_file.name
            
            # Extract frames from uploaded video
            frames_data = extract_frames_ffmpeg(video_path, fps)
            
        elif rtsp_url:
            # RTSP stream
            from modules.rtsp_handler import RTSPHandler
            
            rtsp_handler = RTSPHandler(rtsp_url)
            if not rtsp_handler.connect():
                return JSONResponse(
                    {"error": f"Failed to connect to RTSP stream: {rtsp_url}"},
                    status_code=400
                )
            
            # Capture frames for specified duration
            start_time = time.time()
            frame_count = 0
            target_frames = int(rtsp_duration * fps)
            
            while (time.time() - start_time) < rtsp_duration and frame_count < target_frames:
                frame_result = rtsp_handler.read_frame(timeout=2.0)
                if frame_result:
                    timestamp, frame = frame_result
                    frames_data.append((timestamp - start_time, frame))  # Relative timestamp
                    frame_count += 1
                    time.sleep(1.0 / fps)  # Control frame rate
                else:
                    break
            
            rtsp_handler.disconnect()
            
            if not frames_data:
                return JSONResponse(
                    {"error": "Could not capture frames from RTSP stream"},
                    status_code=400
                )
        else:
            # Video file upload: extract frames
            if not video_path:
                return JSONResponse(
                    {"error": "Video file path not set"},
                    status_code=400
                )
            frames_data = extract_frames_ffmpeg(video_path, fps)
            if not frames_data:
                return JSONResponse(
                    {"error": "Could not extract frames from video"},
                    status_code=400
                )
        
        try:
            # C) MOTION GATE: Initialize motion detector
            motion_detector = MotionDetector(threshold=30.0, min_area=500)
            motion_threshold = 0.5  # Minimum motion score to process frame
            frames_skipped = 0
            
            # D) DETECTION: Process frames with motion gating
            processed_frames = []
            occlusion_pcts = []
            blur_scores = []
            track_data = {}  # For simple tracking: {track_id: {boxes, timestamps}}
            next_track_id = 1
            
            for timestamp, frame in frames_data:
                # Motion gate: Skip frames with no significant motion
                has_motion, motion_score = motion_detector.has_motion(frame)
                
                if not has_motion or motion_score < motion_threshold:
                    frames_skipped += 1
                    # Still add frame data but mark as skipped
                    processed_frames.append({
                        'timestamp': timestamp,
                        'person_boxes': [],
                        'occlusion_pct': 0,
                        'blur_score': calculate_blur_score(frame),
                        'motion_score': motion_score,
                        'skipped': True,
                    })
                    continue
                
                # Run YOLOv8n person detection (only on frames with motion)
                person_boxes = detect_persons(frame)
                
                # E) TRACKING: Simple overlap-based tracking (assign track IDs)
                tracked_boxes = []
                used_tracks = set()
                
                for box in person_boxes:
                    # Find matching track by overlap
                    best_track_id = None
                    best_overlap = 0.3  # Minimum IoU threshold
                    
                    for track_id, track_info in track_data.items():
                        if track_id in used_tracks:
                            continue
                        # Get last box from this track
                        if track_info['boxes']:
                            last_box = track_info['boxes'][-1]
                            # Calculate IoU (simplified)
                            overlap = calculate_box_overlap(box, last_box)
                            if overlap > best_overlap:
                                best_overlap = overlap
                                best_track_id = track_id
                    
                    if best_track_id:
                        # Update existing track
                        track_data[best_track_id]['boxes'].append(box)
                        track_data[best_track_id]['timestamps'].append(timestamp)
                        tracked_boxes.append({'box': box, 'track_id': best_track_id})
                        used_tracks.add(best_track_id)
                    else:
                        # Create new track
                        track_id = next_track_id
                        next_track_id += 1
                        track_data[track_id] = {
                            'boxes': [box],
                            'timestamps': [timestamp]
                        }
                        tracked_boxes.append({'box': box, 'track_id': track_id})
                
                # Calculate occlusion (returns 0-1, convert to percentage)
                occlusion_ratio = calculate_union_area(person_boxes, roi_coords, frame.shape)
                occlusion_pct = occlusion_ratio * 100
                occlusion_pcts.append(occlusion_pct)
                
                # Calculate blur
                blur_score = calculate_blur_score(frame)
                blur_scores.append(blur_score)
                
                processed_frames.append({
                    'timestamp': timestamp,
                    'person_boxes': person_boxes,
                    'tracked_boxes': tracked_boxes,
                    'occlusion_pct': occlusion_pct,
                    'blur_score': blur_score,
                    'motion_score': motion_score,
                    'skipped': False,
                })
            
            # Calculate statistics
            occlusion_pct_avg = sum(occlusion_pcts) / len(occlusion_pcts) if occlusion_pcts else 0
            occlusion_pct_max = max(occlusion_pcts) if occlusion_pcts else 0
            
            # Create occlusion_series for plotting: [(timestamp, occlusion_pct), ...]
            occlusion_series = [
                {
                    'timestamp': processed_frames[i]['timestamp'],
                    'occlusion_pct': occlusion_pcts[i]
                }
                for i in range(len(processed_frames))
                if not processed_frames[i].get('skipped', False) and i < len(occlusion_pcts)
            ]
            
            # Calculate dwell time
            dwell_s_max = 0
            dwell_s_total = 0
            current_dwell = 0
            for pct in occlusion_pcts:
                if pct > 10:
                    frame_dwell = 1 / fps
                    current_dwell += frame_dwell
                    dwell_s_total += frame_dwell
                    dwell_s_max = max(dwell_s_max, current_dwell)
                else:
                    current_dwell = 0
            
            # Calculate blur score average and normalize to [0,1]
            blur_score_avg = sum(blur_scores) / len(blur_scores) if blur_scores else 0
            # Normalize blur to blur_term in [0,1] for scoring
            # Higher blur_score = less blur, so invert: blur_term = 1 - normalized_score
            # Typical blur_score range: 0-5000, normalize to [0,1] then invert
            blur_max = 5000.0  # Typical max blur score
            blur_normalized = min(1.0, blur_score_avg / blur_max) if blur_max > 0 else 0.0
            blur_term = 1.0 - blur_normalized  # Invert: higher blur_score = lower blur_term
            
            # Calculate flip_at_s (early alert)
            # flip_at_s: first time occlusion>30 for >=0.5s OR dwell>=2s
            flip_at_s = 0
            occlusion30_duration = 0
            cumulative_dwell = 0
            alert_frame_index = -1
            
            for i, frame_data in enumerate(processed_frames):
                if frame_data.get('skipped', False):
                    continue
                    
                pct = occlusion_pcts[i] if i < len(occlusion_pcts) else 0
                frame_time = frame_data['timestamp']
                
                # Check occlusion > 30% for >= 0.5s
                if pct > 30:
                    occlusion30_duration += 1 / fps
                    if occlusion30_duration >= 0.5 and flip_at_s == 0:
                        flip_at_s = frame_time
                        alert_frame_index = i
                else:
                    occlusion30_duration = 0
                
                # Check dwell >= 2s
                if pct > 10:
                    cumulative_dwell += 1 / fps
                    if cumulative_dwell >= 2.0 and flip_at_s == 0:
                        flip_at_s = frame_time
                        alert_frame_index = i
                else:
                    cumulative_dwell = 0
            
            # Calculate standard_ai_alert_at_s
            # NOTE: These thresholds (60% occlusion for 2s, or 4s dwell) are SIMULATED values
            # representing conservative detection thresholds typical of traditional AI security systems.
            # They are used for comparison purposes to demonstrate XUUG's faster detection capabilities.
            # These are NOT documented industry standards - they are design assumptions for demonstration.
            standard_ai_alert_at_s = 0
            standard_not_triggered = False
            cumulative_dwell = 0
            occlusion60_duration = 0
            clip_duration = processed_frames[-1]['timestamp'] if processed_frames else 0
            
            for i, pct in enumerate(occlusion_pcts):
                frame_time = processed_frames[i]['timestamp']
                
                # Simulated traditional system: Check occlusion > 60% for 2s
                if pct > 60:
                    occlusion60_duration += 1 / fps
                    if occlusion60_duration >= 2 and standard_ai_alert_at_s == 0:
                        standard_ai_alert_at_s = frame_time
                else:
                    occlusion60_duration = 0
                
                # Simulated traditional system: Check dwell >= 4s
                if pct > 10:
                    cumulative_dwell += 1 / fps
                    if cumulative_dwell >= 4 and standard_ai_alert_at_s == 0:
                        standard_ai_alert_at_s = frame_time
                else:
                    cumulative_dwell = 0
            
            # If not triggered, set to clip_duration + 0.1
            if standard_ai_alert_at_s == 0:
                standard_ai_alert_at_s = clip_duration + 0.1
                standard_not_triggered = True
            
            # Calculate reliability score using coverage metrics
            coverage_metrics = CoverageMetrics(
                occlusion_pct_avg=occlusion_pct_avg,
                occlusion_pct_max=occlusion_pct_max,
                dwell_s_max=dwell_s_max,
                blur_score_avg=blur_score_avg,
                redundancy=0,  # Single camera for now
                coverage_score=0  # Will calculate below
            )
            
            # Calculate coverage score
            coverage_metrics.coverage_score = calculate_coverage_score(coverage_metrics)
            reliability_score = round(coverage_metrics.coverage_score)
            reliability_label = 'NOT RELIABLE' if reliability_score < 70 else 'RELIABLE'
            
            # Generate explanation and action (will be enhanced by Grok if available)
            occlusion_text = f"{round(occlusion_pct_max)}% occlusion" if occlusion_pct_max > 5 else "minimal occlusion"
            why = f"Single view with {occlusion_text} means this zone can't be verified independently."
            # More specific fallback based on occlusion level
            if occlusion_pct_max > 60:
                action = "Add second camera opposite the ROI to provide coverage overlap."
            elif occlusion_pct_max > 30:
                action = "Reposition camera or add overhead camera to reduce occlusion."
            else:
                action = "Consider adding camera redundancy for Region of Interest coverage."
            
            # Camera recommendation heuristic
            recommendation = None
            redundancy = 0  # Single camera for now
            if occlusion_pct_max > 60 and redundancy == 0:
                recommendation = "Add second camera opposite ROI"
            elif frames_data:
                # Check if ROI is near top of frame and motion occurs near edge
                h, w = frames_data[0][1].shape[:2]
                roi_y1_px = int(roi_coords[1] * h)
                roi_top_threshold = h * 0.2  # Top 20% of frame
                
                # Check if any person boxes are near frame edges
                edge_detected = False
                for frame_data in processed_frames:
                    if frame_data.get('skipped', False):
                        continue
                    for box in frame_data.get('person_boxes', []):
                        x1, y1, x2, y2 = box[0] * w, box[1] * h, box[2] * w, box[3] * h
                        # Check if near left/right edges (within 10% of frame width)
                        if x1 < w * 0.1 or x2 > w * 0.9:
                            edge_detected = True
                            break
                    if edge_detected:
                        break
                
                if roi_y1_px < roi_top_threshold and edge_detected:
                    recommendation = "Add rooftop cam / drone check"
            
            # If no specific recommendation, use default action
            if not recommendation:
                recommendation = action
            
            # Generate alert frame (frame at flip_at_s)
            alert_frame_base64 = None
            if alert_frame_index >= 0 and alert_frame_index < len(frames_data) and alert_frame_index < len(processed_frames):
                alert_timestamp, alert_frame = frames_data[alert_frame_index]
                alert_person_boxes = processed_frames[alert_frame_index]['person_boxes']
                alert_occlusion = processed_frames[alert_frame_index]['occlusion_pct']
                alert_overlay = draw_overlay(
                    alert_frame, 
                    roi_coords, 
                    alert_person_boxes, 
                    alert_occlusion, 
                    dwell_s_max, 
                    occlusion_pct_max,
                    reliability_score,
                    reliability_label
                )
                alert_frame_base64 = frame_to_base64(alert_overlay)
            
            # Generate overlay image (frame with max occlusion)
            overlay_image_base64 = None
            if processed_frames:
                max_occlusion_idx = max(range(len(processed_frames)), key=lambda i: processed_frames[i]['occlusion_pct'])
                max_timestamp, max_frame = frames_data[max_occlusion_idx]
                max_person_boxes = processed_frames[max_occlusion_idx]['person_boxes']
                max_occlusion = processed_frames[max_occlusion_idx]['occlusion_pct']
                overlay_frame = draw_overlay(
                    max_frame, 
                    roi_coords, 
                    max_person_boxes, 
                    max_occlusion, 
                    dwell_s_max, 
                    occlusion_pct_max,
                    reliability_score,
                    reliability_label
                )
                overlay_image_base64 = frame_to_base64(overlay_frame)
            
            # Prepare response
            response = {
                "reliability_label": reliability_label,
                "reliability_score": reliability_score,
                "why": why,
                "action": action,
                "signals": {
                    "occlusion_pct_avg": round(occlusion_pct_avg * 10) / 10,
                    "occlusion_pct_max": round(occlusion_pct_max * 10) / 10,
                    "dwell_s_max": round(dwell_s_max * 10) / 10,
                    "dwell_s_total": round(dwell_s_total * 10) / 10,
                    "blur_score_avg": round(blur_score_avg),
                    "redundancy": 0,
                },
                "occlusion_series": occlusion_series,
                "timestamps": {
                    "flip_at_s": round(flip_at_s * 10) / 10,
                    "standard_ai_alert_at_s": round(standard_ai_alert_at_s * 10) / 10,
                    "standard_not_triggered": standard_not_triggered,
                },
                "debug": {
                    "sampled_frames": len(processed_frames),
                    "frames_processed": len([f for f in processed_frames if not f.get('skipped', False)]),
                    "frames_skipped": frames_skipped,
                    "fps_used": fps,
                    "roi": roi_coords,
                    "roi_pixels": [int(roi_coords[0] * frames_data[0][1].shape[1]), 
                                  int(roi_coords[1] * frames_data[0][1].shape[0]),
                                  int(roi_coords[2] * frames_data[0][1].shape[1]),
                                  int(roi_coords[3] * frames_data[0][1].shape[0])] if frames_data else None,
                    "motion_gating_enabled": True,
                    "track_count": len(track_data),
                },
            }
            
            if alert_frame_base64:
                response["alert_frame"] = alert_frame_base64
                response["frame_data"] = {
                    "timestamp": processed_frames[alert_frame_index]['timestamp'],
                    "person_boxes": processed_frames[alert_frame_index]['person_boxes'],
                }
            
            if overlay_image_base64:
                response["overlay_image"] = overlay_image_base64
            
            # Include all frames data for frontend
            response["all_frames"] = [
                {
                    "timestamp": f['timestamp'],
                    "person_boxes": f['person_boxes'],
                    "occlusion_pct": f['occlusion_pct'],
                }
                for f in processed_frames
            ]
            
            return JSONResponse(response)
            
        finally:
            # Clean up temp file
            if os.path.exists(video_path):
                os.unlink(video_path)
                
    except Exception as e:
        import traceback
        error_msg = f"Analysis error: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        return JSONResponse(
            {"error": f"Failed to analyze video: {str(e)}"},
            status_code=500
        )

@app.post("/calibrate-homography")
async def calibrate_homography(
    frame: UploadFile = File(...),
    source_points: str = Form(...),  # JSON array of [x, y] points
    target_points: str = Form(...)   # JSON array of [x, y] target coordinates
):
    """
    Calculate homography matrix from clicked points.
    
    Input:
    - frame: Single image frame
    - source_points: JSON array of clicked points [[x1,y1], [x2,y2], ...]
    - target_points: JSON array of target plane coordinates [[x1,y1], [x2,y2], ...]
    
    Output:
    - homography_matrix: 3x3 matrix as nested array
    """
    try:
        from modules.homography import calculate_homography, validate_homography
        
        # Parse points
        src_pts_raw = json.loads(source_points)
        dst_pts_raw = json.loads(target_points)
        
        if not isinstance(src_pts_raw, list) or not isinstance(dst_pts_raw, list):
            return JSONResponse(
                {"error": "source_points and target_points must be JSON arrays"},
                status_code=400
            )
        
        if len(src_pts_raw) < 4 or len(dst_pts_raw) < 4:
            return JSONResponse(
                {"error": "Need at least 4 point pairs for homography"},
                status_code=400
            )
        
        if len(src_pts_raw) != len(dst_pts_raw):
            return JSONResponse(
                {"error": "Source and target points must have same length"},
                status_code=400
            )
        
        # Convert to list of tuples: [[x, y], ...] -> [(x, y), ...]
        # Handle both array format [x, y] and object format {x, y}
        def to_tuple(pt):
            if isinstance(pt, list) and len(pt) == 2:
                return (float(pt[0]), float(pt[1]))
            elif isinstance(pt, dict) and 'x' in pt and 'y' in pt:
                return (float(pt['x']), float(pt['y']))
            else:
                raise ValueError(f"Invalid point format: {pt}")
        
        src_pts = [to_tuple(pt) for pt in src_pts_raw]
        dst_pts = [to_tuple(pt) for pt in dst_pts_raw]
        
        # Read frame (for validation, not used in calculation)
        content = await frame.read()
        nparr = np.frombuffer(content, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return JSONResponse(
                {"error": "Could not decode image"},
                status_code=400
            )
        
        # Calculate homography
        H = calculate_homography(src_pts, dst_pts)
        
        # Check if homography calculation failed (returns None)
        if H is None:
            return JSONResponse(
                {"error": "Could not calculate homography. Points may be collinear or invalid. Try selecting 4 non-collinear points."},
                status_code=400
            )
        
        if not validate_homography(H):
            return JSONResponse(
                {"error": "Invalid homography matrix calculated. Points may be collinear or too close together."},
                status_code=400
            )
        
        # Convert to list for JSON serialization
        H_list = H.tolist()
        
        return JSONResponse({
            "homography_matrix": H_list,
            "source_points": src_pts,
            "target_points": dst_pts,
            "image_shape": [img.shape[1], img.shape[0]]  # [width, height]
        })
        
    except Exception as e:
        import traceback
        error_msg = f"Homography calibration error: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        return JSONResponse(
            {"error": f"Failed to calculate homography: {str(e)}"},
            status_code=500
        )

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
