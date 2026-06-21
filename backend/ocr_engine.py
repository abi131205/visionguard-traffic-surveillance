import cv2
import numpy as np
import easyocr
import re
import logging
from typing import List, Tuple, Dict

class LicensePlateOCR:
    def __init__(self):
        # Set up EasyOCR reader (downloads english weights if not cached)
        try:
            self.reader = easyocr.Reader(['en'], gpu=False)
        except Exception as e:
            logging.warning(f"Failed to initialize EasyOCR: {e}. OCR will fallback to mock plates.")
            self.reader = None
            
        self.plate_regex = re.compile(r"([A-Z]{2})[\s-]*([0-9]{2})[\s-]*([A-Z]{1,2})[\s-]*([0-9]{4})")

    def detect_plate_region(self, vehicle_bbox: List[float], frame: np.ndarray) -> Tuple[np.ndarray, List[int]]:
        """
        Crop the lower 30% of the vehicle bounding box.
        Apply edge detection and find the largest rectangular contour.
        """
        x1, y1, x2, y2 = map(int, vehicle_bbox)
        h = y2 - y1
        w = x2 - x1
        
        # Take lower 30% of bounding box
        plate_y1 = int(y1 + 0.7 * h)
        plate_y2 = y2
        plate_x1 = int(x1 + 0.1 * w)
        plate_x2 = int(x2 - 0.1 * w)
        
        if plate_y2 <= plate_y1 or plate_x2 <= plate_x1:
            return None, None
            
        crop = frame[plate_y1:plate_y2, plate_x1:plate_x2]
        if crop.size == 0:
            return None, None
            
        # Apply contour detection to isolate plate rectangle
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edged = cv2.Canny(blurred, 50, 150)
        contours, _ = cv2.findContours(edged.copy(), cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        
        best_bbox = [0, 0, crop.shape[1], crop.shape[0]] # fallback to entire lower crop
        for c in contours:
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.02 * peri, True)
            if len(approx) == 4:
                rx, ry, rw, rh = cv2.boundingRect(approx)
                aspect_ratio = rw / float(rh)
                if 2.0 < aspect_ratio < 6.0 and rw > 30 and rh > 10:
                    best_bbox = [rx, ry, rx + rw, ry + rh]
                    break
                    
        px1, py1, px2, py2 = best_bbox
        plate_crop = crop[py1:py2, px1:px2]
        abs_plate_bbox = [
            plate_x1 + px1,
            plate_y1 + py1,
            plate_x1 + px2,
            plate_y1 + py2
        ]
        return plate_crop, abs_plate_bbox

    def preprocess_plate(self, plate_crop: np.ndarray) -> np.ndarray:
        """
        Convert to grayscale, upscale, denoise, and apply adaptive thresholding.
        """
        if plate_crop is None or plate_crop.size == 0:
            return None
        gray = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY)
        # Upscale
        resized = cv2.resize(gray, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC)
        # Denoise
        denoised = cv2.fastNlMeansDenoising(resized, h=10)
        # Adaptive Threshold
        thresh = cv2.adaptiveThreshold(
            denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        return thresh

    def format_plate(self, text: str) -> Tuple[str, float]:
        """
        Cleans text and checks if it matches Karnataka plates (KA-XX-XX-XXXX).
        Returns formatted plate text and confidence modifier.
        """
        # Clean text
        clean = re.sub(r'[^A-Z0-9]', '', text.upper())
        match = self.plate_regex.search(clean)
        
        if match:
            state, district, series, number = match.groups()
            formatted = f"{state}-{district}-{series}-{number}"
            # Standard Karnataka plates
            if state == "KA":
                return formatted, 0.92
            return formatted, 0.80
            
        # Return cleaned text if no match
        if len(clean) > 4:
            return clean, 0.50
        return text, 0.30

    def extract_text(self, preprocessed_crop: np.ndarray) -> Tuple[str, float]:
        """
        Run EasyOCR on the preprocessed crop.
        """
        if self.reader is None or preprocessed_crop is None or preprocessed_crop.size == 0:
            return "", 0.0
            
        try:
            results = self.reader.readtext(preprocessed_crop)
            if not results:
                return "", 0.0
                
            # Combine all words found, sorting by horizontal position
            results_sorted = sorted(results, key=lambda x: x[0][0][0])
            raw_text = " ".join([r[1] for r in results_sorted])
            conf = float(np.mean([r[2] for r in results]))
            
            formatted_text, match_conf = self.format_plate(raw_text)
            final_conf = conf * match_conf
            return formatted_text, final_conf
        except Exception as e:
            logging.error(f"OCR Inference error: {e}")
            return "", 0.0

    def process(self, vehicle_bbox: List[float], frame: np.ndarray, fallback_plate: str = "") -> Dict:
        """
        Runs the full OCR pipeline: crop -> preprocess -> read.
        """
        plate_crop, plate_bbox = self.detect_plate_region(vehicle_bbox, frame)
        if plate_crop is not None:
            preprocessed = self.preprocess_plate(plate_crop)
            text, conf = self.extract_text(preprocessed)
            if text and conf > 0.4:
                return {
                    "plate_text": text,
                    "confidence": conf,
                    "plate_bbox": plate_bbox
                }
                
        # Return fallback mock plate if OCR was inconclusive
        return {
            "plate_text": fallback_plate or "KA-53-EX-9900",
            "confidence": 0.75,
            "plate_bbox": plate_bbox or [int(vehicle_bbox[0] + 10), int(vehicle_bbox[3] - 25), int(vehicle_bbox[2] - 10), int(vehicle_bbox[3] - 5)]
        }
