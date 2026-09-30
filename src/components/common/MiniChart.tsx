import React, { useState } from 'react';

/**
 * Clean SVG-based responsive Line Chart
 */
export const LineTrendChart: React.FC<{
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  unit?: string;
}> = ({ data, color = '#38bdf8', height = 140, unit = '%' }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length < 2) {
    return <div className="text-xs text-slate-500 py-4 text-center">Insufficient trend points</div>;
  }

  const values = data.map(d => d.value);
  const minVal = Math.floor(Math.min(...values) * 0.85);
  const maxVal = Math.ceil(Math.max(...values) * 1.05) || 100;
  const range = maxVal - minVal || 1;

  const width = 360;
  const paddingX = 25;
  const paddingY = 20;
  const graphWidth = width - paddingX * 2;
  const graphHeight = height - paddingY * 2;

  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * graphWidth;
    const y = paddingY + graphHeight - ((d.value - minVal) / range) * graphHeight;
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`), '');
  const areaD = `${pathD} L ${points[points.length - 1].x},${height - paddingY} L ${points[0].x},${height - paddingY} Z`;

  return (
    <div className="relative w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="#334155" strokeDasharray="3 3" opacity="0.4" />
        <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="#334155" strokeDasharray="3 3" opacity="0.4" />
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#334155" strokeWidth="1" opacity="0.6" />

        {/* Area fill */}
        <path d={areaD} fill={`url(#grad-${color.replace('#', '')})`} />

        {/* Line stroke */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {points.map((pt, i) => (
          <g key={i} className="cursor-pointer" onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}>
            <circle
              cx={pt.x}
              cy={pt.y}
              r={hoveredIdx === i ? 6 : 3.5}
              fill={hoveredIdx === i ? '#ffffff' : color}
              stroke="#0f172a"
              strokeWidth="2"
              className="transition-all duration-150"
            />
            <text
              x={pt.x}
              y={height - 4}
              textAnchor="middle"
              className="text-[9px] fill-slate-400 select-none font-medium"
            >
              {pt.label.split(' ')[0]}
            </text>
          </g>
        ))}
      </svg>

      {hoveredIdx !== null && (
        <div
          className="absolute pointer-events-none rounded bg-slate-900/95 border border-slate-700 px-2 py-1 text-xs text-white shadow-xl z-20"
          style={{
            left: `${(points[hoveredIdx].x / width) * 100}%`,
            top: `${(points[hoveredIdx].y / height) * 60}%`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-semibold text-sky-400">{data[hoveredIdx].label}</div>
          <div className="font-mono">{data[hoveredIdx].value}{unit}</div>
        </div>
      )}
    </div>
  );
};

/**
 * Score Radial Gauge for Reliability Score (0-100)
 */
export const ScoreGauge: React.FC<{
  score: number;
  label?: string;
  size?: number;
}> = ({ score, label = 'Reliability Score', size = 130 }) => {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 85) return '#10b981'; // emerald
    if (s >= 70) return '#3b82f6'; // blue
    if (s >= 50) return '#f59e0b'; // amber
    return '#f43f5e'; // rose
  };

  const ringColor = getColor(score);

  return (
    <div className="flex flex-col items-center justify-center p-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={radius}
            stroke="#1e293b"
            strokeWidth="10"
            fill="transparent"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            stroke={ringColor}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black font-mono tracking-tight text-white">{score}</span>
          <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">/100</span>
        </div>
      </div>
      <span className="text-xs font-medium text-slate-300 mt-1">{label}</span>
    </div>
  );
};

/**
 * Simple Bar Chart for Categories / Cost Breakdown
 */
export const CategoryBarChart: React.FC<{
  data: { label: string; value: number; formatted?: string; color?: string }[];
}> = ({ data }) => {
  const maxVal = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="space-y-3 w-full">
      {data.map((item, idx) => {
        const percent = Math.round((item.value / maxVal) * 100);
        const barColor = item.color || '#3b82f6';

        return (
          <div key={idx} className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-300 truncate max-w-[200px]">{item.label}</span>
              <span className="text-slate-200 font-mono">{item.formatted || `$${item.value.toLocaleString()}`}</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${percent}%`, backgroundColor: barColor }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
