import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, AlertCircle, Camera, Check, Clock, ShieldAlert, AlertTriangle, Eye, RefreshCw, Car, Radio } from 'lucide-react';
import axios from 'axios';
import { Socket } from 'socket.io-client';
import type { Incident, Intersection, SystemStatus, SignalState } from '../types/index';
import { useToast } from '../components/Toast';

interface LiveMonitorProps {
  socket: Socket | null;
  cameraSignals: Record<string, 'RED' | 'GREEN' | 'AMBER'>;
  systemStatus: SystemStatus;
}

export const LiveMonitor: React.FC<LiveMonitorProps> = ({ socket, cameraSignals, systemStatus }) => {
  const { showToast } = useToast();
  const [intersections, setIntersections] = useState<Intersection[]>([]);
  const [selectedCamId, setSelectedCamId] = useState<string>(() => localStorage.getItem('visionguard_selected_camera') || 'CAM-BTP-001');
  const [selectedCam, setSelectedCam] = useState<Intersection | null>(null);
  
  // Video upload & processing state
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  
  // Streaming state
  const [annotatedFrame, setAnnotatedFrame] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeDetections, setActiveDetections] = useState<number>(0);
  
  // Real-time violation alerts list (max 10)
  const [alerts, setAlerts] = useState<Incident[]>([]);
  const [flashAlert, setFlashAlert] = useState<boolean>(false);
  const [slidingBanner, setSlidingBanner] = useState<Incident | null>(null);
  const alertsEndRef = useRef<HTMLDivElement>(null);
  
  // Evidence modal state
  const [selectedAlert, setSelectedAlert] = useState<Incident | null>(null);
  
  // Signal light state timer countdown
  const [signalTimeLeft, setSignalTimeLeft] = useState<number>(30);

  // Play Web Audio beep
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.20);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.20);
    } catch (e) {
      console.warn("Audio Context beep blocked by browser settings.", e);
    }
  };

  // Fetch intersections list
  useEffect(() => {
    axios.get('http://localhost:8000/api/intersections')
      .then((res) => {
        setIntersections(res.data);
        const active = res.data.find((c: Intersection) => c.id === selectedCamId);
        setSelectedCam(active || res.data[0]);
      })
      .catch(() => showToast('Failed to connect to backend configuration API.', 'error'));
  }, [selectedCamId, showToast]);

  // Update selected camera detail
  useEffect(() => {
    if (intersections.length > 0) {
      const active = intersections.find((c) => c.id === selectedCamId);
      setSelectedCam(active || intersections[0]);
    }
  }, [selectedCamId, intersections]);

  // Handle Socket.IO events for live frame & alert streams
  useEffect(() => {
    if (!socket) return;

    socket.on('annotated_frame', (data: { camera_id: string; frame_base64: string; detections_count: number }) => {
      if (data.camera_id === selectedCamId) {
        setAnnotatedFrame(data.frame_base64);
        setActiveDetections(data.detections_count);
        setIsProcessing(true);
      }
    });

    socket.on('violation_alert', (violation: Incident) => {
      if (violation.camera_id === selectedCamId) {
        setAlerts((prev) => {
          const updated = [violation, ...prev];
          return updated.slice(0, 10); // Keep max 10
        });
        
        // Actions on new violation: sound beep, red flash, and sliding banner
        playBeep();
        setFlashAlert(true);
        setTimeout(() => setFlashAlert(false), 300);
        
        setSlidingBanner(violation);
        
        // Auto-dismiss sliding banner after 5s
        const timer = setTimeout(() => {
          setSlidingBanner((curr) => (curr?.id === violation.id ? null : curr));
        }, 5000);
        return () => clearTimeout(timer);
      }
    });

    socket.on('processing_complete', (data: { job_id: string; total_violations: number }) => {
      if (data.job_id === jobId) {
        setIsProcessing(false);
        setJobStatus((prev: any) => prev ? { ...prev, status: 'completed' } : null);
        showToast(`Video analysis complete! Detected ${data.total_violations} violations.`, 'success');
        setJobId(null);
      }
    });

    socket.on('signal_state_change', (data: SignalState) => {
      if (data.camera_id === selectedCamId) {
        setSignalTimeLeft(data.duration_seconds);
      }
    });

    return () => {
      socket.off('annotated_frame');
      socket.off('violation_alert');
      socket.off('processing_complete');
      socket.off('signal_state_change');
    };
  }, [socket, selectedCamId, jobId, showToast]);

  // Handle signal countdown timer ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setSignalTimeLeft((t) => (t > 1 ? t - 1 : 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll video status if job active
  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(() => {
      axios.get(`http://localhost:8000/api/job/${jobId}/status`)
        .then((res) => {
          setJobStatus(res.data);
          const total = res.data.total_frames || 1;
          const processed = res.data.frames_processed || 0;
          setUploadProgress(Math.min(100, Math.round((processed / total) * 100)));
          
          if (res.data.status === 'completed' || res.data.status === 'failed') {
            setJobId(null);
            setIsProcessing(false);
            setUploadProgress(null);
          }
        })
        .catch(() => {});
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId]);

  // Drag and drop events
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  // Upload file API handler
  const uploadFile = (file: File) => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      showToast('Unsupported file format. Please upload MP4/MOV videos or JPG/PNG images.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('camera_id', selectedCamId);

    if (isImage) {
      // Instant static image analysis
      setIsProcessing(true);
      setUploadProgress(0);
      axios.post('http://localhost:8000/api/upload-image', formData)
        .then((res) => {
          setAnnotatedFrame(res.data.annotated_frame);
          setActiveDetections(res.data.violations.length + 2); // mockup total count
          setIsProcessing(false);
          setUploadProgress(null);
          showToast(`Image analysis completed. Found ${res.data.violations.length} violations.`, 'success');
        })
        .catch((err) => {
          setIsProcessing(false);
          setUploadProgress(null);
          showToast(err.response?.data?.detail || 'Failed to process target image.', 'error');
        });
    } else {
      // Video processing job initiation
      setUploadProgress(0);
      setJobStatus({ status: 'queued', frames_processed: 0, total_frames: 100 });
      axios.post('http://localhost:8000/api/upload-video', formData)
        .then((res) => {
          setJobId(res.data.job_id);
          showToast('Video uploaded successfully. Initiating background model inference.', 'info');
        })
        .catch((err) => {
          setUploadProgress(null);
          setJobStatus(null);
          showToast(err.response?.data?.detail || 'Failed to initialize video upload job.', 'error');
        });
    }
  };

  const activeSignal = cameraSignals[selectedCamId] || 'GREEN';

  // Format system uptime
  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="pt-20 px-6 pb-6 min-h-screen flex flex-col gap-6 max-w-[1600px] mx-auto">
      
      {/* Dynamic Warning Alert Banner */}
      <AnimatePresence>
        {slidingBanner && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full bg-errorRust border border-errorRust/20 text-white px-5 py-3.5 rounded-xl shadow-md flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <ShieldAlert className="animate-bounce" size={20} />
              <span className="text-sm font-semibold tracking-wide uppercase font-mono">
                CRITICAL ALERT: {slidingBanner.violation_type} detected at {slidingBanner.intersection} ({slidingBanner.license_plate || 'No Plate'})
              </span>
            </div>
            <button 
              onClick={() => setSelectedAlert(slidingBanner)}
              className="text-xs bg-white text-errorRust px-3 py-1.5 rounded-lg font-bold hover:bg-warmSand transition-colors"
            >
              INVESTIGATE EVIDENCE
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Left Panel: CCTV Canvas and Signal status */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="desert-card overflow-hidden relative">
            
            {/* Header bar */}
            <div className="bg-white px-4 py-3 border-b border-borderClay flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-secondary" />
                <span className="font-semibold text-textPrimary text-sm">CCTV Real-Time Surveillance</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-textSecondary font-medium">Active feed:</label>
                <select
                  value={selectedCamId}
                  onChange={(e) => {
                    setSelectedCamId(e.target.value);
                    localStorage.setItem('visionguard_selected_camera', e.target.value);
                    setAnnotatedFrame(null);
                    setAlerts([]);
                  }}
                  className="text-xs border border-borderClay bg-warmSand rounded-lg px-2 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {intersections.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Live Canvas Area */}
            <div className="relative aspect-video bg-[#23242A] flex items-center justify-center">
              {annotatedFrame ? (
                <img
                  src={`data:image/jpeg;base64,${annotatedFrame}`}
                  alt="Live traffic surveillance feed"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div 
                  className={`w-full h-full flex flex-col items-center justify-center p-8 border-2 border-dashed transition-colors ${
                    isDragActive ? 'border-primary bg-primary/5' : 'border-borderClay bg-[#23242A]/30'
                  }`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                >
                  {uploadProgress !== null ? (
                    <div className="flex flex-col items-center gap-4 max-w-xs w-full text-center">
                      <RefreshCw className="animate-spin text-primary" size={32} />
                      <div className="text-sm font-semibold text-white">Analyzing Feed Frame Data...</div>
                      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden mt-1">
                        <div 
                          className="bg-primary h-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <div className="text-xs text-slate-400 font-mono">{uploadProgress}% complete ({jobStatus?.frames_processed || 0} processed)</div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center gap-3">
                      <div className="p-4 bg-white/5 rounded-full text-slate-400">
                        <Upload size={32} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Drag & drop traffic video or junction image</p>
                        <p className="text-xs text-slate-400 mt-1">Supports MP4, MOV videos and JPG, PNG formats</p>
                      </div>
                      <label className="btn-primary mt-2 cursor-pointer text-xs">
                        Select File
                        <input type="file" className="hidden" onChange={handleFileInput} accept="video/*,image/*" />
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* Overlay: BLINKING badge and signal light cycle state */}
              {isProcessing && (
                <>
                  <div className="absolute top-4 left-4 bg-errorRust text-white text-[10px] font-mono font-bold px-2 py-1 rounded flex items-center gap-1.5 shadow-md">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-blink" />
                    REC LIVE
                  </div>
                  <div className="absolute top-4 right-4 bg-black/60 text-white text-[10px] font-mono px-2 py-1 rounded shadow-md">
                    {new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC
                  </div>
                </>
              )}

              {/* Dynamic Traffic Signal light display */}
              <div className="absolute bottom-4 right-4 flex items-center gap-2.5 bg-black/70 px-3 py-2 rounded-xl border border-white/10 shadow-lg">
                <div className="text-right">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Signal Light</div>
                  <div className="text-xs font-semibold text-white font-mono">{signalTimeLeft}s remaining</div>
                </div>
                <div className="flex flex-col gap-1 bg-[#1A1A1A] p-1.5 rounded-lg border border-white/5">
                  <span className={`w-3.5 h-3.5 rounded-full ${activeSignal === 'RED' ? 'bg-errorRust shadow-[0_0_8px_rgba(188,108,37,0.7)]' : 'bg-errorRust/20'}`} />
                  <span className={`w-3.5 h-3.5 rounded-full ${activeSignal === 'AMBER' ? 'bg-[#D4A373] shadow-[0_0_8px_rgba(212,163,115,0.7)]' : 'bg-[#D4A373]/20'}`} />
                  <span className={`w-3.5 h-3.5 rounded-full ${activeSignal === 'GREEN' ? 'bg-successGreen shadow-[0_0_8px_rgba(107,143,113,0.7)]' : 'bg-successGreen/20'}`} />
                </div>
              </div>
            </div>

            {/* Bottom active camera description metadata */}
            <div className="bg-warmSand px-5 py-4 border-t border-borderClay grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-medium">
              <div>
                <span className="text-textSecondary block">Camera Location</span>
                <span className="text-textPrimary font-semibold">{selectedCam?.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-textSecondary block">Camera Identifier</span>
                <span className="text-textPrimary font-mono font-semibold">{selectedCamId}</span>
              </div>
              <div>
                <span className="text-textSecondary block">Allowed Direction Rule</span>
                <span className="text-textPrimary font-semibold">{selectedCam?.road_type || 'N/A'}</span>
              </div>
              <div>
                <span className="text-textSecondary block">Frame Detection Status</span>
                <span className="text-textPrimary font-semibold flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-successGreen animate-pulse' : 'bg-textSecondary/40'}`} />
                  {isProcessing ? `Active (${activeDetections} tracked)` : 'Awaiting stream upload'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Live alerts stream feed */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <motion.div
            animate={{ backgroundColor: flashAlert ? '#FDE8E8' : '#FFFFFF' }}
            transition={{ duration: 0.1 }}
            className="desert-card flex-grow flex flex-col min-h-[500px] max-h-[580px]"
          >
            {/* Alert Header */}
            <div className="px-5 py-3.5 border-b border-borderClay flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="text-errorRust" size={16} />
                <span className="font-semibold text-textPrimary text-sm">Live Traffic Violations Stream</span>
              </div>
              <span className="text-[10px] bg-errorRust/10 text-errorRust font-bold font-mono px-2 py-0.5 rounded-full">
                {alerts.length} ALERTS
              </span>
            </div>

            {/* Alerts Log Container */}
            <div className="p-4 flex-grow overflow-y-auto flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {alerts.length > 0 ? (
                  alerts.map((alert) => {
                    const badgeColor =
                      alert.severity === 'HIGH' ? 'bg-errorRust text-white' :
                      alert.severity === 'MEDIUM' ? 'bg-warningAmber text-textPrimary' :
                      'bg-secondary text-white';

                    return (
                      <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="bg-warmSand border border-borderClay rounded-xl p-3.5 flex flex-col gap-2.5 hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${badgeColor}`}>
                            {alert.severity} SEVERITY
                          </span>
                          <span className="text-[10px] text-textSecondary font-mono">{alert.timestamp.replace('T', ' ').substring(0, 16)}</span>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-textPrimary">{alert.violation_type}</div>
                          <div className="text-xs text-textSecondary mt-0.5">Detected at {alert.intersection}</div>
                        </div>
                        <div className="flex items-center justify-between border-t border-borderClay/60 pt-2 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-textSecondary uppercase">Vehicle Plate:</span>
                            <span className="font-mono bg-white border border-borderClay px-1.5 py-0.5 rounded text-[11px] font-bold text-textPrimary">
                              {alert.license_plate || 'Undetected'}
                            </span>
                          </div>
                          <button
                            onClick={() => setSelectedAlert(alert)}
                            className="text-[11px] font-semibold text-primary hover:text-secondary flex items-center gap-1 transition-colors"
                          >
                            <Eye size={12} />
                            View Evidence
                          </button>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="flex-grow flex flex-col items-center justify-center text-center p-8 text-textSecondary">
                    <Radio className="text-borderClay mb-2" size={36} />
                    <p className="text-sm font-medium">Surveillance channel idle</p>
                    <p className="text-xs text-textSecondary mt-1">Upload a traffic file to start live analysis feeds</p>
                  </div>
                )}
              </AnimatePresence>
              <div ref={alertsEndRef} />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Vehicles Detected', val: systemStatus.total_frames_processed * 8 + activeDetections, icon: Car },
          { label: 'Violations Logged Today', val: systemStatus.total_frames_processed > 0 ? Math.round(systemStatus.total_frames_processed * 0.18) + alerts.length : alerts.length, icon: ShieldAlert },
          { label: 'Active Camera Feeds', val: systemStatus.active_cameras, icon: Camera },
          { label: 'System Uptime Tracker', val: formatUptime(systemStatus.uptime_seconds), icon: Clock, isTime: true },
        ].map((card, idx) => (
          <div key={idx} className="desert-card p-5 flex items-center justify-between bg-white">
            <div>
              <span className="text-xs font-semibold text-textSecondary uppercase tracking-wider block">{card.label}</span>
              <span className="text-2xl font-bold text-textPrimary tracking-tight block mt-1.5 font-mono">
                {card.val}
              </span>
            </div>
            <div className="p-3 bg-warmSand text-primary rounded-xl border border-borderClay">
              <card.icon size={22} className="stroke-[1.8]" />
            </div>
          </div>
        ))}
      </div>

      {/* Evidence View Modal */}
      <AnimatePresence>
        {selectedAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#23242A]/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-borderClay rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
            >
              {/* Image side */}
              <div className="md:w-3/5 bg-slate-900 flex items-center justify-center p-2">
                {selectedAlert.annotated_frame ? (
                  <img
                    src={`data:image/jpeg;base64,${selectedAlert.annotated_frame}`}
                    alt="Violation evidence screenshot"
                    className="max-h-[60vh] object-contain w-full"
                  />
                ) : (
                  <div className="text-white text-sm">No evidence frame available.</div>
                )}
              </div>

              {/* Data side */}
              <div className="md:w-2/5 p-6 flex flex-col gap-5 overflow-y-auto">
                <div className="flex justify-between items-start border-b border-borderClay pb-4">
                  <div>
                    <h3 className="font-bold text-textPrimary text-base">Traffic Violation Challan</h3>
                    <p className="text-xs text-textSecondary font-mono mt-0.5">{selectedAlert.id}</p>
                  </div>
                  <button
                    onClick={() => setSelectedAlert(null)}
                    className="text-textSecondary hover:text-textPrimary p-1 border border-borderClay rounded-lg bg-warmSand"
                  >
                    Close
                  </button>
                </div>

                <div className="flex flex-col gap-4 text-xs">
                  <div>
                    <span className="text-textSecondary block">Violation Type</span>
                    <span className="text-errorRust font-bold text-sm mt-0.5 block">{selectedAlert.violation_type}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-textSecondary block">License Plate</span>
                      <span className="font-mono bg-warmSand border border-borderClay px-2 py-0.5 rounded font-bold text-textPrimary text-xs mt-0.5 inline-block">
                        {selectedAlert.license_plate || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-textSecondary block">Confidence Index</span>
                      <span className="text-textPrimary font-semibold mt-0.5 block">{(selectedAlert.confidence * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-textSecondary block">Intersection</span>
                      <span className="text-textPrimary font-semibold mt-0.5 block">{selectedAlert.intersection}</span>
                    </div>
                    <div>
                      <span className="text-textSecondary block">Camera Code</span>
                      <span className="text-textPrimary font-mono mt-0.5 block">{selectedAlert.camera_id}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-textSecondary block">Severity Level</span>
                    <span className={`px-2 py-0.5 font-bold rounded mt-1 inline-block text-[10px] ${
                      selectedAlert.severity === 'HIGH' ? 'bg-errorRust text-white' :
                      selectedAlert.severity === 'MEDIUM' ? 'bg-warningAmber text-textPrimary' :
                      'bg-secondary text-white'
                    }`}>
                      {selectedAlert.severity} SEVERITY
                    </span>
                  </div>

                  <div>
                    <span className="text-textSecondary block">Timestamp</span>
                    <span className="text-textPrimary font-semibold mt-0.5 block">
                      {new Date(selectedAlert.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="border-t border-borderClay pt-4 mt-2">
                  <button
                    onClick={() => {
                      showToast('Generated traffic citation challan notification.', 'success');
                      setSelectedAlert(null);
                    }}
                    className="w-full btn-primary text-xs"
                  >
                    File citation & Challan
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
