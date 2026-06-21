from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime

class IncidentUpdate(BaseModel):
    status: str  # under_review / resolved / escalated / challan_issued

class IncidentResponse(BaseModel):
    id: str
    timestamp: datetime
    camera_id: str
    intersection: str
    vehicle_track_id: int
    vehicle_class: str
    license_plate: Optional[str] = None
    plate_confidence: Optional[float] = None
    violation_type: str
    severity: str
    confidence: float
    direction_vector_x: Optional[float] = None
    direction_vector_y: Optional[float] = None
    status: str
    annotated_frame: Optional[str] = None
    preprocessing_applied: Optional[str] = None
    inference_time_ms: float
    created_at: datetime

    class Config:
        from_attributes = True

class SignalCycle(BaseModel):
    red: int = 30
    green: int = 20
    amber: int = 5

class IntersectionCreate(BaseModel):
    id: str
    name: str
    allowed_direction_deg: float
    tolerance_deg: float = 30.0
    road_type: str
    stop_line_y: int = 480
    signal_cycle: SignalCycle
    no_parking_zones: List[List[List[int]]] = []
    active: bool = True

class IntersectionUpdate(BaseModel):
    name: Optional[str] = None
    allowed_direction_deg: Optional[float] = None
    tolerance_deg: Optional[float] = None
    road_type: Optional[str] = None
    stop_line_y: Optional[int] = None
    signal_cycle: Optional[SignalCycle] = None
    no_parking_zones: Optional[List[List[List[int]]]] = None
    active: Optional[bool] = None

class IntersectionResponse(BaseModel):
    id: str
    name: str
    allowed_direction_deg: float
    tolerance_deg: float
    road_type: str
    stop_line_y: int
    signal_cycle: SignalCycle
    no_parking_zones: List[List[List[int]]]
    active: bool

    class Config:
        from_attributes = True
