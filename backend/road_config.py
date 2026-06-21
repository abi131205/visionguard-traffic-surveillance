import os
import json
import logging
from typing import List, Dict, Optional

ROADS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "roads.json")

def load_roads_config() -> List[Dict]:
    """
    Load intersection configurations from roads.json.
    """
    if not os.path.exists(ROADS_FILE):
        return []
    try:
        with open(ROADS_FILE, "r") as f:
            data = json.load(f)
            return data.get("intersections", [])
    except Exception as e:
        logging.error(f"Error loading roads config: {e}")
        return []

def save_roads_config(intersections: List[Dict]) -> bool:
    """
    Save intersection configurations to roads.json.
    """
    try:
        with open(ROADS_FILE, "w") as f:
            json.dump({"intersections": intersections}, f, indent=2)
        return True
    except Exception as e:
        logging.error(f"Error saving roads config: {e}")
        return False

def get_all_intersections() -> List[Dict]:
    return load_roads_config()

def get_intersection_by_id(intersection_id: str) -> Optional[Dict]:
    intersections = load_roads_config()
    for item in intersections:
        if item["id"] == intersection_id:
            return item
    return None

def add_intersection(new_item: Dict) -> bool:
    intersections = load_roads_config()
    # Check if duplicate id
    if any(item["id"] == new_item["id"] for item in intersections):
        return False
    intersections.append(new_item)
    return save_roads_config(intersections)

def update_intersection(intersection_id: str, updates: Dict) -> bool:
    intersections = load_roads_config()
    updated = False
    for i, item in enumerate(intersections):
        if item["id"] == intersection_id:
            # Apply updates
            for key, val in updates.items():
                if val is not None:
                    # Handle signal_cycle nested dict update if key matches
                    if key == "signal_cycle" and isinstance(val, dict):
                        item["signal_cycle"] = item.get("signal_cycle", {})
                        item["signal_cycle"].update(val)
                    else:
                        item[key] = val
            intersections[i] = item
            updated = True
            break
    if updated:
        return save_roads_config(intersections)
    return False

def delete_intersection(intersection_id: str) -> bool:
    intersections = load_roads_config()
    filtered = [item for item in intersections if item["id"] != intersection_id]
    if len(filtered) < len(intersections):
        return save_roads_config(filtered)
    return False
