export interface Intersection {
  id: string;
  name: string;
  allowed_direction_deg: number;
  tolerance_deg: number;
  road_type: string;
  stop_line_y: number;
  signal_cycle: {
    red: number;
    green: number;
    amber: number;
  };
  no_parking_zones: number[][][];
  active: boolean;
}

export interface Incident {
  id: string;
  timestamp: string;
  camera_id: string;
  intersection: string;
  vehicle_track_id: number;
  vehicle_class: string;
  license_plate: string | null;
  plate_confidence: number | null;
  violation_type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  direction_vector_x: number | null;
  direction_vector_y: number | null;
  status: 'under_review' | 'resolved' | 'escalated' | 'challan_issued';
  annotated_frame: string | null;
  preprocessing_applied: string | null; // JSON string on backend
  inference_time_ms: number;
  created_at: string;
}

export interface SystemStatus {
  active_cameras: number;
  uptime_seconds: number;
  total_frames_processed: number;
}

export interface ViolationAlert extends Omit<Incident, 'preprocessing_applied' | 'inference_time_ms' | 'created_at'> {}

export interface SignalState {
  camera_id: string;
  signal: 'RED' | 'GREEN' | 'AMBER';
  duration_seconds: number;
}
