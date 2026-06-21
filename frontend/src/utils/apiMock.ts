import axios from 'axios';
import { 
  initialIntersections, 
  initialIncidents, 
  generateMockAnnotatedFrame, 
  populateInitialIncidentFrames 
} from './mockData';
import type { Intersection, Incident, SystemStatus } from '../types/index';

// Declare global flags on window for tracking offline demo status
declare global {
  interface Window {
    visionguard_offline: boolean;
    visionguard_use_ip: boolean;
  }
}

// Initialize database
let intersections: Intersection[] = [...initialIntersections];
let incidents: Incident[] = [];
let stats: SystemStatus & {
  total_detections: number;
  wrong_way_count: number;
  accuracy: number;
  avg_response_time: number;
  false_positive_rate: number;
  incidents_prevented: number;
  challans_issued_today: number;
} = {
  active_cameras: 6,
  uptime_seconds: 1240,
  total_frames_processed: 89400,
  total_detections: 124,
  wrong_way_count: 14,
  accuracy: 0.947,
  avg_response_time: 87.0,
  false_positive_rate: 0.043,
  incidents_prevented: 45,
  challans_issued_today: 18
};

// Populate default incidents with frames once running in browser
if (typeof window !== 'undefined') {
  populateInitialIncidentFrames();
  incidents = [...initialIncidents];
}

// Active jobs tracker
const activeJobs: Record<string, {
  status: string;
  frames_processed: number;
  total_frames: number;
  total_violations: number;
  camera_id: string;
}> = {};

// Helper to update statistics over time
if (typeof window !== 'undefined') {
  setInterval(() => {
    if (window.visionguard_offline) {
      stats.uptime_seconds += 1;
      stats.total_frames_processed += Math.floor(Math.random() * 20) + 10;
      if (Math.random() > 0.98) {
        stats.total_detections += 1;
        stats.incidents_prevented += 1;
        if (Math.random() > 0.5) stats.challans_issued_today += 1;
      }
    }
  }, 1000);
}

