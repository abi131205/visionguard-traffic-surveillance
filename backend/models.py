from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, Text
from database import Base

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String, primary_key=True)  # INC-YYYYMMDD-XXXX
    timestamp = Column(DateTime, default=datetime.utcnow)
    camera_id = Column(String, nullable=False)
    intersection = Column(String, nullable=False)
    vehicle_track_id = Column(Integer, nullable=False)
    vehicle_class = Column(String, nullable=False)  # Two-Wheeler, Four-Wheeler, Heavy Vehicle, Pedestrian
    license_plate = Column(String, nullable=True)  # KA-XX-XX-XXXX
    plate_confidence = Column(Float, nullable=True)
    violation_type = Column(String, nullable=False)  # Wrong-Side Driving, Helmet Non-Compliance, etc.
    severity = Column(String, nullable=False)  # HIGH / MEDIUM / LOW
    confidence = Column(Float, nullable=False)
    direction_vector_x = Column(Float, nullable=True)
    direction_vector_y = Column(Float, nullable=True)
    status = Column(String, default="under_review")  # under_review / resolved / escalated / challan_issued
    annotated_frame = Column(Text, nullable=True)  # Base64 JPEG string
    preprocessing_applied = Column(String, nullable=True)  # JSON-serialized list of enhancements
    inference_time_ms = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
