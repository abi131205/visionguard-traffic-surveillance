import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';

// Mock interceptors and sockets imports
import './utils/apiMock';
import { detectBackendOnline } from './utils/apiMock';
import { createMockSocket } from './utils/mockSocket';

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
  const [isOfflineDemo, setIsOfflineDemo] = useState<boolean>(false);
  const [cameraSignals, setCameraSignals] = useState<Record<string, 'RED' | 'GREEN' | 'AMBER'>>({});
  
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    active_cameras: 6,
    uptime_seconds: 0,
    total_frames_processed: 0
  });

  // Check server availability and connect websocket
  useEffect(() => {
    let socketClient: any = null;
    let keepAliveInterval: any = null;
    let isMounted = true;

    const initializeConnection = async () => {
      const online = await detectBackendOnline();
      if (!isMounted) return;

      if (!online) {
        setIsOfflineDemo(true);
        setServerOnline(true);
        setSocketConnected(true);
        showToast('Local traffic server offline. Running in Offline Demo Mode.', 'info', 4000);

        // Establish simulated connection
        const mockSocket = createMockSocket();
        socketClient = mockSocket;
        setSocket(mockSocket);

        // Listen to simulated events
        mockSocket.on('signal_state_change', (data: SignalState) => {
          if (!isMounted) return;
          setCameraSignals((prev) => ({
            ...prev,
            [data.camera_id]: data.signal
          }));
        });

        mockSocket.on('system_status', (data: SystemStatus) => {
          if (!isMounted) return;
          setSystemStatus(data);
        });
      } else {
        setIsOfflineDemo(false);
        setServerOnline(true);

        // Establish real Socket.IO Connection
        const socketUrl = window.visionguard_use_ip ? 'http://127.0.0.1:8000' : 'http://localhost:8000';
        const realSocket = io(socketUrl, {
          transports: ['websocket'],
          autoConnect: true,
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 8000,
          reconnectionAttempts: Infinity
        });
        socketClient = realSocket;
        setSocket(realSocket);

        realSocket.on('connect', () => {
          if (!isMounted) return;
          setSocketConnected(true);
          setServerOnline(true);
          showToast('Connected to live traffic server.', 'success', 2000);
        });

        realSocket.on('disconnect', () => {
          if (!isMounted) return;
          setSocketConnected(false);
          showToast('Lost connection to traffic server. Reconnecting...', 'warning', 3000);
        });

        realSocket.on('connect_error', () => {
          if (!isMounted) return;
          setSocketConnected(false);
        });

        // Listen to signal state changes globally
        realSocket.on('signal_state_change', (data: SignalState) => {
          if (!isMounted) return;
          setCameraSignals((prev) => ({
            ...prev,
            [data.camera_id]: data.signal
          }));
        });

        // Listen to system statistics updates globally
        realSocket.on('system_status', (data: SystemStatus) => {
          if (!isMounted) return;
          setSystemStatus(data);
        });
      }
    };

    initializeConnection();

    return () => {
      isMounted = false;
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      if (socketClient && typeof socketClient.disconnect === 'function') {
        socketClient.disconnect();
      }
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
          isOfflineDemo={isOfflineDemo}
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
