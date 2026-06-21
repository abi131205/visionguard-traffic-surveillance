import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Edit, Trash2, Plus, X, Compass, MapPin, Check, HelpCircle } from 'lucide-react';
import axios from 'axios';
import type { Intersection } from '../types/index';
import { useToast } from '../components/Toast';

export const RoadConfig: React.FC = () => {
  const { showToast } = useToast();
  const [intersections, setIntersections] = useState<Intersection[]>([]);
  const [selectedCam, setSelectedCam] = useState<Intersection | null>(null);
  
  // Modal states
  const [showModal, setShowModal] = useState<boolean>(false);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form Fields State
  const [formId, setFormId] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formAngle, setFormAngle] = useState<number>(0);
  const [formRoadType, setFormRoadType] = useState<string>('');
  const [formStopLineY, setFormStopLineY] = useState<number>(480);
  const [formRed, setFormRed] = useState<number>(30);
  const [formGreen, setFormGreen] = useState<number>(20);
  const [formAmber, setFormAmber] = useState<number>(5);
  // Polygon string represented as coordinates e.g., "50,400; 200,400; 200,550; 50,550"
  const [formParkingPoly, setFormParkingPoly] = useState<string>('');
  const [formActive, setFormActive] = useState<boolean>(true);

  // Retrieve junctions
  const fetchIntersections = () => {
    axios.get('http://localhost:8000/api/intersections')
      .then((res) => setIntersections(res.data))
      .catch(() => showToast('Failed to load intersections list.', 'error'));
  };

  useEffect(() => {
    fetchIntersections();
  }, [showToast]);

  // Open modal for adding
  const handleOpenAdd = () => {
    setIsEditMode(false);
    setFormId(`CAM-BTP-${(intersections.length + 1).toString().padStart(3, '0')}`);
    setFormName('');
    setFormAngle(0);
    setFormRoadType('One-Way (South → North)');
    setFormStopLineY(480);
    setFormRed(30);
    setFormGreen(20);
    setFormAmber(5);
    setFormParkingPoly('');
    setFormActive(true);
    setShowModal(true);
  };

  // Open modal for editing
  const handleOpenEdit = (cam: Intersection) => {
    setIsEditMode(true);
    setFormId(cam.id);
    setFormName(cam.name);
    setFormAngle(cam.allowed_direction_deg);
    setFormRoadType(cam.road_type);
    setFormStopLineY(cam.stop_line_y);
    setFormRed(cam.signal_cycle?.red || 30);
    setFormGreen(cam.signal_cycle?.green || 20);
    setFormAmber(cam.signal_cycle?.amber || 5);
    setFormActive(cam.active);
    
    // Format polygon: [[[x,y],[x,y]]] -> "x,y; x,y"
    if (cam.no_parking_zones && cam.no_parking_zones.length > 0) {
      const poly = cam.no_parking_zones[0];
      const str = poly.map(pt => `${pt[0]},${pt[1]}`).join('; ');
      setFormParkingPoly(str);
    } else {
      setFormParkingPoly('');
    }
    
    setShowModal(true);
  };

  // Toggle Camera state immediately
  const handleToggleActive = (id: string, currentVal: boolean) => {
    axios.patch(`http://localhost:8000/api/intersections/${id}`, { active: !currentVal })
      .then(() => {
        setIntersections(prev => prev.map(item => item.id === id ? { ...item, active: !currentVal } : item));
        showToast(`Camera feed ${id} ${!currentVal ? 'activated' : 'deactivated'}.`, 'success');
      })
      .catch(() => showToast('Failed to toggle camera active status.', 'error'));
  };

  // Delete handler
  const handleDeleteConfirm = (id: string) => {
    axios.delete(`http://localhost:8000/api/intersections/${id}`)
      .then(() => {
        setIntersections(prev => prev.filter(item => item.id !== id));
        setDeleteConfirmId(null);
        showToast(`Junction configuration ${id} removed from SQLite database.`, 'success');
      })
      .catch(() => showToast('Failed to delete intersection.', 'error'));
  };

  // Parse UI Coordinate string to nested polygon array: "50,400; 200,400" -> [[50,400],[200,400]]
  const parsePolygonString = (str: string): number[][] => {
    if (!str.trim()) return [];
    try {
      const pairs = str.split(';');
      const poly = pairs.map(p => {
        const coords = p.trim().split(',');
        return [parseInt(coords[0]), parseInt(coords[1])];
      });
      // Validate
      if (poly.some(pt => pt.length !== 2 || isNaN(pt[0]) || isNaN(pt[1]))) {
        throw new Error();
      }
      return poly;
    } catch {
      showToast('Invalid polygon coordinate format. Use format: x1,y1; x2,y2; x3,y3', 'error');
      return [];
    }
  };

  // Form submission handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      showToast('Intersection name is required.', 'error');
      return;
    }

    const polyParsed = parsePolygonString(formParkingPoly);
    const signalCycle = { red: formRed, green: formGreen, amber: formAmber };

    const payload = {
      id: formId,
      name: formName,
      allowed_direction_deg: formAngle,
      road_type: formRoadType,
      stop_line_y: formStopLineY,
      signal_cycle: signalCycle,
      no_parking_zones: polyParsed.length > 0 ? [polyParsed] : [],
      active: formActive
    };

    if (isEditMode) {
      axios.patch(`http://localhost:8000/api/intersections/${formId}`, payload)
        .then(() => {
          fetchIntersections();
          setShowModal(false);
          showToast('Junction config updated in SQLite.', 'success');
        })
        .catch((err) => showToast(err.response?.data?.detail || 'Failed to update intersection.', 'error'));
    } else {
      axios.post('http://localhost:8000/api/intersections', payload)
        .then(() => {
          fetchIntersections();
          setShowModal(false);
          showToast('New junction added and registered.', 'success');
        })
        .catch((err) => showToast(err.response?.data?.detail || 'Failed to register intersection.', 'error'));
    }
  };

  // Render SVG compass helper
  const renderCompassPreview = (deg: number) => {
    const rad = deg * Math.PI / 180;
    return (
      <div className="flex flex-col items-center gap-1.5 p-3.5 bg-warmSand border border-borderClay rounded-xl w-32 shrink-0">
        <span className="text-[9px] font-bold text-textSecondary uppercase font-mono tracking-wider">Compass Preview</span>
        <svg width="70" height="70" className="bg-white rounded-full border border-borderClay shadow-sm">
          <line x1="35" y1="5" x2="35" y2="65" stroke="#E7DED2" strokeWidth="1" strokeDasharray="1,1" />
          <line x1="5" y1="35" x2="65" y2="35" stroke="#E7DED2" strokeWidth="1" strokeDasharray="1,1" />
          <circle cx="35" cy="35" r="30" fill="none" stroke="#E7DED2" strokeWidth="1.2" />
          
          {/* Arrow pointing to allowed direction */}
          <line
            x1="35"
            y1="35"
            x2={35 + 23 * Math.sin(rad)}
            y2={35 - 23 * Math.cos(rad)}
            stroke="#A47148"
            strokeWidth="3"
            markerEnd="url(#compass-arrow)"
          />
          <circle cx="35" cy="35" r="3" fill="#2B2D42" />
          
          <defs>
            <marker id="compass-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 2 L 10 5 L 0 8 z" fill="#A47148" />
            </marker>
          </defs>
        </svg>
        <span className="text-[10px] font-mono font-bold text-textPrimary">{deg}° (UP=0°)</span>
      </div>
    );
  };

  return (
    <div className="pt-20 px-6 pb-6 min-h-screen flex flex-col gap-6 max-w-[1600px] mx-auto">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-borderClay pb-4">
        <div>
          <h2 className="text-xl font-bold text-textPrimary tracking-tight">Camera & Road Configurations</h2>
          <p className="text-xs text-textSecondary mt-0.5">Configure surveillance cameras, allowed vector headings, and restricted park zones</p>
        </div>
        <button onClick={handleOpenAdd} className="btn-primary text-xs">
          <Plus size={14} />
          Add Intersection Camera
        </button>
      </div>

      {/* Main Configurations Table */}
      <div className="desert-card overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-warmSand text-textSecondary uppercase tracking-wider font-semibold border-b border-borderClay">
                <th className="px-5 py-3">Camera ID</th>
                <th className="px-5 py-3">Intersection Name</th>
                <th className="px-5 py-3">Road Direction</th>
                <th className="px-5 py-3 text-center">Allowed Angle</th>
                <th className="px-5 py-3 text-center">Stop Line Y</th>
                <th className="px-5 py-3 text-center">Restricted Zones</th>
                <th className="px-5 py-3 text-center">Signal Red/Green/Amber</th>
                <th className="px-5 py-3 text-center">Active Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderClay/60">
              {intersections.length > 0 ? (
                intersections.map((cam) => (
                  <tr key={cam.id} className="hover:bg-warmSand/30 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-semibold text-textPrimary">{cam.id}</td>
                    <td className="px-5 py-3.5 font-semibold text-textPrimary">{cam.name}</td>
                    <td className="px-5 py-3.5 text-textSecondary">{cam.road_type}</td>
                    <td className="px-5 py-3.5 text-center font-mono font-semibold text-textPrimary">
                      <div className="flex items-center justify-center gap-1">
                        <Compass size={12} className="text-primary" />
                        {cam.allowed_direction_deg}°
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center font-mono font-semibold text-textPrimary">{cam.stop_line_y}px</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="bg-warmSand border border-borderClay px-2 py-0.5 rounded font-mono font-bold text-textPrimary">
                        {cam.no_parking_zones ? cam.no_parking_zones.length : 0} zones
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center font-mono text-textSecondary">
                      {cam.signal_cycle?.red || 30}s / {cam.signal_cycle?.green || 20}s / {cam.signal_cycle?.amber || 5}s
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => handleToggleActive(cam.id, cam.active)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                          cam.active ? 'bg-successGreen' : 'bg-slate-300'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 transform ${
                            cam.active ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-right flex justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(cam)}
                        className="btn-outline font-semibold py-1 px-2 border border-borderClay bg-white hover:bg-warmSand text-[10px]"
                      >
                        <Edit size={12} />
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(cam.id)}
                        className="btn-outline font-semibold py-1 px-2 border border-errorRust/20 hover:bg-errorRust/5 text-errorRust text-[10px]"
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-textSecondary">
                    No active intersections configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configurations Form Modal (Add / Edit) */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#23242A]/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-borderClay rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-borderClay flex items-center justify-between bg-warmSand">
                <h3 className="font-bold text-textPrimary text-base">
                  {isEditMode ? 'Modify Intersection Camera' : 'Add Intersection Camera'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-textSecondary hover:text-textPrimary p-1.5 border border-borderClay rounded-lg bg-white"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form Scroll Body */}
              <form onSubmit={handleSubmit} className="p-6 flex-grow overflow-y-auto flex flex-col gap-4 text-xs">
                
                {/* ID & Name */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-textSecondary font-semibold block mb-1">Camera ID</label>
                    <input
                      type="text"
                      disabled={isEditMode}
                      value={formId}
                      onChange={(e) => setFormId(e.target.value)}
                      className="w-full p-2 border border-borderClay rounded-xl bg-warmSand font-mono focus:outline-none focus:ring-1 focus:ring-primary text-textPrimary disabled:opacity-60"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-textSecondary font-semibold block mb-1">Intersection Name</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Silk Board Junction"
                      className="w-full p-2 border border-borderClay rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-primary text-textPrimary"
                      required
                    />
                  </div>
                </div>

                {/* Road Type Descriptor */}
                <div>
                  <label className="text-textSecondary font-semibold block mb-1">Road Layout Descriptor</label>
                  <input
                    type="text"
                    value={formRoadType}
                    onChange={(e) => setFormRoadType(e.target.value)}
                    placeholder="e.g. One-Way (South → North)"
                    className="w-full p-2 border border-borderClay rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-primary text-textPrimary"
                    required
                  />
                </div>

                {/* Vector compass allowed direction */}
                <div className="flex gap-4 items-center">
                  <div className="flex-grow">
                    <label className="text-textSecondary font-semibold block mb-1">Allowed Vector Angle (Degrees)</label>
                    <input
                      type="number"
                      min="0"
                      max="359"
                      value={formAngle}
                      onChange={(e) => setFormAngle(parseInt(e.target.value) || 0)}
                      className="w-full p-2 border border-borderClay rounded-xl bg-white font-mono focus:outline-none focus:ring-1 focus:ring-primary text-textPrimary"
                      required
                    />
                    <span className="text-[10px] text-textSecondary mt-1 block">Specify travel trajectory degree. UP=0°, RIGHT=90°, DOWN=180°, LEFT=270°.</span>
                  </div>
                  {renderCompassPreview(formAngle)}
                </div>

                {/* Stop Line Offset */}
                <div>
                  <label className="text-textSecondary font-semibold block mb-1">Stop Line Offset Y (Pixels)</label>
                  <input
                    type="number"
                    min="1"
                    max="640"
                    value={formStopLineY}
                    onChange={(e) => setFormStopLineY(parseInt(e.target.value) || 480)}
                    className="w-full p-2 border border-borderClay rounded-xl bg-white font-mono focus:outline-none focus:ring-1 focus:ring-primary text-textPrimary"
                    required
                  />
                  <span className="text-[10px] text-textSecondary mt-1 block">Signal stop-line threshold (usually row index 400-540 on 640x640 frame).</span>
                </div>

                {/* Signal Light Cycles */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-textSecondary font-semibold block mb-1">Red Signal (Sec)</label>
                    <input
                      type="number"
                      min="5"
                      value={formRed}
                      onChange={(e) => setFormRed(parseInt(e.target.value) || 30)}
                      className="w-full p-2 border border-borderClay rounded-xl bg-white font-mono focus:outline-none focus:ring-1 focus:ring-primary text-textPrimary"
                    />
                  </div>
                  <div>
                    <label className="text-textSecondary font-semibold block mb-1">Green Signal (Sec)</label>
                    <input
                      type="number"
                      min="5"
                      value={formGreen}
                      onChange={(e) => setFormGreen(parseInt(e.target.value) || 20)}
                      className="w-full p-2 border border-borderClay rounded-xl bg-white font-mono focus:outline-none focus:ring-1 focus:ring-primary text-textPrimary"
                    />
                  </div>
                  <div>
                    <label className="text-textSecondary font-semibold block mb-1">Amber Signal (Sec)</label>
                    <input
                      type="number"
                      min="2"
                      value={formAmber}
                      onChange={(e) => setFormAmber(parseInt(e.target.value) || 5)}
                      className="w-full p-2 border border-borderClay rounded-xl bg-white font-mono focus:outline-none focus:ring-1 focus:ring-primary text-textPrimary"
                    />
                  </div>
                </div>

                {/* No parking polygon coordinate pairs */}
                <div>
                  <label className="text-textSecondary font-semibold block mb-1">No-Parking Zone Polygon Vertices</label>
                  <textarea
                    rows={2}
                    value={formParkingPoly}
                    onChange={(e) => setFormParkingPoly(e.target.value)}
                    placeholder="e.g. 50,400; 200,400; 200,550; 50,550"
                    className="w-full p-2 border border-borderClay rounded-xl bg-white font-mono focus:outline-none focus:ring-1 focus:ring-primary text-textPrimary"
                  />
                  <span className="text-[9px] text-textSecondary mt-1 block">Restricted parking polygon corner coordinates on 640x640 canvas (comma and semicolon separated).</span>
                </div>

                {/* Active Switch */}
                <div className="flex items-center justify-between border-t border-borderClay pt-4 mt-2">
                  <div>
                    <span className="font-semibold text-textPrimary text-xs">Enable camera streaming</span>
                    <span className="text-[10px] text-textSecondary block mt-0.5">Whether this camera frame feed should be active for processing logs.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormActive(!formActive)}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                      formActive ? 'bg-successGreen' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 transform ${
                        formActive ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Buttons */}
                <div className="flex justify-end gap-3 mt-4 border-t border-borderClay pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn-outline py-2 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary py-2 text-xs"
                  >
                    Save Configuration
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Alert Dialouge */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#23242A]/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-borderClay p-6 rounded-2xl max-w-sm w-full shadow-2xl flex flex-col gap-4 text-xs"
            >
              <div className="flex items-start gap-3">
                <MapPin className="text-errorRust shrink-0 mt-0.5" size={18} />
                <div>
                  <h3 className="font-bold text-textPrimary text-sm">Delete Intersection Camera?</h3>
                  <p className="text-textSecondary mt-1 leading-normal">
                    Are you sure you want to delete camera configuration <span className="font-mono font-bold text-textPrimary">{deleteConfirmId}</span>? This action is permanent and will stop incoming stream detections.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-borderClay pt-4 mt-2">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="btn-outline py-1.5"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteConfirm(deleteConfirmId)}
                  className="btn-primary py-1.5 bg-errorRust hover:bg-errorRust/95"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
