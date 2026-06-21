import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Download, Eye, FileText, ChevronRight, Check, X, ShieldAlert } from 'lucide-react';
import axios from 'axios';
import type { Incident, Intersection } from '../types/index';
import { useToast } from '../components/Toast';

export const IncidentLog: React.FC = () => {
  const { showToast } = useToast();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [intersections, setIntersections] = useState<Intersection[]>([]);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterCamId, setFilterCamId] = useState<string>('');

  // Selected incident details drawer state
  const [drawerIncident, setDrawerIncident] = useState<Incident | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string>('');

  // Fetch incidents & intersections
  const fetchIncidents = () => {
    axios.get('http://localhost:8000/api/incidents')
      .then((res) => setIncidents(res.data))
      .catch(() => showToast('Failed to retrieve incidents log.', 'error'));
  };

  useEffect(() => {
    fetchIncidents();
    axios.get('http://localhost:8000/api/intersections')
      .then((res) => setIntersections(res.data))
      .catch(() => {});
  }, [showToast]);

  // Synchronize status selection inside drawer on click
  useEffect(() => {
    if (drawerIncident) {
      setUpdateStatus(drawerIncident.status);
    }
  }, [drawerIncident]);

  // Client-side search and filters logic
  const filteredIncidents = incidents.filter((inc) => {
    const plateText = inc.license_plate ? inc.license_plate.toLowerCase() : 'undetected';
    const intersectionText = inc.intersection.toLowerCase();
    const violationText = inc.violation_type.toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchesSearch = 
      plateText.includes(query) ||
      intersectionText.includes(query) ||
      violationText.includes(query);

    const matchesStatus = !filterStatus || inc.status === filterStatus;
    const matchesSeverity = !filterSeverity || inc.severity === filterSeverity;
    const matchesType = !filterType || inc.violation_type === filterType;
    const matchesCamera = !filterCamId || inc.camera_id === filterCamId;

    return matchesSearch && matchesStatus && matchesSeverity && matchesType && matchesCamera;
  });

  // Export handlers
  const handleExportCSV = () => {
    if (window.visionguard_offline) {
      try {
        const headers = ["ID", "Timestamp", "Camera", "Intersection", "Vehicle Track ID", "Vehicle Class", "License Plate", "Plate Confidence", "Violation", "Severity", "Confidence", "Status"];
        const rows = incidents.map(inc => [
          inc.id,
          inc.timestamp,
          inc.camera_id,
          inc.intersection,
          inc.vehicle_track_id,
          inc.vehicle_class,
          inc.license_plate || 'N/A',
          inc.plate_confidence || 'N/A',
          inc.violation_type,
          inc.severity,
          inc.confidence,
          inc.status
        ]);
        const csvContent = "data:text/csv;charset=utf-8," 
          + [headers.join(",")].concat(rows.map(e => e.map(val => `"${val}"`).join(","))).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `visionguard_export_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Generated and downloaded CSV spreadsheet locally.', 'success');
      } catch (err) {
        showToast('Failed to export CSV locally.', 'error');
      }
    } else {
      window.open('http://localhost:8000/api/export/csv', '_blank');
      showToast('Initiating CSV spreadsheet export download.', 'success');
    }
  };

  const handleExportPDF = () => {
    if (window.visionguard_offline) {
      try {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          showToast('Popup blocker prevented PDF generation. Please allow popups.', 'error');
          return;
        }
        
        const rowsHtml = incidents.map(inc => `
          <tr style="border-bottom: 1px solid #E7DED2; font-family: monospace; font-size: 11px;">
            <td style="padding: 8px 4px; font-weight: bold; color: #BC6C25;">${inc.id}</td>
            <td style="padding: 8px 4px;">${new Date(inc.timestamp).toLocaleString()}</td>
            <td style="padding: 8px 4px;">${inc.intersection} (${inc.camera_id})</td>
            <td style="padding: 8px 4px; font-weight: bold;">${inc.license_plate || 'UNDETECTED'}</td>
            <td style="padding: 8px 4px; color: #577590;">${inc.violation_type}</td>
            <td style="padding: 8px 4px;"><span style="padding: 2px 6px; border-radius: 4px; font-weight: bold; background: ${inc.severity === 'HIGH' ? '#FEE2E2; color: #991B1B' : '#FEF3C7; color: #92400E'}">${inc.severity}</span></td>
            <td style="padding: 8px 4px; text-transform: uppercase;">${inc.status.replace('_', ' ')}</td>
          </tr>
        `).join('');

        printWindow.document.write(`
          <html>
            <head>
              <title>VisionGuard Traffic Surveillance System - Incidents Audit Summary</title>
              <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #2B2D42; padding: 40px; background: #F8F4EE; }
                .header { border-bottom: 2px solid #BC6C25; padding-bottom: 15px; margin-bottom: 30px; }
                .title { font-size: 24px; font-weight: bold; color: #2B2D42; }
                .subtitle { font-size: 12px; color: #8D99AE; text-transform: uppercase; letter-spacing: 1px; margin-top: 5px; }
                .metadata { display: flex; justify-content: space-between; font-size: 11px; color: #577590; margin-top: 15px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { text-align: left; padding: 10px 4px; border-bottom: 2px solid #E7DED2; font-size: 11px; text-transform: uppercase; color: #577590; }
                @media print {
                  body { background: #FFFFFF; padding: 0; }
                  .no-print { display: none; }
                }
              </style>
            </head>
            <body>
              <div class="header">
                <div class="title">VisionGuard Traffic Surveillance Audit Report</div>
                <div class="subtitle">BTP Traffic Control - Simulation Mode Report</div>
                <div class="metadata">
                  <span>Generated: ${new Date().toLocaleString()}</span>
                  <span>Scope: Active Session Database Log (${incidents.length} Records)</span>
                </div>
              </div>
              <button class="no-print" onclick="window.print();" style="margin-bottom: 20px; padding: 8px 16px; background: #BC6C25; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Print / Save PDF</button>
              <table>
                <thead>
                  <tr>
                    <th>Incident ID</th>
                    <th>Timestamp</th>
                    <th>Junction</th>
                    <th>Plate Number</th>
                    <th>Violation Class</th>
                    <th>Severity</th>
                    <th>Challan Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
              <script>
                setTimeout(() => { window.print(); }, 500);
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
        showToast('Compiling PDF summary. Please use printer save options.', 'success');
      } catch (err) {
        showToast('Failed to compile PDF summary locally.', 'error');
      }
    } else {
      window.open('http://localhost:8000/api/export/report', '_blank');
      showToast('Compiling system audit PDF summary. Please wait.', 'success');
    }
  };

  // Status updates
  const handleStatusUpdate = (status: string) => {
    if (!drawerIncident) return;

    axios.patch(`http://localhost:8000/api/incidents/${drawerIncident.id}`, { status })
      .then((res) => {
        setIncidents((prev) => prev.map((inc) => (inc.id === drawerIncident.id ? res.data : inc)));
        setDrawerIncident(res.data);
        showToast('Incident case status updated successfully.', 'success');
      })
      .catch(() => showToast('Failed to update incident status.', 'error'));
  };

  // Issue Challan action
  const handleIssueChallan = () => {
    if (!drawerIncident) return;
    
    axios.patch(`http://localhost:8000/api/incidents/${drawerIncident.id}`, { status: 'challan_issued' })
      .then((res) => {
        setIncidents((prev) => prev.map((inc) => (inc.id === drawerIncident.id ? res.data : inc)));
        setDrawerIncident(res.data);
        showToast(`Traffic citation issued to ${res.data.license_plate || 'vehicle ID'}. Status logged.`, 'success');
      })
      .catch(() => showToast('Failed to issue citation.', 'error'));
  };

  // SVG direction vector chart
  const renderVectorDiagram = (camera_id: string, detectedDeg: number | null) => {
    if (detectedDeg === null) return null;
    
    // Find allowed direction degree for this camera
    const road = intersections.find((c) => c.id === camera_id);
    const allowedDeg = road ? road.allowed_direction_deg : 0.0;

    const getCoords = (deg: number) => {
      // Cartesian angle translation: 0 is UP
      const rad = (deg) * Math.PI / 180;
      return {
        x: 50 + 35 * Math.sin(rad),
        y: 50 - 35 * Math.cos(rad)
      };
    };

    const allowedEnd = getCoords(allowedDeg);
    const detectedEnd = getCoords(detectedDeg);

    return (
      <div className="bg-warmSand border border-borderClay rounded-xl p-4 flex flex-col items-center gap-2">
        <span className="font-semibold text-textSecondary text-[10px] uppercase tracking-wider">Direction Vector Analysis</span>
        <svg width="100" height="100" className="bg-white rounded-full border border-borderClay shadow-inner">
          <line x1="50" y1="5" x2="50" y2="95" stroke="#E7DED2" strokeWidth="1" strokeDasharray="2,2" />
          <line x1="5" y1="50" x2="95" y2="50" stroke="#E7DED2" strokeWidth="1" strokeDasharray="2,2" />
          <circle cx="50" cy="50" r="42" fill="none" stroke="#E7DED2" strokeWidth="1" />
          
          {/* Allowed vector - Success Green */}
          <line x1="50" y1="50" x2={allowedEnd.x} y2={allowedEnd.y} stroke="#6B8F71" strokeWidth="2.5" markerEnd="url(#arrow-green)" />
          {/* Detected vector - Error Rust */}
          <line x1="50" y1="50" x2={detectedEnd.x} y2={detectedEnd.y} stroke="#BC6C25" strokeWidth="2.5" markerEnd="url(#arrow-red)" />
          
          <circle cx="50" cy="50" r="3.5" fill="#2B2D42" />
          
          <defs>
            <marker id="arrow-green" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 2 L 10 5 L 0 8 z" fill="#6B8F71" />
            </marker>
            <marker id="arrow-red" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 2 L 10 5 L 0 8 z" fill="#BC6C25" />
            </marker>
          </defs>
        </svg>
        <div className="flex gap-4 text-[10px] font-mono mt-1 text-textSecondary">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-successGreen inline-block" />Allowed: {allowedDeg}°</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-errorRust inline-block" />Actual: {Math.round(detectedDeg)}°</span>
        </div>
      </div>
    );
  };

  // Severity badges layout
  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case 'HIGH': return 'bg-errorRust/15 text-errorRust border-errorRust/20';
      case 'MEDIUM': return 'bg-warningAmber/20 text-warningAmber border-warningAmber/30';
      default: return 'bg-secondary/10 text-secondary border-secondary/20';
    }
  };

  // Status badges layout
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'challan_issued': return 'bg-successGreen text-white';
      case 'resolved': return 'bg-successGreen/25 text-successGreen';
      case 'escalated': return 'bg-errorRust/25 text-errorRust';
      default: return 'bg-warningAmber/20 text-textPrimary border border-warningAmber/45';
    }
  };

  return (
    <div className="pt-20 px-6 pb-6 min-h-screen flex flex-col gap-6 max-w-[1600px] mx-auto relative overflow-hidden">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-borderClay pb-4">
        <div>
          <h2 className="text-xl font-bold text-textPrimary tracking-tight">Traffic Incident Log</h2>
          <p className="text-xs text-textSecondary mt-0.5">Filter, search, investigate and dispatch citations for traffic safety violations</p>
        </div>
        
        {/* Export Buttons */}
        <div className="flex items-center gap-3">
          <button onClick={handleExportCSV} className="btn-outline text-xs">
            <Download size={14} />
            Export CSV
          </button>
          <button onClick={handleExportPDF} className="btn-secondary text-xs">
            <FileText size={14} />
            Export PDF Audit
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="desert-card p-4 flex flex-col md:flex-row gap-4 bg-white items-center">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-2.5 text-textSecondary" />
          <input
            type="text"
            placeholder="Search by plate, junction, or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-borderClay rounded-xl bg-warmSand text-xs focus:outline-none focus:ring-1 focus:ring-primary text-textPrimary"
          />
        </div>

        {/* Filter Selection Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
          {/* Violation Type */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-borderClay bg-warmSand rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary text-textPrimary"
          >
            <option value="">All Violations</option>
            <option value="Wrong-Side Driving">Wrong-Side Driving</option>
            <option value="Helmet Non-Compliance">Helmet Non-Compliance</option>
            <option value="Seatbelt Non-Compliance">Seatbelt Non-Compliance</option>
            <option value="Triple Riding">Triple Riding</option>
            <option value="Stop-Line Violation">Stop-Line Violation</option>
            <option value="Red-Light Violation">Red-Light Violation</option>
            <option value="Illegal Parking">Illegal Parking</option>
          </select>

          {/* Severity */}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="border border-borderClay bg-warmSand rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary text-textPrimary"
          >
            <option value="">All Severities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-borderClay bg-warmSand rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary text-textPrimary"
          >
            <option value="">All Statuses</option>
            <option value="under_review">Under Review</option>
            <option value="resolved">Resolved</option>
            <option value="escalated">Escalated</option>
            <option value="challan_issued">Challan Issued</option>
          </select>

          {/* Camera ID */}
          <select
            value={filterCamId}
            onChange={(e) => setFilterCamId(e.target.value)}
            className="border border-borderClay bg-warmSand rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary text-textPrimary"
          >
            <option value="">All Cameras</option>
            {intersections.map((c) => (
              <option key={c.id} value={c.id}>{c.id} ({c.name.split(' ')[0]})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="desert-card overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-warmSand text-textSecondary uppercase tracking-wider font-semibold border-b border-borderClay">
                <th className="px-5 py-3">Incident ID</th>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">License Plate</th>
                <th className="px-5 py-3">Violation Type</th>
                <th className="px-5 py-3">Severity</th>
                <th className="px-5 py-3">Confidence</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderClay/60">
              {filteredIncidents.length > 0 ? (
                filteredIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-warmSand/30 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-semibold text-textPrimary">{inc.id}</td>
                    <td className="px-5 py-3.5 text-textSecondary font-mono">{new Date(inc.timestamp).toLocaleString()}</td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-textPrimary">{inc.intersection}</div>
                      <div className="text-[10px] text-textSecondary font-mono">{inc.camera_id}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono bg-warmSand border border-borderClay px-2 py-0.5 rounded font-bold text-textPrimary">
                        {inc.license_plate || 'Undetected'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-textPrimary">{inc.violation_type}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getSeverityStyle(inc.severity)}`}>
                        {inc.severity}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-textPrimary">{(inc.confidence * 100).toFixed(1)}%</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${getStatusStyle(inc.status)}`}>
                        {inc.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => setDrawerIncident(inc)}
                        className="btn-outline inline-flex text-[10px] font-semibold py-1 px-2 border border-borderClay bg-white hover:bg-warmSand transition-colors"
                      >
                        <Eye size={12} />
                        Inspect Case
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-textSecondary font-medium">
                    No incidents match the active search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Side Drawer Detail Panel */}
      <AnimatePresence>
        {drawerIncident && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerIncident(null)}
              className="absolute inset-0 bg-slate-900"
            />
            
            {/* Drawer Body */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 max-w-lg w-full bg-white border-l border-borderClay shadow-2xl flex flex-col z-10"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-borderClay flex items-center justify-between bg-warmSand">
                <div>
                  <h3 className="font-bold text-textPrimary text-base">Traffic Audit Case File</h3>
                  <p className="text-xs text-textSecondary font-mono mt-0.5">{drawerIncident.id}</p>
                </div>
                <button
                  onClick={() => setDrawerIncident(null)}
                  className="text-textSecondary hover:text-textPrimary p-1.5 border border-borderClay rounded-lg bg-white"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="p-6 flex-grow overflow-y-auto flex flex-col gap-6">
                
                {/* Evidence Screenshot */}
                <div className="bg-[#23242A] rounded-xl overflow-hidden aspect-video flex items-center justify-center border border-borderClay shadow-inner">
                  {drawerIncident.annotated_frame ? (
                    <img
                      src={`data:image/jpeg;base64,${drawerIncident.annotated_frame}`}
                      alt="Violation evidence frame"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-slate-400 text-xs">No screenshot logged.</span>
                  )}
                </div>

                {/* Vector compass for wrong side driving */}
                {drawerIncident.violation_type === 'Wrong-Side Driving' && (
                  renderVectorDiagram(drawerIncident.camera_id, drawerIncident.direction_vector_x !== null ? Math.atan2(drawerIncident.direction_vector_x, -(drawerIncident.direction_vector_y || 1)) * 180 / Math.PI % 360 : null)
                )}

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-4 text-xs border-b border-borderClay pb-4">
                  <div>
                    <span className="text-textSecondary block">Violation Description</span>
                    <span className="text-errorRust font-bold text-sm block mt-0.5">{drawerIncident.violation_type}</span>
                  </div>
                  <div>
                    <span className="text-textSecondary block">License plate text</span>
                    <span className="font-mono bg-warmSand border border-borderClay px-2 py-0.5 rounded font-bold text-textPrimary text-xs mt-0.5 inline-block">
                      {drawerIncident.license_plate || 'Undetected'}
                    </span>
                  </div>
                  <div>
                    <span className="text-textSecondary block">Junction Location</span>
                    <span className="text-textPrimary font-semibold block mt-0.5">{drawerIncident.intersection}</span>
                  </div>
                  <div>
                    <span className="text-textSecondary block">Camera Code</span>
                    <span className="text-textPrimary font-mono block mt-0.5">{drawerIncident.camera_id}</span>
                  </div>
                  <div>
                    <span className="text-textSecondary block">Severity Classification</span>
                    <span className={`px-2.5 py-0.5 font-bold rounded-md border mt-1 inline-block text-[10px] ${getSeverityStyle(drawerIncident.severity)}`}>
                      {drawerIncident.severity}
                    </span>
                  </div>
                  <div>
                    <span className="text-textSecondary block">Model Inference Latency</span>
                    <span className="text-textPrimary font-semibold block mt-0.5">
                      {drawerIncident.inference_time_ms ? `${drawerIncident.inference_time_ms.toFixed(0)} ms` : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-textSecondary block">Condition Enhancements Applied</span>
                    <span className="text-textPrimary font-semibold block mt-0.5">
                      {drawerIncident.preprocessing_applied 
                        ? JSON.parse(drawerIncident.preprocessing_applied).join(', ') || 'None (Clear daylight)'
                        : 'None'}
                    </span>
                  </div>
                  <div>
                    <span className="text-textSecondary block">Timestamp</span>
                    <span className="text-textPrimary font-semibold block mt-0.5">
                      {new Date(drawerIncident.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Case Status Action */}
                <div className="flex flex-col gap-3">
                  <h4 className="font-bold text-xs text-textPrimary uppercase tracking-wider">Case Status Manager</h4>
                  
                  <div className="flex gap-2">
                    <select
                      value={updateStatus}
                      onChange={(e) => setUpdateStatus(e.target.value)}
                      className="border border-borderClay bg-warmSand rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary text-textPrimary flex-grow"
                    >
                      <option value="under_review">Under Review</option>
                      <option value="resolved">Resolved</option>
                      <option value="escalated">Escalated</option>
                      <option value="challan_issued">Challan Issued</option>
                    </select>
                    <button
                      onClick={() => handleStatusUpdate(updateStatus)}
                      className="btn-primary text-xs"
                    >
                      Update
                    </button>
                  </div>

                  {drawerIncident.status !== 'challan_issued' && (
                    <button
                      onClick={handleIssueChallan}
                      className="btn-secondary w-full text-xs font-bold mt-2"
                    >
                      <ShieldAlert size={14} />
                      Issue Citational Challan Ticket
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
