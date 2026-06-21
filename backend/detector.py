import os
import cv2
import numpy as np
import torch

# Patch torch.load to default to weights_only=False to allow YOLOv8 custom classes loading
_orig_load = torch.load
def _patched_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _orig_load(*args, **kwargs)
torch.load = _patched_load

from ultralytics import YOLO
from typing import List, Dict, Tuple

class VehicleDetector:
    def __init__(self, model_path: str = "yolov8n.pt"):
        self.model = YOLO(model_path)
        # Class maps: COCO IDs
        # 0: person, 2: car, 3: motorcycle, 5: bus, 7: truck
        self.allowed_classes = {0: "person", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
        
        # Load custom fine-tuned weights if trained and available
        self.custom_model = None
        custom_weights_path = os.path.join(os.path.dirname(__file__), "runs", "detect", "train", "weights", "best.pt")
        if os.path.exists(custom_weights_path):
            try:
                self.custom_model = YOLO(custom_weights_path)
                # Classes: 0: "with helmet", 1: "without helmet", 2: "rider", 3: "number plate"
                self.custom_classes = {0: "with helmet", 1: "without helmet", 2: "rider", 3: "number plate"}
                print(f"Loaded custom fine-tuned helmet/plate model from {custom_weights_path}")
            except Exception as e:
                print(f"Error loading custom weights: {e}")

    def detect(self, frame: np.ndarray) -> List[Dict]:
        """
        Run YOLOv8 inference (both base COCO model and custom model if available) and filter classes.
        Returns a list of raw detections.
        """
        detections = []
        
        # 1. Base YOLOv8 COCO Model Inference
        results = self.model(frame, verbose=False)
        if results:
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    class_id = int(box.cls[0].item())
                    if class_id in self.allowed_classes:
                        conf = float(box.conf[0].item())
                        # Only allow confidence > 0.3 to reduce false detections
                        if conf < 0.3:
                            continue
                        xyxy = box.xyxy[0].tolist()
                        x1, y1, x2, y2 = xyxy
                        cx = (x1 + x2) / 2.0
                        cy = (y1 + y2) / 2.0
                        
                        detections.append({
                            "class_id": class_id,
                            "class_name": self.allowed_classes[class_id],
                            "bbox": [x1, y1, x2, y2],
                            "confidence": conf,
                            "centroid": [cx, cy]
                        })
                        
        # 2. Custom Model Inference (If Trained and Loaded)
        if self.custom_model is not None:
            try:
                custom_results = self.custom_model(frame, verbose=False)
                if custom_results:
                    for result in custom_results:
                        boxes = result.boxes
                        for box in boxes:
                            class_id = int(box.cls[0].item())
                            if class_id in self.custom_classes:
                                conf = float(box.conf[0].item())
                                if conf < 0.25: # Slightly lower threshold for custom classes
                                    continue
                                xyxy = box.xyxy[0].tolist()
                                x1, y1, x2, y2 = xyxy
                                cx = (x1 + x2) / 2.0
                                cy = (y1 + y2) / 2.0
                                
                                class_name = self.custom_classes[class_id]
                                # If class is "rider", map it to "person" to work seamlessly with existing tracker/overlays
                                mapped_class = "person" if class_name == "rider" else class_name
                                mapped_id = 0 if class_name == "rider" else class_id + 100 # Offset custom classes to avoid conflict
                                
                                detections.append({
                                    "class_id": mapped_id,
                                    "class_name": mapped_class,
                                    "bbox": [x1, y1, x2, y2],
                                    "confidence": conf,
                                    "centroid": [cx, cy]
                                })
            except Exception as e:
                print(f"Error during custom model inference: {e}")
                
        return detections

    @staticmethod
    def classify_vehicle_category(class_name: str) -> str:
        """
        Map detection class name to categorical traffic user groups.
        """
        if class_name == "motorcycle":
            return "Two-Wheeler"
        elif class_name == "car":
            return "Four-Wheeler"
        elif class_name in ["bus", "truck"]:
            return "Heavy Vehicle"
        elif class_name == "person":
            return "Pedestrian"
        return "Unknown"