// Create a custom Axios mock adapter
const mockAdapter = (config: any) => {
  return new Promise((resolve, reject) => {
    const url = config.url || '';
    const method = (config.method || 'get').toLowerCase();
    const headers = { 'content-type': 'application/json' };

    // Helper: parse ID from URL (e.g., /api/incidents/INC-123 -> INC-123)
    const getUrlId = (prefix: string) => {
      const idx = url.indexOf(prefix);
      if (idx !== -1) {
        const remaining = url.substring(idx + prefix.length);
        return remaining.split('?')[0].split('/')[0];
      }
      return '';
    };

    const makeResponse = (data: any, statusCode = 200) => {
      resolve({
        data,
        status: statusCode,
        statusText: 'OK',
        headers,
        config
      });
    };

    // 1. Stats endpoint
    if (url.includes('/api/stats')) {
      return makeResponse({
        ...stats,
        wrong_way_count: incidents.filter(i => i.violation_type === 'Wrong-Side Driving').length
      });
    }

    // 2. Intersections CRUD
    if (url.includes('/api/intersections')) {
      const id = getUrlId('/api/intersections/');
      if (id) {
        const index = intersections.findIndex(i => i.id === id);
        if (method === 'patch') {
          if (index !== -1) {
            const body = JSON.parse(config.data || '{}');
            intersections[index] = { ...intersections[index], ...body };
            return makeResponse(intersections[index]);
          }
          return reject({ response: { status: 404, data: { detail: 'Intersection not found' } } });
        }
        if (method === 'delete') {
          if (index !== -1) {
            intersections = intersections.filter(i => i.id !== id);
            return makeResponse({ success: true });
          }
          return reject({ response: { status: 404, data: { detail: 'Intersection not found' } } });
        }
      }

      if (method === 'post') {
        const body = JSON.parse(config.data || '{}');
        const newInt: Intersection = {
          id: body.id || `CAM-BTP-00${intersections.length + 1}`,
          name: body.name || 'New Junction',
          allowed_direction_deg: body.allowed_direction_deg ?? 0,
          tolerance_deg: body.tolerance_deg ?? 30,
          road_type: body.road_type || 'One-Way',
          stop_line_y: body.stop_line_y ?? 480,
          signal_cycle: body.signal_cycle || { red: 30, green: 20, amber: 5 },
          no_parking_zones: body.no_parking_zones || [],
          active: true
        };
        intersections.push(newInt);
        return makeResponse(newInt);
      }

      // Default GET list
      return makeResponse(intersections);
    }

    // 3. Incidents CRUD
    if (url.includes('/api/incidents')) {
      const id = getUrlId('/api/incidents/');
      if (id && method === 'patch') {
        const index = incidents.findIndex(i => i.id === id);
        if (index !== -1) {
          const body = JSON.parse(config.data || '{}');
          incidents[index] = { ...incidents[index], ...body };
          return makeResponse(incidents[index]);
        }
        return reject({ response: { status: 404, data: { detail: 'Incident not found' } } });
      }

      // Default GET list
      // Sort by timestamp desc
      const sorted = [...incidents].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return makeResponse(sorted);
    }

    // 4. Analytics: daily trends
    if (url.includes('/api/analytics/daily')) {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const data = days.map((day, idx) => {
        const offset = (6 - idx) * 24 * 60 * 60 * 1000;
        const dateStr = new Date(Date.now() - offset).toISOString().split('T')[0];
        return {
          date: dateStr,
          'Wrong-Side Driving': 3 + (idx % 3),
          'Helmet Non-Compliance': 10 + (idx * 2),
          'Seatbelt Non-Compliance': 4 + (idx % 2),
          'Triple Riding': 2 + (idx % 4),
          'Stop-Line Violation': 8 + (idx % 3),
          'Red-Light Violation': 5 + (idx % 5),
          'Illegal Parking': 2 + (idx % 2)
        };
      });
      return makeResponse(data);
    }

    // 5. Analytics: hourly trends
    if (url.includes('/api/analytics/hourly')) {
      const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
      const data = hours.map((hour, idx) => ({
        hour,
        'Wrong-Side Driving': 1 + (idx % 2),
        'Helmet Non-Compliance': 3 + (idx % 4),
        'Seatbelt Non-Compliance': 2 + (idx % 3),
        'Triple Riding': 1 + (idx % 2),
        'Stop-Line Violation': 4 + (idx % 3),
        'Red-Light Violation': 2 + (idx % 4),
        'Illegal Parking': 1 + (idx % 2)
      }));
      return makeResponse(data);
    }

    // 6. Analytics: violation breakdown
    if (url.includes('/api/analytics/violation-breakdown')) {
      const types = [
        "Wrong-Side Driving",
        "Helmet Non-Compliance",
        "Seatbelt Non-Compliance",
        "Triple Riding",
        "Stop-Line Violation",
        "Red-Light Violation",
        "Illegal Parking"
      ];
      const data = types.map(t => {
        const count = incidents.filter(i => i.violation_type === t).length;
        return {
          name: t,
          value: count > 0 ? count : Math.floor(Math.random() * 15) + 5
        };
      });
      return makeResponse(data);
    }

    // 7. Metrics evaluation
    if (url.includes('/api/metrics')) {
      return makeResponse({
        f1_score: 0.924,
        mAP_50: 0.912,
        mAP_50_95: 0.724,
        precision: 0.932,
        recall: 0.916
      });
    }

    // 8. Upload single image
    if (url.includes('/api/upload-image')) {
      // Mock processing delay
      setTimeout(() => {
        const randIndex = Math.floor(Math.random() * intersections.length);
        const cam = intersections[randIndex];
        
        // Randomly pick a violation class for this image
        const violationTypes = [
          "Seatbelt Non-Compliance", 
          "Wrong-Side Driving", 
          "Helmet Non-Compliance",
          "Stop-Line Violation",
          "Red-Light Violation"
        ];
        const chosenViolation = violationTypes[Math.floor(Math.random() * violationTypes.length)];
        const frame = generateMockAnnotatedFrame(cam.name, [chosenViolation]);

        const newInc: Incident = {
          id: `INC-2026-${Math.floor(Math.random() * 9000) + 1000}`,
          timestamp: new Date().toISOString(),
          camera_id: cam.id,
          intersection: cam.name,
          vehicle_track_id: Math.floor(Math.random() * 500) + 1,
          vehicle_class: chosenViolation.includes('Helmet') || chosenViolation.includes('Triple') ? "motorcycle" : "car",
          license_plate: "KA-53-EX-" + (Math.floor(Math.random() * 9000) + 1000),
          plate_confidence: 0.92,
          violation_type: chosenViolation,
          severity: chosenViolation.includes('Wrong-Side') || chosenViolation.includes('Red-Light') ? "HIGH" : "MEDIUM",
          confidence: 0.95,
          direction_vector_x: 0.2,
          direction_vector_y: -0.9,
          status: "under_review",
          annotated_frame: frame,
          preprocessing_applied: JSON.stringify({ CLAHE: true, grayscale: false }),
          inference_time_ms: 110,
          created_at: new Date().toISOString()
        };

        // Add to incidents database
        incidents.unshift(newInc);

        makeResponse({
          annotated_frame: frame,
          violations: [{
            box: [100, 100, 200, 200],
            class: chosenViolation.includes('Helmet') || chosenViolation.includes('Triple') ? "motorcycle" : "car",
            confidence: 0.95,
            violation: chosenViolation
          }],
          processing_time_ms: 110
        });
      }, 1000);
      return;
    }

    // 9. Upload video
    if (url.includes('/api/upload-video')) {
      const jobId = `job-${Math.floor(Math.random() * 900000) + 100000}`;
      const body = config.data; // FormData contains camera_id
      let cameraId = 'CAM-BTP-001';
      if (body && typeof body.get === 'function') {
        cameraId = body.get('camera_id') || cameraId;
      }
      activeJobs[jobId] = {
        status: 'processing',
        frames_processed: 0,
        total_frames: 180,
        total_violations: 0,
        camera_id: cameraId
      };

      // Start simulating job progress
      const jobInterval = setInterval(() => {
        const job = activeJobs[jobId];
        if (!job) {
          clearInterval(jobInterval);
          return;
        }

        job.frames_processed += 30;
        
        // Randomly inject a violation during video processing
        if (Math.random() > 0.6) {
          job.total_violations += 1;
          const cam = intersections.find(c => c.id === job.camera_id) || intersections[0];
          const violationTypes = ["Wrong-Side Driving", "Helmet Non-Compliance", "Stop-Line Violation", "Red-Light Violation", "Triple Riding"];
          const chosenViolation = violationTypes[Math.floor(Math.random() * violationTypes.length)];
          const frame = generateMockAnnotatedFrame(cam.name, [chosenViolation]);

          const newInc: Incident = {
            id: `INC-2026-${Math.floor(Math.random() * 9000) + 1000}`,
            timestamp: new Date().toISOString(),
            camera_id: cam.id,
            intersection: cam.name,
            vehicle_track_id: Math.floor(Math.random() * 500) + 1,
            vehicle_class: chosenViolation.includes('Helmet') || chosenViolation.includes('Triple') ? "motorcycle" : "car",
            license_plate: "KA-03-TR-" + (Math.floor(Math.random() * 9000) + 1000),
            plate_confidence: 0.91,
            violation_type: chosenViolation,
            severity: chosenViolation.includes('Wrong-Side') || chosenViolation.includes('Red-Light') ? "HIGH" : "MEDIUM",
            confidence: 0.94,
            direction_vector_x: 0.1,
            direction_vector_y: -0.9,
            status: "under_review",
            annotated_frame: frame,
            preprocessing_applied: null,
            inference_time_ms: 82,
            created_at: new Date().toISOString()
          };
          incidents.unshift(newInc);

          // Dispatch violation event globally to any listeners (mock socket)
          if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('mock_violation_alert', { detail: newInc }));
          }
        }

        if (job.frames_processed >= job.total_frames) {
          job.status = 'completed';
          clearInterval(jobInterval);
          
          if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('mock_processing_complete', { 
              detail: { job_id: jobId, total_violations: job.total_violations } 
            }));
          }
        }
      }, 1000);

      return makeResponse({ job_id: jobId });
    }

    // 10. Job status
    if (url.includes('/api/job/')) {
      const jobId = getUrlId('/api/job/');
      const job = activeJobs[jobId];
      if (job) {
        return makeResponse(job);
      }
      return reject({ response: { status: 404, data: { detail: 'Job not found' } } });
    }

    // Catch all unhandled requests in offline mode
    reject({ response: { status: 404, data: { detail: 'Not Found in offline simulation mode' } } });
  });
};

