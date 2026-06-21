import type { Intersection, Incident, SystemStatus } from '../types/index';

// 1. Initial list of intersections matching roads.json
export const initialIntersections: Intersection[] = [
  {
    id: "CAM-BTP-001",
    name: "Silk Board Junction",
    allowed_direction_deg: 0,
    tolerance_deg: 30,
    road_type: "One-Way (South → North)",
    stop_line_y: 480,
    signal_cycle: { red: 30, green: 20, amber: 5 },
    no_parking_zones: [[[50, 400], [200, 400], [200, 550], [50, 550]]],
    active: true
  },
  {
    id: "CAM-BTP-002",
    name: "Marathahalli Bridge",
    allowed_direction_deg: 90,
    tolerance_deg: 30,
    road_type: "One-Way (West → East)",
    stop_line_y: 500,
    signal_cycle: { red: 30, green: 25, amber: 5 },
    no_parking_zones: [[[400, 100], [600, 100], [600, 300], [400, 300]]],
    active: true
  },
  {
    id: "CAM-BTP-003",
    name: "KR Puram Junction",
    allowed_direction_deg: 180,
    tolerance_deg: 30,
    road_type: "One-Way (North → South)",
    stop_line_y: 450,
    signal_cycle: { red: 40, green: 30, amber: 5 },
    no_parking_zones: [],
    active: true
  },
  {
    id: "CAM-BTP-004",
    name: "Hebbal Flyover",
    allowed_direction_deg: 270,
    tolerance_deg: 30,
    road_type: "One-Way (East → West)",
    stop_line_y: 520,
    signal_cycle: { red: 25, green: 20, amber: 5 },
    no_parking_zones: [[[100, 200], [300, 200], [300, 400], [100, 400]]],
    active: true
  },
  {
    id: "CAM-BTP-005",
    name: "Electronic City Toll",
    allowed_direction_deg: 0,
    tolerance_deg: 30,
    road_type: "One-Way (South → North)",
    stop_line_y: 460,
    signal_cycle: { red: 35, green: 25, amber: 5 },
    no_parking_zones: [],
    active: true
  },
  {
    id: "CAM-BTP-006",
    name: "Koramangala 5th Block",
    allowed_direction_deg: 90,
    tolerance_deg: 30,
    road_type: "One-Way (West → East)",
    stop_line_y: 490,
    signal_cycle: { red: 30, green: 20, amber: 5 },
    no_parking_zones: [[[200, 450], [450, 450], [450, 600], [200, 600]]],
    active: true
  }
];

