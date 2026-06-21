import socketio
import asyncio
import time
import logging
from typing import Dict, Any

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio)

# Global trackers for background emissions
active_connections = 0
frames_processed_total = 0
start_time = time.time()

# Tracks signal states for cameras: {camera_id: {"state": "RED"|"GREEN"|"AMBER", "timer": int}}
signal_states: Dict[str, Dict[str, Any]] = {}

@sio.event
async def connect(sid, environ):
    global active_connections
    active_connections += 1
    logging.info(f"Socket connected: {sid}. Active connections: {active_connections}")
    # Immediately emit current signal states to the newly connected client
    for cam_id, info in list(signal_states.items()):
        await sio.emit("signal_state_change", {
            "camera_id": cam_id,
            "signal": info["state"],
            "duration_seconds": info["timer"]
        }, to=sid)

@sio.event
async def disconnect(sid):
    global active_connections
    active_connections = max(0, active_connections - 1)
    logging.info(f"Socket disconnected: {sid}. Active connections: {active_connections}")

async def emit_violation(violation_payload: Dict[str, Any]):
    """
    Emit wrong-way or other violation alerts to frontend.
    """
    await sio.emit("violation_alert", violation_payload)

async def emit_frame(camera_id: str, frame_base64: str, detections_count: int, violations_count: int):
    """
    Throttle and emit the annotated frame Base64 string.
    """
    await sio.emit("annotated_frame", {
        "camera_id": camera_id,
        "frame_base64": frame_base64,
        "detections_count": detections_count,
        "violations_count": violations_count
    })

async def emit_processing_complete(job_id: str, total_violations: int, breakdown: Dict[str, int]):
    """
    Fired when a video processing job finishes.
    """
    await sio.emit("processing_complete", {
        "job_id": job_id,
        "total_violations": total_violations,
        "breakdown_by_type": breakdown
    })

# Background Task 1: System Status updates every 5 seconds
async def system_status_broadcaster(get_active_cameras_fn):
    """
    Broadcasts general server metrics every 5 seconds.
    """
    while True:
        try:
            uptime = int(time.time() - start_time)
            active_cams = get_active_cameras_fn()
            await sio.emit("system_status", {
                "active_cameras": active_cams,
                "uptime_seconds": uptime,
                "total_frames_processed": frames_processed_total
            })
        except Exception as e:
            logging.error(f"Error in status broadcaster: {e}")
        await asyncio.sleep(5.0)

# Background Task 2: Signal State manager (cycling signal lights)
async def traffic_signal_manager(get_cameras_fn):
    """
    Simulates signal changes per camera:
    Cycle: RED (30s) -> GREEN (20s) -> AMBER (5s)
    Uses durations defined in roads.json, or defaults.
    """
    while True:
        try:
            cameras = get_cameras_fn()
            for cam in cameras:
                cam_id = cam["id"]
                cycle_cfg = cam.get("signal_cycle", {"red": 30, "green": 20, "amber": 5})
                
                if cam_id not in signal_states:
                    # Initial state
                    signal_states[cam_id] = {
                        "state": "RED",
                        "timer": cycle_cfg["red"],
                        "last_change": time.time()
                    }
                    await sio.emit("signal_state_change", {
                        "camera_id": cam_id,
                        "signal": "RED",
                        "duration_seconds": cycle_cfg["red"]
                    })
                    continue
                    
                info = signal_states[cam_id]
                elapsed = time.time() - info["last_change"]
                
                # Check if current state timer has expired
                if elapsed >= info["timer"]:
                    # Transition logic
                    if info["state"] == "RED":
                        next_state = "GREEN"
                        next_timer = cycle_cfg.get("green", 20)
                    elif info["state"] == "GREEN":
                        next_state = "AMBER"
                        next_timer = cycle_cfg.get("amber", 5)
                    else: # AMBER -> RED
                        next_state = "RED"
                        next_timer = cycle_cfg.get("red", 30)
                        
                    signal_states[cam_id] = {
                        "state": next_state,
                        "timer": next_timer,
                        "last_change": time.time()
                    }
                    
                    await sio.emit("signal_state_change", {
                        "camera_id": cam_id,
                        "signal": next_state,
                        "duration_seconds": next_timer
                    })
        except Exception as e:
            logging.error(f"Error in traffic signal manager: {e}")
            
        await asyncio.sleep(1.0)
