import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';

// Component imports
import { Navbar } from './components/Navbar';
import { ToastProvider, useToast } from './components/Toast';

// Page imports
import { LiveMonitor } from './pages/LiveMonitor';
import { IncidentLog } from './pages/IncidentLog';
import { Analytics } from './pages/Analytics';
import { RoadConfig } from './pages/RoadConfig';
import { About } from './pages/About';

// Types import
import type { SystemStatus, SignalState } from './types/index';

const AppContent: React.FC = () => {
  const { showToast } = useToast();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [serverOnline, setServerOnline] = useState<boolean>(false);
  const [cameraSignals, setCameraSignals] = useState<Record<string, 'RED' | 'GREEN' | 'AMBER'>>({});
  
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    active_cameras: 6,
    uptime_seconds: 0,
    total_frames_processed: 0
  });

  // Check server availability and connect websocket
  useEffect(() => {
    // 1. HTTP server availability checker loop
    const checkServer = () => {
      axios.get('http://localhost:8000/api/stats')
        .then(() => setServerOnline(true))
        .catch(() => {
          setServerOnline(false);
          setSocketConnected(false);
        });
    };

    checkServer();
    const interval = setInterval(checkServer, 5000);

    // 2. Establish Socket.IO Connection with auto-reconnection and exponential backoff
    const socketClient = io('http://localhost:8000', {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      reconnectionAttempts: Infinity
    });

    socketClient.on('connect', () => {
      setSocketConnected(true);
      setServerOnline(true);
      showToast('Socket.IO connection established with traffic server.', 'success', 2000);
    });

    socketClient.on('disconnect', () => {
      setSocketConnected(false);
      showToast('Websocket connection closed. Reconnecting...', 'warning', 3000);
    });

    socketClient.on('connect_error', () => {
      setSocketConnected(false);
    });

    // Listen to signal state changes globally
    socketClient.on('signal_state_change', (data: SignalState) => {
      setCameraSignals((prev) => ({
        ...prev,
        [data.camera_id]: data.signal
      }));
    });

    // Listen to system statistics updates globally
    socketClient.on('system_status', (data: SystemStatus) => {
      setSystemStatus(data);
    });

    setSocket(socketClient);

    return () => {
      clearInterval(interval);
      socketClient.disconnect();
    };
  }, [showToast]);

  return (
    <Router>
      <div className="min-h-screen bg-warmSand text-textPrimary">
        {/* Fixed Navigation bar */}
        <Navbar 
          socketConnected={socketConnected} 
          serverOnline={serverOnline} 
          cameraSignals={cameraSignals} 
        />
        
        {/* Router mapping */}
        <main>
          <Routes>
            <Route 
              path="/" 
              element={
                <LiveMonitor 
                  socket={socket} 
                  cameraSignals={cameraSignals} 
                  systemStatus={systemStatus} 
                />
              } 
            />
            <Route path="/incidents" element={<IncidentLog />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/config" element={<RoadConfig />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
