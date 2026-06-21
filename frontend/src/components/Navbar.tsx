import React from 'react';
import { NavLink } from 'react-router-dom';
import { Shield, Radio, Activity } from 'lucide-react';

interface NavbarProps {
  socketConnected: boolean;
  serverOnline: boolean;
  cameraSignals: Record<string, 'RED' | 'GREEN' | 'AMBER'>;
  isOfflineDemo?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ socketConnected, serverOnline, cameraSignals, isOfflineDemo }) => {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-borderClay z-40 px-6 flex items-center justify-between shadow-sm">
      {/* Brand Logo */}
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 bg-errorRust/10 rounded-lg text-errorRust">
          <Shield size={22} className="stroke-[2.5]" />
        </div>
        <div>
          <span className="font-semibold text-lg tracking-tight text-textPrimary">VisionGuard</span>
          <span className="text-[10px] block font-mono text-secondary -mt-1 tracking-wider uppercase">BTP Traffic Control</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex items-center gap-1.5 h-full">
        {[
          { path: '/', label: 'Live Monitor' },
          { path: '/incidents', label: 'Incident Log' },
          { path: '/analytics', label: 'Analytics' },
          { path: '/config', label: 'Road Config' },
          { path: '/about', label: 'About' },
        ].map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            className={({ isActive }) =>
              `px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-textSecondary hover:text-textPrimary hover:bg-warmSand'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* Systems Status Badges */}
      <div className="flex items-center gap-4">
        {/* Active Camera Signals */}
        <div className="hidden xl:flex items-center gap-3 border-r border-borderClay pr-4 mr-1">
          {Object.entries(cameraSignals).map(([camId, signal]) => {
            const signalBg =
              signal === 'RED' ? 'bg-errorRust' :
              signal === 'AMBER' ? 'bg-[#D4A373]' :
              'bg-successGreen';
            return (
              <div key={camId} className="flex items-center gap-1.5 bg-warmSand px-2.5 py-1 rounded-lg border border-borderClay">
                <span className="text-[10px] font-mono font-medium text-textSecondary uppercase">{camId.replace('CAM-BTP-', '#')}</span>
                <span className={`w-2 h-2 rounded-full ${signalBg} animate-pulse`} />
              </div>
            );
          })}
        </div>

        {/* Server status indicators */}
        <div className="flex items-center gap-3.5">
          {/* Offline Demo Badge */}
          {isOfflineDemo && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-600 rounded-lg text-xs font-semibold animate-pulse">
              <Radio size={12} className="stroke-[2.5]" />
              Offline Simulation
            </div>
          )}

          {/* Server Online */}
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <span className={`w-2.5 h-2.5 rounded-full flex items-center justify-center ${serverOnline ? 'bg-successGreen/20' : 'bg-errorRust/20'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${serverOnline ? 'bg-successGreen' : 'bg-errorRust'}`} />
            </span>
            <span className={serverOnline ? 'text-successGreen' : 'text-errorRust'}>
              {isOfflineDemo ? 'Demo Mode' : serverOnline ? 'System Online' : 'System Offline'}
            </span>
          </div>

          {/* Socket.IO Connection */}
          <div className="flex items-center gap-1.5 text-xs font-medium border-l border-borderClay pl-4">
            <span className={`w-2.5 h-2.5 rounded-full flex items-center justify-center ${socketConnected ? 'bg-successGreen/20' : 'bg-errorRust/20'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-successGreen' : 'bg-errorRust'} ${(socketConnected && !isOfflineDemo) ? '' : 'animate-ping'}`} />
            </span>
            <span className="text-textSecondary font-mono text-[11px] uppercase">
              {isOfflineDemo ? 'WS Simulated' : socketConnected ? 'WS Live' : 'WS Reconnecting'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