// Helper to generate a simulated annotated frame on canvas
export function generateMockAnnotatedFrame(cameraName: string, violationTypes: string[], signalColor: 'RED' | 'GREEN' | 'AMBER' = 'GREEN'): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 1. Background (Asphalt Road)
  ctx.fillStyle = '#2B2D42';
  ctx.fillRect(0, 0, 640, 480);

  // Perspective lane boundaries
  ctx.strokeStyle = '#8D99AE';
  ctx.lineWidth = 2;
  
  ctx.beginPath();
  ctx.moveTo(80, 480);
  ctx.lineTo(260, 150);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(560, 480);
  ctx.lineTo(380, 150);
  ctx.stroke();

  // Dashed divider line
  ctx.strokeStyle = '#F4A261';
  ctx.lineWidth = 3;
  ctx.setLineDash([15, 15]);
  ctx.beginPath();
  ctx.moveTo(320, 480);
  ctx.lineTo(320, 150);
  ctx.stroke();
  ctx.setLineDash([]);

  // White stop line
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(160, 400);
  ctx.lineTo(480, 400);
  ctx.stroke();

  // 2. Info HUD
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.fillRect(15, 15, 250, 65);
  ctx.strokeStyle = '#E7DED2';
  ctx.lineWidth = 1;
  ctx.strokeRect(15, 15, 250, 65);

  ctx.fillStyle = '#F8F4EE';
  ctx.font = 'bold 10px monospace';
  ctx.fillText(`CAM SOURCE : ${cameraName}`, 25, 33);
  ctx.fillText(`TIMESTAMP  : ${new Date().toLocaleTimeString()}`, 25, 48);
  ctx.fillText(`SURVEIL    : SIMULATION ACTIVE`, 25, 63);

  // 3. Vehicles & Bounding Boxes
  // Draw one regular car
  ctx.fillStyle = '#577590';
  ctx.fillRect(180, 240, 70, 50);
  ctx.strokeStyle = '#6B8F71'; // Green box (no violation)
  ctx.lineWidth = 2;
  ctx.strokeRect(180, 240, 70, 50);
  ctx.fillStyle = '#6B8F71';
  ctx.fillRect(180, 225, 60, 15);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 9px sans-serif';
  ctx.fillText('CAR: 93%', 184, 236);

  // Draw violation objects
  if (violationTypes.includes('Wrong-Side Driving')) {
    // Red bounding box for Wrong-Side car
    ctx.fillStyle = '#BC6C25';
    ctx.fillRect(380, 310, 85, 70);
    ctx.strokeStyle = '#BC6C25';
    ctx.lineWidth = 3;
    ctx.strokeRect(380, 310, 85, 70);
    ctx.fillStyle = '#BC6C25';
    ctx.fillRect(380, 290, 130, 20);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('WRONG-WAY CAR: 97%', 384, 303);
    
    // Vector Arrow overlay
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(422, 360);
    ctx.lineTo(422, 330);
    ctx.lineTo(415, 337);
    ctx.moveTo(422, 330);
    ctx.lineTo(429, 337);
    ctx.stroke();
  } 
  
  if (violationTypes.includes('Stop-Line Violation')) {
    // Car overlapping stop line
    ctx.fillStyle = '#A47148';
    ctx.fillRect(270, 370, 90, 70);
    ctx.strokeStyle = '#BC6C25';
    ctx.lineWidth = 3;
    ctx.strokeRect(270, 370, 90, 70);
    ctx.fillStyle = '#BC6C25';
    ctx.fillRect(270, 350, 150, 20);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('STOP-LINE COMPLY: FAIL', 274, 363);
  }

  if (violationTypes.includes('Helmet Non-Compliance')) {
    // Motorcycle without helmet
    ctx.fillStyle = '#A47148';
    ctx.fillRect(300, 230, 45, 65);
    ctx.strokeStyle = '#BC6C25';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(300, 230, 45, 65);
    ctx.fillStyle = '#BC6C25';
    ctx.fillRect(300, 212, 110, 18);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('NO HELMET: 92%', 304, 225);

    // Motorcycle wheels/riders
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(322, 280, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFE0B2'; // face
    ctx.beginPath();
    ctx.arc(322, 245, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (violationTypes.includes('Seatbelt Non-Compliance')) {
    // Windshield Close-up
    ctx.fillStyle = '#1B263B';
    ctx.fillRect(0, 0, 640, 480);
    
    // Windshield frame
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(80, 80, 480, 320);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(100, 100, 440, 280);

    // Silhouettes
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.ellipse(220, 260, 40, 60, 0, 0, Math.PI * 2); // driver
    ctx.ellipse(420, 260, 40, 60, 0, 0, Math.PI * 2); // passenger
    ctx.fill();

    // Violation Box
    ctx.strokeStyle = '#BC6C25';
    ctx.lineWidth = 3;
    ctx.strokeRect(170, 190, 100, 130);
    ctx.fillStyle = '#BC6C25';
    ctx.fillRect(170, 168, 140, 22);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('NO SEATBELT: 94%', 175, 183);
  }

  if (violationTypes.includes('Triple Riding')) {
    // Motorcycle with 3 riders
    ctx.fillStyle = '#A47148';
    ctx.fillRect(290, 240, 50, 75);
    ctx.strokeStyle = '#BC6C25';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(290, 240, 50, 75);
    ctx.fillStyle = '#BC6C25';
    ctx.fillRect(290, 222, 120, 18);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('TRIPLE RIDING: 96%', 294, 235);

    // Draw wheels and heads
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(315, 305, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFD166';
    ctx.beginPath();
    ctx.arc(315, 252, 4, 0, Math.PI * 2);
    ctx.arc(315, 264, 4, 0, Math.PI * 2);
    ctx.arc(315, 276, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (violationTypes.includes('Red-Light Violation')) {
    // Red Light Overstepping
    ctx.fillStyle = '#BC6C25';
    ctx.fillRect(260, 360, 85, 75);
    ctx.strokeStyle = '#BC6C25';
    ctx.lineWidth = 3;
    ctx.strokeRect(260, 360, 85, 75);
    ctx.fillStyle = '#BC6C25';
    ctx.fillRect(260, 340, 130, 20);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('RED LIGHT CRITICAL', 264, 353);
  }

  if (violationTypes.includes('Illegal Parking')) {
    // Shoulder Zone
    ctx.fillStyle = 'rgba(239, 35, 60, 0.15)';
    ctx.fillRect(50, 280, 120, 180);
    ctx.strokeStyle = '#EF233C';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(50, 280, 120, 180);

    ctx.fillStyle = '#A47148';
    ctx.fillRect(70, 310, 80, 90);
    ctx.strokeStyle = '#BC6C25';
    ctx.lineWidth = 3;
    ctx.strokeRect(70, 310, 80, 90);
    ctx.fillStyle = '#BC6C25';
    ctx.fillRect(70, 288, 120, 22);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('PARKING VIOLATION', 74, 303);
  }

  // 4. Traffic Signal Light Tower
  ctx.fillStyle = '#111111';
  ctx.fillRect(580, 120, 26, 80);
  
  ctx.fillStyle = signalColor === 'RED' ? '#EF233C' : '#3C1014';
  ctx.beginPath();
  ctx.arc(593, 133, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = signalColor === 'AMBER' ? '#D4A373' : '#3C2C15';
  ctx.beginPath();
  ctx.arc(593, 160, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = signalColor === 'GREEN' ? '#6B8F71' : '#142E1B';
  ctx.beginPath();
  ctx.arc(593, 187, 7, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toDataURL('image/jpeg').split(',')[1];
}

// 2. Pre-generate historical incidents (10 realistic rows)
export const initialIncidents: Incident[] = [
  {
    id: "INC-2026-9041",
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    camera_id: "CAM-BTP-001",
    intersection: "Silk Board Junction",
    vehicle_track_id: 104,
    vehicle_class: "car",
    license_plate: "KA-03-HA-8821",
    plate_confidence: 0.94,
    violation_type: "Wrong-Side Driving",
    severity: "HIGH",
    confidence: 0.96,
    direction_vector_x: 0.12,
    direction_vector_y: -0.98,
    status: "under_review",
    annotated_frame: null, // Generated dynamically
    preprocessing_applied: JSON.stringify({ CLAHE: true, grayscale: false }),
    inference_time_ms: 84.5,
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString()
  },
  {
    id: "INC-2026-9042",
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    camera_id: "CAM-BTP-002",
    intersection: "Marathahalli Bridge",
    vehicle_track_id: 421,
    vehicle_class: "motorcycle",
    license_plate: "KA-51-MB-4029",
    plate_confidence: 0.88,
    violation_type: "Helmet Non-Compliance",
    severity: "MEDIUM",
    confidence: 0.91,
    direction_vector_x: 0.98,
    direction_vector_y: 0.11,
    status: "resolved",
    annotated_frame: null,
    preprocessing_applied: JSON.stringify({ CLAHE: false, grayscale: false }),
    inference_time_ms: 76.2,
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString()
  },
  {
    id: "INC-2026-9043",
    timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    camera_id: "CAM-BTP-001",
    intersection: "Silk Board Junction",
    vehicle_track_id: 148,
    vehicle_class: "car",
    license_plate: "KA-01-PD-0092",
    plate_confidence: 0.97,
    violation_type: "Seatbelt Non-Compliance",
    severity: "MEDIUM",
    confidence: 0.94,
    direction_vector_x: 0.05,
    direction_vector_y: 0.99,
    status: "challan_issued",
    annotated_frame: null,
    preprocessing_applied: JSON.stringify({ CLAHE: true, grayscale: true }),
    inference_time_ms: 110.8,
    created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString()
  },
  {
    id: "INC-2026-9044",
    timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    camera_id: "CAM-BTP-003",
    intersection: "KR Puram Junction",
    vehicle_track_id: 59,
    vehicle_class: "motorcycle",
    license_plate: "KA-04-EX-7788",
    plate_confidence: 0.92,
    violation_type: "Triple Riding",
    severity: "HIGH",
    confidence: 0.95,
    direction_vector_x: -0.15,
    direction_vector_y: 0.98,
    status: "under_review",
    annotated_frame: null,
    preprocessing_applied: JSON.stringify({ CLAHE: false, grayscale: false }),
    inference_time_ms: 81.3,
    created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString()
  },
  {
    id: "INC-2026-9045",
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    camera_id: "CAM-BTP-004",
    intersection: "Hebbal Flyover",
    vehicle_track_id: 88,
    vehicle_class: "car",
    license_plate: "DL-3C-AS-4509",
    plate_confidence: 0.95,
    violation_type: "Stop-Line Violation",
    severity: "LOW",
    confidence: 0.89,
    direction_vector_x: -0.99,
    direction_vector_y: -0.05,
    status: "resolved",
    annotated_frame: null,
    preprocessing_applied: JSON.stringify({ CLAHE: true, grayscale: false }),
    inference_time_ms: 92.4,
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString()
  },
  {
    id: "INC-2026-9046",
    timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    camera_id: "CAM-BTP-006",
    intersection: "Koramangala 5th Block",
    vehicle_track_id: 202,
    vehicle_class: "car",
    license_plate: "KA-05-MM-1234",
    plate_confidence: 0.91,
    violation_type: "Illegal Parking",
    severity: "LOW",
    confidence: 0.93,
    direction_vector_x: null,
    direction_vector_y: null,
    status: "under_review",
    annotated_frame: null,
    preprocessing_applied: null,
    inference_time_ms: 68.1,
    created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString()
  },
  {
    id: "INC-2026-9047",
    timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    camera_id: "CAM-BTP-001",
    intersection: "Silk Board Junction",
    vehicle_track_id: 304,
    vehicle_class: "car",
    license_plate: "KA-03-NZ-4410",
    plate_confidence: 0.89,
    violation_type: "Red-Light Violation",
    severity: "HIGH",
    confidence: 0.95,
    direction_vector_x: 0.0,
    direction_vector_y: 1.0,
    status: "escalated",
    annotated_frame: null,
    preprocessing_applied: JSON.stringify({ CLAHE: true, grayscale: false }),
    inference_time_ms: 88.0,
    created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString()
  }
];

// Initialize default annotated frames (since we are in the browser, we generate these lazily)
export function populateInitialIncidentFrames() {
  initialIncidents.forEach((inc) => {
    if (!inc.annotated_frame) {
      inc.annotated_frame = generateMockAnnotatedFrame(inc.intersection, [inc.violation_type]);
    }
  });
}
