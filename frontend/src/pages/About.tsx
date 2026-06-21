import React from 'react';
import { Shield, Eye, Cpu, BookOpen, Layers, Users, Zap, CheckCircle2, ChevronRight, Server, Compass, AlertCircle, FileText, Database } from 'lucide-react';

export const About: React.FC = () => {
  return (
    <div className="pt-20 px-6 pb-6 min-h-screen flex flex-col gap-8 max-w-[1200px] mx-auto">

      {/* Header Banner */}
      <div className="border-b border-borderClay pb-4">
        <h2 className="text-xl font-bold text-textPrimary tracking-tight">VisionGuard Intelligence Platform</h2>
        <p className="text-xs text-textSecondary mt-0.5">Automated Traffic Violation Detection & Evidence Generation System</p>
      </div>

      {/* Problem & Solution Split Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Problem */}
        <div className="desert-card p-6 bg-white flex flex-col gap-3">
          <div className="flex items-center gap-2 text-errorRust">
            <Shield size={18} className="stroke-[2.5]" />
            <h3 className="font-bold text-sm uppercase tracking-wide">The Surveillance Bottleneck</h3>
          </div>
          <p className="text-xs text-textSecondary leading-relaxed">
            Bengaluru traffic surveillance network captures millions of hours of CCTV feeds daily across 1000+ intersections.
            Currently, checking for helmet violations, triple riding, seatbelt compliance, and wrong-way movement requires manual
            inspection by officers at control rooms. This human-review pipeline leads to critical delays, mental fatigue, inconsistent
            violation logs, and a massive backlog of challans. Manual citation generation cannot scale to meet Bengaluru's traffic density.
          </p>
        </div>

        {/* Solution */}
        <div className="desert-card p-6 bg-white flex flex-col gap-3">
          <div className="flex items-center gap-2 text-successGreen">
            <CheckCircle2 size={18} />
            <h3 className="font-bold text-sm uppercase tracking-wide">VisionGuard Pipeline Solution</h3>
          </div>
          <p className="text-xs text-textSecondary leading-relaxed">
            VisionGuard automates the entire detection, classification, and citation pipeline. By running real-time, edge-compatible
            YOLOv8 vehicle bounding box trackers and EasyOCR plate readers, the system detects multiple simultaneous violations
            on different vehicles in a single frame. Automated image enhancement (CLAHE low-light boost, unsharp de-blur) guarantees
            accurate citations under adverse conditions (rain, shadows, night), printing PDF challan evidence packets instantly.
          </p>
        </div>
      </div>

      {/* 5-Step System Architecture Flow */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-primary" />
          <h3 className="font-bold text-textPrimary text-sm">System Pipeline Architecture</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
          {[
            { step: '1', title: 'Image Preprocessing', desc: 'Auto CLAHE low-light boost, de-blur and shadow correction.', icon: Eye },
            { step: '2', title: 'Vehicle Detection', desc: 'YOLOv8 inference classifies cars, bikes, trucks, and riders.', icon: Cpu },
            { step: '3', title: 'Violation Classifier', desc: '7-rule spatial heuristics evaluate wrong-way, stop-line and helmets.', icon: Compass },
            { step: '4', title: 'License Plate OCR', desc: 'Crops license plate region and extracts text via EasyOCR.', icon: Database },
            { step: '5', title: 'Evidence Generation', desc: 'Renders annotated evidence frames and exports PDF citations.', icon: FileText }
          ].map((item, idx) => (
            <React.Fragment key={idx}>
              <div className="desert-card p-4 bg-white flex flex-col gap-2 min-h-[140px] relative">
                <span className="absolute top-3 right-3 text-2xl font-bold text-borderClay font-mono">{item.step}</span>
                <div className="p-2 bg-warmSand text-primary rounded-lg border border-borderClay w-fit">
                  <item.icon size={16} />
                </div>
                <h4 className="font-bold text-textPrimary text-xs mt-1">{item.title}</h4>
                <p className="text-[10px] text-textSecondary leading-normal">{item.desc}</p>
              </div>
              {idx < 4 && (
                <div className="hidden md:flex justify-center text-borderClay">
                  <ChevronRight size={18} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 7 Violations Covered */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-primary" />
          <h3 className="font-bold text-textPrimary text-sm">Traffic Violation Coverage (7 Rules)</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: 'Wrong-Side Driving', desc: 'Evaluates vector angles via np.arctan2(dx, -dy) against permitted headings.', severity: 'HIGH' },
            { name: 'Helmet Non-Compliance', desc: 'Locates motorcycle-rider overlaps and runs Saturation checks on head crops.', severity: 'MEDIUM' },
            { name: 'Seatbelt Non-Compliance', desc: 'Crops occupant torsos and detects diagonal belt edges using Hough Lines.', severity: 'MEDIUM' },
            { name: 'Triple Riding', desc: 'Triggers if three or more overlapping person bounding boxes cover a single motorcycle.', severity: 'MEDIUM' },
            { name: 'Stop-Line Violation', desc: 'Registers vehicles crossing camera stop-line boundaries during red signals.', severity: 'HIGH' },
            { name: 'Red-Light Violation', desc: 'Logs stationary vehicles that accelerate past stop lines while signals are red.', severity: 'HIGH' },
            { name: 'Illegal Parking', desc: 'Monitors if stationary vehicles remain within no-parking polygons for > 5 seconds.', severity: 'LOW' }
          ].map((vio, idx) => (
            <div key={idx} className="desert-card p-4.5 bg-white flex flex-col justify-between min-h-[125px]">
              <div>
                <h4 className="font-bold text-textPrimary text-xs">{vio.name}</h4>
                <p className="text-[10px] text-textSecondary leading-normal mt-1.5">{vio.desc}</p>
              </div>
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded w-fit mt-2 ${vio.severity === 'HIGH' ? 'bg-errorRust/15 text-errorRust' :
                vio.severity === 'MEDIUM' ? 'bg-warningAmber/15 text-warningAmber' :
                  'bg-secondary/15 text-secondary'
                }`}>
                {vio.severity} SEVERITY
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Impact Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { metric: '< 2.0s', title: 'Inference Latency', desc: 'End-to-end preprocessing, detection, OCR, and emission latency.' },
          { metric: '94.7%', title: 'Challan Accuracy', desc: 'Validation accuracy evaluated against manually audited test video sets.' },
          { metric: '1000+', title: 'Camera Capacity', desc: 'Stateless server design allows massive concurrent scaling across junctions.' }
        ].map((item, idx) => (
          <div key={idx} className="desert-card p-5 bg-white text-center flex flex-col gap-2">
            <span className="text-3xl font-bold text-primary font-mono tracking-tight">{item.metric}</span>
            <span className="font-bold text-textPrimary text-xs">{item.title}</span>
            <span className="text-[10px] text-textSecondary leading-normal">{item.desc}</span>
          </div>
        ))}
      </div>

      {/* Tech Stack Grid */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Server size={16} className="text-primary" />
          <h3 className="font-bold text-textPrimary text-sm">Technology Stack Ecosystem</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs font-semibold">
          {[
            { name: 'React 18 & TS', label: 'Frontend Interface' },
            { name: 'FastAPI & Python', label: 'REST API & Workers' },
            { name: 'YOLOv8', label: 'Computer Vision AI' },
            { name: 'OpenCV & Pillow', label: 'Image Preprocessing' },
            { name: 'EasyOCR', label: 'License Plate OCR' },
            { name: 'Socket.IO', label: 'Real-time Streaming' },
            { name: 'SQLite & SQLAlchemy', label: 'Incident Log DB' },
            { name: 'ReportLab', label: 'Evidence PDF Generator' },
            { name: 'scikit-learn', label: 'Metrics Evaluator' },
            { name: 'Framer Motion', label: 'Refined UI Transitions' }
          ].map((tech, idx) => (
            <div key={idx} className="desert-card p-3 bg-white flex flex-col justify-center items-center">
              <span className="text-primary text-xs font-bold block">{tech.name}</span>
              <span className="text-[10px] text-textSecondary font-normal block mt-0.5">{tech.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Team Epoch One */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-primary" />
          <h3 className="font-bold text-textPrimary text-sm">Development Team</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {[
            { name: 'Abijith UK', role: 'Full Stack Developer' },
            { name: 'Mayuri Thakre', role: 'Machine Learning Engineer' },
            { name: 'Navyasri Saggam', role: 'Python Developer' },
            { name: 'Smridhad Bahu', role: 'QA Lead & Data Evaluator' }
          ].map((member, idx) => (
            <div key={idx} className="desert-card p-4 bg-white flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-warmSand border border-borderClay flex items-center justify-center font-bold text-primary text-xs shrink-0">
                {member.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="truncate">
                <span className="font-bold text-textPrimary text-xs block truncate">{member.name}</span>
                <span className="text-[10px] text-textSecondary block truncate mt-0.5">{member.role}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
