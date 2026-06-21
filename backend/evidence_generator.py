import os
import cv2
import json
import base64
import numpy as np
from datetime import datetime
from typing import List, Dict, Tuple, Optional

class EvidenceGenerator:
    def __init__(self, output_dir: str = "evidence"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Color mapping (BGR) matching Desert Modern Palette
        self.color_safe = (113, 143, 107)        # #6B8F71 Success Green
        self.color_violation = (37, 108, 188)    # #BC6C25 Error Rust/Red
        self.color_warning = (115, 163, 212)     # #D4A373 Warning Amber
        self.color_plate = (255, 255, 255)       # White
        self.color_text_bg = (42, 45, 43)        # Dark Slate for high contrast text backing

    def draw_dashed_rect(self, img: np.ndarray, pt1: Tuple[int, int], pt2: Tuple[int, int], color: Tuple[int, int, int], thickness: int = 2, gap: int = 8):
        """
        Draws a dashed rectangle on the frame.
        """
        x1, y1 = pt1
        x2, y2 = pt2
        
        # Horizontal lines
        for x in range(x1, x2, gap * 2):
            cv2.line(img, (x, y1), (min(x + gap, x2), y1), color, thickness)
            cv2.line(img, (x, y2), (min(x + gap, x2), y2), color, thickness)
            
        # Vertical lines
        for y in range(y1, y2, gap * 2):
            cv2.line(img, (x1, y), (x1, min(y + gap, y2)), color, thickness)
            cv2.line(img, (x2, y), (x2, min(y + gap, y2)), color, thickness)

    def draw_label(self, img: np.ndarray, text: str, pt: Tuple[int, int], color: Tuple[int, int, int]):
        """
        Draws a text label with a filled background block for high contrast.
        """
        x, y = pt
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.4
        thickness = 1
        
        (w, h), baseline = cv2.getTextSize(text, font, font_scale, thickness)
        
        # Draw background rectangle
        cv2.rectangle(img, (x, y - h - 5), (x + w + 6, y + baseline - 2), color, -1)
        # Draw text
        cv2.putText(img, text, (x + 3, y - 3), font, font_scale, (255, 255, 255), thickness, cv2.LINE_AA)

    def annotate_frame(
        self,
        frame: np.ndarray,
        tracked_vehicles: List[Dict],
        violations: List[Dict],
        road_config: Dict,
        ocr_results: Dict[int, Dict] = None
    ) -> np.ndarray:
        """
        Draws boxes, direction arrows, watermarks and metadata onto the frame.
        """
        img = frame.copy()
        ocr_results = ocr_results or {}
        
        # Build map of violations by vehicle track ID for box coloring
        vio_map = {v["vehicle_track_id"]: v for v in violations}
        
        # Draw tracked vehicles
        for v in tracked_vehicles:
            tid = v["track_id"]
            x1, y1, x2, y2 = map(int, v["bbox"])
            centroid = tuple(map(int, v["centroid"]))
            v_class = v["class_name"]
            
            # Skip drawing pedestrians to reduce clutter unless they are involved in helmet/seatbelt violations
            if v_class == "person" and tid not in vio_map:
                continue

            # Determine box styling
            if tid in vio_map:
                # Violation: draw red dashed box
                self.draw_dashed_rect(img, (x1, y1), (x2, y2), self.color_violation, thickness=2)
                self.draw_label(img, f"ID:{tid} | {vio_map[tid]['violation_type'].upper()}", (x1, y1), self.color_violation)
                
                # If Wrong-Way, draw direction arrow vectors
                if vio_map[tid]["violation_type"] == "Wrong-Side Driving" and v["angle"] is not None:
                    allowed_angle = road_config.get("allowed_direction_deg", 0.0)
                    cx, cy = centroid
                    
                    # Allowed Direction (Green Arrow)
                    allowed_rad = np.radians(allowed_angle)
                    adx = int(40 * np.sin(allowed_rad))
                    ady = int(-40 * np.cos(allowed_rad))
                    cv2.arrowedLine(img, (cx, cy), (cx + adx, cy + ady), self.color_safe, 3, tipLength=0.3)
                    
                    # Detected Direction (Red Arrow)
                    actual_rad = np.radians(v["angle"])
                    ddx = int(40 * np.sin(actual_rad))
                    ddy = int(-40 * np.cos(actual_rad))
                    cv2.arrowedLine(img, (cx, cy), (cx + ddx, cy + ddy), self.color_violation, 3, tipLength=0.3)
            else:
                # Safe: draw green solid box
                cv2.rectangle(img, (x1, y1), (x2, y2), self.color_safe, 2)
                self.draw_label(img, f"ID:{tid} | {v_class.upper()} | SAFE", (x1, y1), self.color_safe)

            # Draw Plate OCR region if available
            plate_info = ocr_results.get(tid)
            if plate_info and "plate_bbox" in plate_info and plate_info["plate_bbox"]:
                px1, py1, px2, py2 = map(int, plate_info["plate_bbox"])
                # Draw plate box
                cv2.rectangle(img, (px1, py1), (px2, py2), self.color_plate, 1)
                # Plate label
                self.draw_label(img, plate_info["plate_text"], (px1, py1), self.color_text_bg)

        # Draw Stop Line
        stop_line_y = road_config.get("stop_line_y", 480)
        cv2.line(img, (0, stop_line_y), (img.shape[1], stop_line_y), (100, 100, 100), 2)
        cv2.putText(img, "STOP LINE", (10, stop_line_y - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (100, 100, 100), 1, cv2.LINE_AA)

        # Draw No Parking zones as overlays
        for poly in road_config.get("no_parking_zones", []):
            poly_np = np.array(poly, dtype=np.int32)
            cv2.polylines(img, [poly_np], True, self.color_warning, 2)
            cv2.putText(
                img, "NO PARKING ZONE", (poly_np[0][0], poly_np[0][1] - 5),
                cv2.FONT_HERSHEY_SIMPLEX, 0.4, self.color_warning, 1, cv2.LINE_AA
            )

        # Add Watermark (Bottom-Right)
        timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        watermark = f"VisionGuard | BTP | {timestamp_str}"
        cv2.putText(
            img, watermark, (img.shape[1] - 220, img.shape[0] - 15),
            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (240, 240, 240), 1, cv2.LINE_AA
        )

        return img

    @staticmethod
    def encode_frame(annotated_frame: np.ndarray) -> str:
        """
        Encode BGR frame as JPEG base64 string.
        """
        _, buffer = cv2.imencode('.jpg', annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        base64_str = base64.b64encode(buffer).decode('utf-8')
        return base64_str

    def save_evidence(self, incident_id: str, annotated_frame: np.ndarray, metadata: Dict):
        """
        Saves annotated frame as .jpg and metadata as .json.
        """
        jpg_path = os.path.join(self.output_dir, f"{incident_id}.jpg")
        json_path = os.path.join(self.output_dir, f"{incident_id}.json")
        
        cv2.imwrite(jpg_path, annotated_frame)
        with open(json_path, 'w') as f:
            json.dump(metadata, f, indent=2, default=str)
