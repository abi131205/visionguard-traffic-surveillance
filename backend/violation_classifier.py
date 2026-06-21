import cv2
import numpy as np
import time
from typing import List, Dict, Tuple, Optional

class ViolationClassifier:
    def __init__(self):
        # Map track_id -> timestamp when vehicle was first seen stationary
        self.stationary_trackers: Dict[int, float] = {}
        # Map track_id -> last known centroid to check movement
        self.last_centroids: Dict[int, Tuple[float, float]] = {}

    @staticmethod
    def get_overlap_ratio(bbox1: List[float], bbox2: List[float]) -> float:
        """
        Computes the ratio of bbox1's area that overlaps with bbox2.
        Commonly used to see if a rider (person bbox1) is on a motorcycle (bbox2).
        """
        x1_i = max(bbox1[0], bbox2[0])
        y1_i = max(bbox1[1], bbox2[1])
        x2_i = min(bbox1[2], bbox2[2])
        y2_i = min(bbox1[3], bbox2[3])

        if x2_i <= x1_i or y2_i <= y1_i:
            return 0.0

        inter_area = (x2_i - x1_i) * (y2_i - y1_i)
        bbox1_area = (bbox1[2] - bbox1[0]) * (bbox1[3] - bbox1[1])

        if bbox1_area == 0:
            return 0.0

        return float(inter_area / bbox1_area)

    def check_helmet(self, rider_bbox: List[float], frame: np.ndarray) -> Tuple[bool, float]:
        """
        Crop head region (top 25% of rider bbox) and check if helmet is worn.
        Heuristic: if rider height < 120px OR mean HSV saturation > 0.4 (hair/skin colors),
        classify as no_helmet. Otherwise, classify as helmet.
        """
        x1, y1, x2, y2 = map(int, rider_bbox)
        h = y2 - y1
        w = x2 - x1
        
        if h <= 0 or w <= 0:
            return True, 1.0
            
        # Crop head (top 25% of rider bounding box)
        head_y2 = int(y1 + 0.25 * h)
        if head_y2 <= y1:
            return True, 1.0
            
        head_crop = frame[y1:head_y2, x1:x2]
        if head_crop.size == 0:
            return True, 1.0
            
        # 1. Height-based detection limits (too small/far away)
        if h < 120:
            return False, 0.78
            
        # 2. HSV saturation heuristic: skin/hair textures show high saturation compared to helmets
        try:
            hsv = cv2.cvtColor(head_crop, cv2.COLOR_BGR2HSV)
            mean_sat = hsv[:, :, 1].mean() / 255.0  # Scale to [0, 1]
            if mean_sat > 0.4:
                return False, 0.78
        except Exception:
            pass
            
        return True, 0.85

    def check_seatbelt(self, person_bbox: List[float], frame: np.ndarray) -> Tuple[bool, float]:
        """
        Crop torso region (middle 40% height, full width) of occupant.
        Heuristic: Search for a diagonal edge (representing a seatbelt) at 30-60 degrees.
        If not found, flag as violation.
        """
        x1, y1, x2, y2 = map(int, person_bbox)
        h = y2 - y1
        w = x2 - x1
        
        if h <= 0 or w <= 0:
            return True, 1.0
            
        # Torso: middle 40%
        torso_y1 = int(y1 + 0.3 * h)
        torso_y2 = int(y1 + 0.7 * h)
        
        if torso_y2 <= torso_y1:
            return True, 1.0
            
        torso_crop = frame[torso_y1:torso_y2, x1:x2]
        if torso_crop.size == 0:
            return True, 1.0
            
        try:
            gray = cv2.cvtColor(torso_crop, cv2.COLOR_BGR2GRAY)
            # Edge detection
            edges = cv2.Canny(gray, 50, 150)
            # Hough lines - tuned for continuous diagonal lines (seatbelts)
            lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=25, minLineLength=30, maxLineGap=8)
            
            if lines is not None:
                for line in lines:
                    lx1, ly1, lx2, ly2 = line[0]
                    dx = lx2 - lx1
                    dy = ly2 - ly1
                    if dx != 0:
                        angle_deg = abs(np.degrees(np.arctan2(dy, dx)))
                        # Look for diagonal lines (30° - 60° or 120° - 150° in standard layout)
                        if 30.0 <= angle_deg <= 60.0 or 120.0 <= angle_deg <= 150.0:
                            return True, 0.90
        except Exception:
            pass
            
        return False, 0.72

    def classify(
        self,
        tracked_vehicles: List[Dict],
        raw_detections: List[Dict],
        road_config: Dict,
        signal_state: str,
        frame_number: int,
        timestamp: str,
        frame: np.ndarray
    ) -> List[Dict]:
        """
        Main routing function to run the 7 classification checks.
        """
        violations = []
        current_time = time.time()
        
        # 1. Gather all raw 'person' detections to check overlaps (riders, occupants, pedestrians)
        persons = [d for d in raw_detections if d["class_name"] == "person"]
        
        # Check if this frame is a close-up driver cabin shot (person height > 45% of image height)
        img_h, img_w, _ = frame.shape
        is_cabin_view = False
        for d in raw_detections:
            if d["class_name"] == "person":
                p_h = d["bbox"][3] - d["bbox"][1]
                if p_h > 0.45 * img_h:
                    is_cabin_view = True
                    break
        
        # Extract intersection thresholds
        allowed_angle = road_config.get("allowed_direction_deg", 0.0)
        tolerance = road_config.get("tolerance_deg", 30.0)
        stop_line_y = road_config.get("stop_line_y", 480)
        no_parking_polys = road_config.get("no_parking_zones", [])
        
        for vehicle in tracked_vehicles:
            tid = vehicle["track_id"]
            bbox = vehicle["bbox"]
            centroid = vehicle["centroid"]
            v_class = vehicle["class_name"]
            angle = vehicle["angle"]
            direction_vector = vehicle["direction_vector"]
            
            # Skip pedestrians from vehicle checks
            if v_class == "person":
                continue
                
            vehicle_category = "Four-Wheeler" if v_class == "car" else ("Two-Wheeler" if v_class == "motorcycle" else "Heavy Vehicle")
            
            # --- VIOLATION 1: Wrong-Side Driving ---
            if angle is not None and not is_cabin_view:
                # Modulo 360 angular distance
                diff = abs(angle - allowed_angle) % 360
                diff = min(diff, 360 - diff)
                if diff > tolerance:
                    conf = float(np.clip(0.6 + (diff / 180.0) * 0.4, 0.5, 1.0))
                    violations.append({
                        "violation_id": f"VIO-{int(current_time)}-{tid:03d}-1",
                        "violation_type": "Wrong-Side Driving",
                        "vehicle_track_id": tid,
                        "vehicle_class": vehicle_category,
                        "confidence": conf,
                        "bbox": bbox,
                        "frame_number": frame_number,
                        "timestamp": timestamp,
                        "license_plate": vehicle["license_plate"],
                        "severity": "HIGH"
                    })

            # --- VIOLATION 2 & 4: Helmet Non-Compliance & Triple Riding (Two-Wheelers) ---
            if v_class == "motorcycle":
                # Find all riders overlapping this motorcycle
                riders = []
                for p in persons:
                    # Overlap of rider on motorcycle should be > 40%
                    if self.get_overlap_ratio(p["bbox"], bbox) > 0.40:
                        riders.append(p)
                
                # Check Triple Riding
                if len(riders) >= 3:
                    violations.append({
                        "violation_id": f"VIO-{int(current_time)}-{tid:03d}-4",
                        "violation_type": "Triple Riding",
                        "vehicle_track_id": tid,
                        "vehicle_class": "Two-Wheeler",
                        "confidence": 0.95,
                        "bbox": bbox,
                        "frame_number": frame_number,
                        "timestamp": timestamp,
                        "license_plate": vehicle["license_plate"],
                        "severity": "MEDIUM"
                    })
                
                # Check Helmet for each rider
                for rider in riders:
                    # 1. Check if custom ML model detected helmet status directly
                    custom_helmet_status = None
                    best_overlap = 0.0
                    for d in raw_detections:
                        if d["class_name"] in ["with helmet", "without helmet"]:
                            overlap = self.get_overlap_ratio(d["bbox"], rider["bbox"])
                            if overlap > 0.40 and overlap > best_overlap:
                                best_overlap = overlap
                                custom_helmet_status = (d["class_name"] == "with helmet")
                                helmet_conf = d["confidence"]

                    if custom_helmet_status is not None:
                        has_helmet = custom_helmet_status
                    else:
                        # Fallback to OpenCV HSV heuristic
                        has_helmet, helmet_conf = self.check_helmet(rider["bbox"], frame)

                    if not has_helmet:
                        violations.append({
                            "violation_id": f"VIO-{int(current_time)}-{tid:03d}-2",
                            "violation_type": "Helmet Non-Compliance",
                            "vehicle_track_id": tid,
                            "vehicle_class": "Two-Wheeler",
                            "confidence": helmet_conf,
                            "bbox": rider["bbox"],  # Focus on the person violating
                            "frame_number": frame_number,
                            "timestamp": timestamp,
                            "license_plate": vehicle["license_plate"],
                            "severity": "MEDIUM"
                        })
                        break  # One violation per bike is enough for evidence

            # --- VIOLATION 3: Seatbelt Non-Compliance (Cars / Four-Wheelers) ---
            if v_class == "car":
                # Find driver/occupant inside the car
                occupants = []
                for p in persons:
                    if self.get_overlap_ratio(p["bbox"], bbox) > 0.20:
                        occupants.append(p)
                
                # Inspect driver torso (usually leftmost or rightmost occupant on screen depending on lane)
                # For this rule, if we have occupants, we will inspect them
                for occupant in occupants:
                    has_seatbelt, seatbelt_conf = self.check_seatbelt(occupant["bbox"], frame)
                    if not has_seatbelt:
                        violations.append({
                            "violation_id": f"VIO-{int(current_time)}-{tid:03d}-3",
                            "violation_type": "Seatbelt Non-Compliance",
                            "vehicle_track_id": tid,
                            "vehicle_class": "Four-Wheeler",
                            "confidence": seatbelt_conf,
                            "bbox": occupant["bbox"],
                            "frame_number": frame_number,
                            "timestamp": timestamp,
                            "license_plate": vehicle["license_plate"],
                            "severity": "MEDIUM"
                        })
                        break

            # --- VIOLATION 5 & 6: Stop-Line & Red-Light (Signals) ---
            if signal_state == "RED" and not is_cabin_view:
                cx, cy = centroid
                
                # Check Stop-Line Crossing:
                # South->North traffic goes UP, violation is when y coordinate goes ABOVE the stop line (y < stop_line_y)
                # North->South traffic goes DOWN, violation is when y coordinate goes BELOW the stop line (y > stop_line_y)
                is_stop_violation = False
                
                # Silk Board, Electronic City Toll (0 deg)
                if abs(allowed_angle - 0) < 45 or abs(allowed_angle - 360) < 45:
                    if cy < stop_line_y and cy > (stop_line_y - 80): # Crossed moving north
                        is_stop_violation = True
                # KR Puram (180 deg)
                elif abs(allowed_angle - 180) < 45:
                    if cy > stop_line_y and cy < (stop_line_y + 80): # Crossed moving south
                        is_stop_violation = True
                # General check if allowed_angle is East/West
                else:
                    # Generic: close to stop_line_y row
                    if abs(cy - stop_line_y) < 25:
                        is_stop_violation = True

                if is_stop_violation:
                    # Verify if it was already violating or active movement
                    violations.append({
                        "violation_id": f"VIO-{int(current_time)}-{tid:03d}-5",
                        "violation_type": "Stop-Line Violation",
                        "vehicle_track_id": tid,
                        "vehicle_class": vehicle_category,
                        "confidence": 0.90,
                        "bbox": bbox,
                        "frame_number": frame_number,
                        "timestamp": timestamp,
                        "license_plate": vehicle["license_plate"],
                        "severity": "HIGH"
                    })

                # Check Red-Light Violation: vehicle moving past the line during RED signal
                # If the vehicle has velocity (moved significantly while red)
                if is_stop_violation and direction_vector is not None:
                    # If vehicle has history and is actively moving (e.g. speed > 10px per frame)
                    history = vehicle["history"]
                    if len(history) >= 3:
                        disp = np.linalg.norm(np.array(history[-1]) - np.array(history[-3]))
                        if disp > 20.0:  # Moving fast
                            violations.append({
                                "violation_id": f"VIO-{int(current_time)}-{tid:03d}-6",
                                "violation_type": "Red-Light Violation",
                                "vehicle_track_id": tid,
                                "vehicle_class": vehicle_category,
                                "confidence": 0.88,
                                "bbox": bbox,
                                "frame_number": frame_number,
                                "timestamp": timestamp,
                                "license_plate": vehicle["license_plate"],
                                "severity": "HIGH"
                            })

            # --- VIOLATION 7: Illegal Parking ---
            # Compute centroid displacement
            last_c = self.last_centroids.get(tid)
            self.last_centroids[tid] = centroid
            
            is_stationary = False
            if last_c is not None:
                dist = np.linalg.norm(np.array(centroid) - np.array(last_c))
                if dist < 2.0:  # stationary
                    if tid not in self.stationary_trackers:
                        self.stationary_trackers[tid] = current_time
                    
                    # For demo purposes, trigger stationary after 5 seconds instead of 30 seconds
                    # (keeps it snappy so the user sees the violation immediately)
                    time_elapsed = current_time - self.stationary_trackers[tid]
                    if time_elapsed >= 5.0:
                        is_stationary = True
                else:
                    # Vehicle moved, reset stationary timer
                    self.stationary_trackers[tid] = current_time
            else:
                self.stationary_trackers[tid] = current_time

            # If stationary, check if centroid falls inside any no parking polygons
            if is_stationary and no_parking_polys and not is_cabin_view:
                cx, cy = centroid
                for poly in no_parking_polys:
                    poly_np = np.array(poly, dtype=np.int32)
                    # pointPolygonTest returns >= 0 if inside
                    if cv2.pointPolygonTest(poly_np, (int(cx), int(cy)), False) >= 0:
                        violations.append({
                            "violation_id": f"VIO-{int(current_time)}-{tid:03d}-7",
                            "violation_type": "Illegal Parking",
                            "vehicle_track_id": tid,
                            "vehicle_class": vehicle_category,
                            "confidence": 0.85,
                            "bbox": bbox,
                            "frame_number": frame_number,
                            "timestamp": timestamp,
                            "license_plate": vehicle["license_plate"],
                            "severity": "LOW"
                        })
                        break

        # Remove dead tracks from stationary/last centroids trackers
        tracked_ids = [v["track_id"] for v in tracked_vehicles]
        for tid in list(self.stationary_trackers.keys()):
            if tid not in tracked_ids:
                del self.stationary_trackers[tid]
        for tid in list(self.last_centroids.keys()):
            if tid not in tracked_ids:
                del self.last_centroids[tid]

        return violations
