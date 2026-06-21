import { initialIntersections, generateMockAnnotatedFrame } from './mockData';
import type { Incident, SignalState, SystemStatus } from '../types/index';

export class MockSocket {
  private callbacks: Record<string, Function[]> = {};
  private timers: any[] = [];
  private cameraSignals: Record<string, { signal: 'RED' | 'GREEN' | 'AMBER'; timeLeft: number }> = {};
  private activeCameraIds = initialIntersections.map(i => i.id);

  constructor() {
    // Initialize traffic signals
    initialIntersections.forEach(cam => {
      this.cameraSignals[cam.id] = {
        signal: Math.random() > 0.5 ? 'GREEN' : 'RED',
        timeLeft: Math.floor(Math.random() * 20) + 5
      };
    });

    // Start simulation loops
    this.startSignalLoop();
    this.startSystemStatusLoop();
    this.startLiveViolationFeed();
    this.listenToWindowEvents();
  }

  on(event: string, callback: Function) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);

    // If registering connect callback, trigger it immediately in offline mode
    if (event === 'connect') {
      const t = setTimeout(() => {
        this.trigger('connect');
      }, 300);
      this.timers.push(t);
    }
  }

  off(event: string, callback?: Function) {
    if (!callback) {
      delete this.callbacks[event];
    } else if (this.callbacks[event]) {
      this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
    }
  }

  disconnect() {
    this.timers.forEach(t => clearInterval(t));
    this.callbacks = {};
    
    // Remove window event listeners
    window.removeEventListener('mock_violation_alert', this.handleMockViolation as any);
    window.removeEventListener('mock_processing_complete', this.handleMockProcessingComplete as any);
  }

  private trigger(event: string, data?: any) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data));
    }
  }

  // Signal State machine loop
  private startSignalLoop() {
    const interval = setInterval(() => {
      Object.keys(this.cameraSignals).forEach(camId => {
        const cam = initialIntersections.find(c => c.id === camId);
        if (!cam) return;

        const state = this.cameraSignals[camId];
        state.timeLeft -= 1;

        if (state.timeLeft <= 0) {
          // Transition: RED -> GREEN -> AMBER -> RED
          if (state.signal === 'RED') {
            state.signal = 'GREEN';
            state.timeLeft = cam.signal_cycle.green;
          } else if (state.signal === 'GREEN') {
            state.signal = 'AMBER';
            state.timeLeft = cam.signal_cycle.amber;
          } else {
            state.signal = 'RED';
            state.timeLeft = cam.signal_cycle.red;
          }

          // Trigger change event
          this.trigger('signal_state_change', {
            camera_id: camId,
            signal: state.signal,
            duration_seconds: state.timeLeft
          } as SignalState);
        }
      });
    }, 1000);

    this.timers.push(interval);
  }

  // System Stats periodic broadcast
  private startSystemStatusLoop() {
    let frameCounter = 89400;
    let secondsCounter = 1240;

    const interval = setInterval(() => {
      secondsCounter += 2;
      frameCounter += Math.floor(Math.random() * 40) + 20;

      this.trigger('system_status', {
        active_cameras: 6,
        uptime_seconds: secondsCounter,
        total_frames_processed: frameCounter
      } as SystemStatus);
    }, 2000);

    this.timers.push(interval);
  }

  // Live monitor feed for CCTV annotated frames & random violations
  private startLiveViolationFeed() {
    // 1. Send live frame stream every 1.5 seconds for the active camera view
    const frameInterval = setInterval(() => {
      // Find what camera is selected by checking window state or default to CAM-BTP-001
      const activeCamId = this.getCurrentCameraView();
      const cam = initialIntersections.find(c => c.id === activeCamId) || initialIntersections[0];
      const signalState = this.cameraSignals[activeCamId]?.signal || 'GREEN';

      // Draw a standard clear flow frame (no violations)
      const frameBase64 = generateMockAnnotatedFrame(cam.name, [], signalState);
      
      this.trigger('annotated_frame', {
        camera_id: activeCamId,
        frame_base64: frameBase64,
        detections_count: Math.floor(Math.random() * 4) + 1
      });
    }, 1500);

    this.timers.push(frameInterval);

    // 2. Periodic random traffic violations generator (every 16-24 seconds)
    const violationSchedule = () => {
      const delay = (Math.floor(Math.random() * 8) + 16) * 1000;
      const timeout = setTimeout(() => {
        this.generateRandomViolation();
        violationSchedule();
      }, delay);
      this.timers.push(timeout);
    };

    violationSchedule();
  }

  // Generates a mock incident and broadcasts it via websocket
  private generateRandomViolation() {
    const camId = this.activeCameraIds[Math.floor(Math.random() * this.activeCameraIds.length)];
    const cam = initialIntersections.find(c => c.id === camId) || initialIntersections[0];
    const signalState = this.cameraSignals[camId]?.signal || 'GREEN';

    const violationTypes = [
      "Helmet Non-Compliance",
      "Wrong-Side Driving",
      "Seatbelt Non-Compliance",
      "Stop-Line Violation",
      "Triple Riding",
      "Red-Light Violation"
    ];
    
    // Choose violation type
    let chosenViolation = violationTypes[Math.floor(Math.random() * violationTypes.length)];
    
    // Force stop-line/red-light violations during RED signal cycles
    if (signalState === 'RED' && Math.random() > 0.4) {
      chosenViolation = Math.random() > 0.5 ? 'Red-Light Violation' : 'Stop-Line Violation';
    }

    const frameBase64 = generateMockAnnotatedFrame(cam.name, [chosenViolation], signalState);

    const newViolation: Incident = {
      id: `INC-2026-${Math.floor(Math.random() * 9000) + 1000}`,
      timestamp: new Date().toISOString(),
      camera_id: cam.id,
      intersection: cam.name,
      vehicle_track_id: Math.floor(Math.random() * 400) + 10,
      vehicle_class: chosenViolation.includes('Helmet') || chosenViolation.includes('Triple') ? "motorcycle" : "car",
      license_plate: "KA-03-HA-" + (Math.floor(Math.random() * 9000) + 1000),
      plate_confidence: 0.93,
      violation_type: chosenViolation,
      severity: chosenViolation.includes('Wrong-Side') || chosenViolation.includes('Red-Light') ? 'HIGH' : 'MEDIUM',
      confidence: 0.95,
      direction_vector_x: 0.15,
      direction_vector_y: -0.95,
      status: "under_review",
      annotated_frame: frameBase64,
      preprocessing_applied: JSON.stringify({ CLAHE: true, grayscale: false }),
      inference_time_ms: 85,
      created_at: new Date().toISOString()
    };

    // Trigger violation alert
    this.trigger('violation_alert', newViolation);

    // Also push a live annotated frame instantly for this camera view
    if (this.getCurrentCameraView() === camId) {
      this.trigger('annotated_frame', {
        camera_id: camId,
        frame_base64: frameBase64,
        detections_count: 3
      });
    }
  }

  // Find currently selected camera from UI context
  private getCurrentCameraView(): string {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('visionguard_selected_camera');
      if (saved) return saved;
    }
    return 'CAM-BTP-001';
  }

  // Sync window events from mock Axios adapter
  private handleMockViolation = (e: Event) => {
    const customEvent = e as CustomEvent<Incident>;
    this.trigger('violation_alert', customEvent.detail);
  };

  private handleMockProcessingComplete = (e: Event) => {
    const customEvent = e as CustomEvent<{ job_id: string; total_violations: number }>;
    this.trigger('processing_complete', customEvent.detail);
  };

  private listenToWindowEvents() {
    window.addEventListener('mock_violation_alert', this.handleMockViolation as any);
    window.addEventListener('mock_processing_complete', this.handleMockProcessingComplete as any);
  }
}

// Global factory function to spawn real or mock socket
export function createMockSocket(): any {
  return new MockSocket();
}