// Global Axios Request Interceptor
axios.interceptors.request.use((config) => {
  if (window.visionguard_offline) {
    // Override adapter to intercept request and bypass network
    config.adapter = mockAdapter;
  } else if (window.visionguard_use_ip) {
    // Rewrite localhost:8000 to 127.0.0.1:8000 to avoid IPv6 loopback routing failures on Windows
    if (config.url && config.url.includes('http://localhost:8000')) {
      config.url = config.url.replace('http://localhost:8000', 'http://127.0.0.1:8000');
    }
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Perform a native check to determine if the backend server is running
export async function detectBackendOnline(): Promise<boolean> {
  // If the protocol is HTTPS (e.g. Vercel deployment), browser security blocks mixed content requests to http://localhost:8000.
  // In that case, we MUST run in offline simulation mode immediately because the browser won't even let the fetch go through.
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    window.visionguard_offline = true;
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout limit

  // 1. Try resolving localhost:8000 (IPv6 / standard DNS)
  try {
    const response = await fetch('http://localhost:8000/api/stats', {
      method: 'GET',
      signal: controller.signal,
      mode: 'cors'
    });
    if (response.ok) {
      clearTimeout(timeoutId);
      window.visionguard_offline = false;
      window.visionguard_use_ip = false;
      return true;
    }
  } catch (e) {
    // localhost failed, proceed to try raw IPv4 address
  }

  // 2. Try resolving 127.0.0.1:8000 (forces IPv4 routing directly to Python Uvicorn binding)
  try {
    const response = await fetch('http://127.0.0.1:8000/api/stats', {
      method: 'GET',
      signal: controller.signal,
      mode: 'cors'
    });
    if (response.ok) {
      clearTimeout(timeoutId);
      window.visionguard_offline = false;
      window.visionguard_use_ip = true;
      return true;
    }
  } catch (e) {
    // Both attempts failed
  }

  clearTimeout(timeoutId);
  if (typeof window !== 'undefined') {
    window.visionguard_offline = true;
  }
  return false;
}
