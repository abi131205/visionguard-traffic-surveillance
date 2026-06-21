import numpy as np
from typing import Dict, List, Tuple

class CentroidTracker:
    def __init__(self, max_disappeared: int = 15, max_distance: float = 120.0):
        self.next_id = 1
        # Map track_id -> list of centroids (max length 10)
        self.history: Dict[int, List[Tuple[float, float]]] = {}
        # Map track_id -> number of consecutive frames disappeared
        self.disappeared: Dict[int, int] = {}
        # Map track_id -> vehicle_class
        self.classes: Dict[int, str] = {}
        # Map track_id -> bounding box (x1, y1, x2, y2)
        self.bboxes: Dict[int, Tuple[float, float, float, float]] = {}
        self.max_disappeared = max_disappeared
        self.max_distance = max_distance

    def generate_plate(self, track_id: int) -> str:
        """
        Generate deterministic Karnataka license plate for mock/test data:
        Format: KA-[01-99]-[A-Z]{1,2}-[0-9]{4}
        """
        district = (track_id * 17) % 99 + 1
        char1 = chr(65 + (track_id * 7) % 26)
        char2 = chr(65 + (track_id * 13) % 26)
        num = (track_id * 353) % 9000 + 1000
        return f"KA-{district:02d}-{char1}{char2}-{num:04d}"

    def register(self, centroid: Tuple[float, float], bbox: Tuple[float, float, float, float], vehicle_class: str) -> int:
        track_id = self.next_id
        self.history[track_id] = [centroid]
        self.disappeared[track_id] = 0
        self.bboxes[track_id] = bbox
        self.classes[track_id] = vehicle_class
        self.next_id += 1
        return track_id

    def deregister(self, track_id: int):
        if track_id in self.history:
            del self.history[track_id]
        if track_id in self.disappeared:
            del self.disappeared[track_id]
        if track_id in self.bboxes:
            del self.bboxes[track_id]
        if track_id in self.classes:
            del self.classes[track_id]

    def update(self, rects: List[Tuple[Tuple[float, float, float, float], str]]) -> List[Dict]:
        """
        rects is a list of tuples: ((x1, y1, x2, y2), vehicle_class)
        """
        # If input rects is empty, mark all existing tracks as disappeared
        if len(rects) == 0:
            for track_id in list(self.disappeared.keys()):
                self.disappeared[track_id] += 1
                if self.disappeared[track_id] > self.max_disappeared:
                    self.deregister(track_id)
            return []

        input_centroids = []
        input_bboxes = []
        input_classes = []

        for bbox, v_class in rects:
            x1, y1, x2, y2 = bbox
            cx = (x1 + x2) / 2.0
            cy = (y1 + y2) / 2.0
            input_centroids.append((cx, cy))
            input_bboxes.append((x1, y1, x2, y2))
            input_classes.append(v_class)

        input_centroids = np.array(input_centroids)

        # If we have no active tracks, register all input detections
        if len(self.history) == 0:
            for i in range(len(input_centroids)):
                self.register(input_centroids[i], input_bboxes[i], input_classes[i])
        else:
            track_ids = list(self.history.keys())
            # Get latest centroid for each active track
            active_centroids = np.array([self.history[tid][-1] for tid in track_ids])

            # Compute Euclidean distances between all active track centroids and all input centroids
            dists = np.linalg.norm(active_centroids[:, np.newaxis] - input_centroids, axis=2)

            # Match based on minimum distance
            rows = dists.min(axis=1).argsort()
            cols = dists.argmin(axis=1)[rows]

            used_rows = set()
            used_cols = set()

            for row, col in zip(rows, cols):
                if row in used_rows or col in used_cols:
                    continue

                # If distance is too large, do not associate
                if dists[row, col] > self.max_distance:
                    continue

                track_id = track_ids[row]
                # Append to history, keeping max 10 points
                self.history[track_id].append(tuple(input_centroids[col]))
                if len(self.history[track_id]) > 10:
                    self.history[track_id].pop(0)

                self.bboxes[track_id] = input_bboxes[col]
                self.classes[track_id] = input_classes[col]
                self.disappeared[track_id] = 0

                used_rows.add(row)
                used_cols.add(col)

            # Handle unused rows (disappeared tracks)
            unused_rows = set(range(len(track_ids))) - used_rows
            for row in unused_rows:
                track_id = track_ids[row]
                self.disappeared[track_id] += 1
                if self.disappeared[track_id] > self.max_disappeared:
                    self.deregister(track_id)

            # Handle unused columns (new tracks)
            unused_cols = set(range(len(input_centroids))) - used_cols
            for col in unused_cols:
                self.register(input_centroids[col], input_bboxes[col], input_classes[col])

        # Prepare outputs with motion vectors
        outputs = []
        for tid in self.history.keys():
            history_pts = self.history[tid]
            centroid = history_pts[-1]
            bbox = self.bboxes[tid]
            v_class = self.classes[tid]

            # Compute direction vector if we have enough history (min 5 frames)
            direction_vector = None
            angle = None
            if len(history_pts) >= 5:
                # Latest minus 5 frames ago (index -5 or index 0 depending on length)
                past_idx = max(0, len(history_pts) - 5)
                past_centroid = history_pts[past_idx]
                dx = centroid[0] - past_centroid[0]
                dy = centroid[1] - past_centroid[1]
                
                # Normalize vector
                norm = np.linalg.norm([dx, dy])
                if norm > 0:
                    direction_vector = (float(dx / norm), float(dy / norm))
                else:
                    direction_vector = (0.0, 0.0)

                # Compute angle: 0 is Up (South->North), 90 is Right (West->East), etc.
                # Standard: np.arctan2(dx, -dy) gives Cartesian style with y inverted
                angle = float(np.degrees(np.arctan2(dx, -dy)) % 360)

            outputs.append({
                "track_id": tid,
                "bbox": bbox,
                "centroid": centroid,
                "class_name": v_class,
                "direction_vector": direction_vector,
                "angle": angle,
                "history": history_pts,
                "license_plate": self.generate_plate(tid)
            })

        return outputs
