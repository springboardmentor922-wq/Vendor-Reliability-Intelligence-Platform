import React, { useState } from 'react';

// Tooltip helper component
const FloatingTooltip = ({ visible, x, y, content }) => {
  if (!visible || !content) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${y - 12}px`,
        transform: 'translate(-50%, -100%)',
        background: 'rgba(15, 23, 42, 0.92)',
        color: '#ffffff',
        padding: '6px 12px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '600',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        zIndex: 50,
        backdropFilter: 'blur(4px)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}
    >
      {content}
    </div>
  );
};

// 1. Dual Axis Bar + Line Chart (Procurement Overview, Cashflow, Order History)
export const DualAxisChart = ({
  data = [],
  barKey,
  lineKey,
  barLabel,
  lineLabel,
  barColor = '#0284c7',
  lineColor = '#f59e0b',
  height = 230,
  maxBar,
  maxLine,
  valuePrefix = '',
  valueSuffix = ''
}) => {
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: null });
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const width = 460;
  const padding = { top: 25, right: 40, bottom: 35, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const stepX = chartW / (data.length || 1);

  // Dynamic max calculation
  const computedMaxBar = maxBar || Math.max(10, Math.ceil(Math.max(...data.map(d => Number(d[barKey]) || 0), 10) * 1.15));
  const computedMaxLine = maxLine || Math.max(10, Math.ceil(Math.max(...data.map(d => Number(d[lineKey]) || 0), 10) * 1.15));

  const handleMouseMove = (e, content) => {
    const rect = e.currentTarget.closest('.chart-container').getBoundingClientRect();
    setTooltip({
      visible: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      content
    });
  };

  const handleMouseLeave = () => {
    setTooltip({ visible: false, x: 0, y: 0, content: null });
    setHoveredIdx(null);
  };

  return (
    <div className="chart-container" style={{ position: 'relative', width: '100%', overflowX: 'auto' }} onMouseLeave={handleMouseLeave}>
      <FloatingTooltip visible={tooltip.visible} x={tooltip.x} y={tooltip.y} content={tooltip.content} />
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = padding.top + chartH * (1 - ratio);
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
              <text x={padding.left - 6} y={y + 4} fontSize="9" fill="#94a3b8" textAnchor="end">
                {Math.round(ratio * computedMaxBar)}
              </text>
              <text x={width - padding.right + 6} y={y + 4} fontSize="9" fill="#94a3b8" textAnchor="start">
                {Math.round(ratio * computedMaxLine)}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const barVal = Number(d[barKey]) || 0;
          const barH = (barVal / computedMaxBar) * chartH;
          const x = padding.left + i * stepX + (stepX - 24) / 2;
          const y = padding.top + chartH - barH;
          const isHovered = hoveredIdx === i;

          return (
            <g key={`bar-${i}`} onMouseEnter={() => setHoveredIdx(i)}>
              <rect
                x={x}
                y={y}
                width="24"
                height={Math.max(3, barH)}
                fill={isHovered ? '#0369a1' : barColor}
                rx="4"
                style={{
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'pointer',
                  filter: isHovered ? 'drop-shadow(0 2px 6px rgba(2, 132, 199, 0.4))' : 'none'
                }}
                onMouseMove={(e) =>
                  handleMouseMove(
                    e,
                    <span>
                      <strong>{d.month}</strong> — {barLabel}: {valuePrefix}{barVal.toLocaleString()}{valueSuffix}
                    </span>
                  )
                }
              />
              <text
                x={padding.left + i * stepX + stepX / 2}
                y={height - 12}
                fontSize="10"
                fill={isHovered ? 'var(--primary-color)' : '#64748b'}
                textAnchor="middle"
                fontWeight={isHovered ? '700' : '600'}
              >
                {d.month}
              </text>
            </g>
          );
        })}

        {(() => {
          const points = data.map((d, i) => {
            const lineVal = Number(d[lineKey]) || 0;
            const x = padding.left + i * stepX + stepX / 2;
            const y = padding.top + chartH - (lineVal / computedMaxLine) * chartH;
            return { x, y, val: lineVal, month: d.month };
          });
          const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

          return (
            <g>
              <path
                d={pathD}
                fill="none"
                stroke={lineColor}
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transition: 'all 0.3s ease' }}
              />
              {points.map((p, i) => {
                const isHovered = hoveredIdx === i;
                return (
                  <circle
                    key={`dot-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={isHovered ? 6.5 : 4.5}
                    fill={lineColor}
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      filter: isHovered ? 'drop-shadow(0 2px 6px rgba(245, 158, 11, 0.5))' : 'none'
                    }}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseMove={(e) =>
                      handleMouseMove(
                        e,
                        <span>
                          <strong>{p.month}</strong> — {lineLabel}: {valuePrefix}{p.val.toLocaleString()}{valueSuffix}
                        </span>
                      )
                    }
                  />
                );
              })}
            </g>
          );
        })()}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '11.5px', marginTop: '6px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
          <span style={{ width: '10px', height: '10px', background: barColor, borderRadius: '2px', display: 'inline-block' }} />
          {barLabel}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
          <span style={{ width: '14px', height: '3px', background: lineColor, display: 'inline-block' }} />
          {lineLabel}
        </span>
      </div>
    </div>
  );
};

// 2. Interactive Donut Chart with Hover Slices & Dynamic Center Text
export const DonutChart = ({ data = [], centerValue, centerLabel, size = 190, strokeWidth = 26 }) => {
  const [activeIdx, setActiveIdx] = useState(null);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((acc, d) => acc + (Number(d.value) || 0), 0) || 1;

  let accumulated = 0;
  const slices = data.map((d, index) => {
    const val = Number(d.value) || 0;
    const pct = val / total;
    const strokeDashoffset = circumference * (1 - accumulated);
    const strokeDasharray = `${circumference * pct} ${circumference * (1 - pct)}`;
    accumulated += pct;
    return { ...d, strokeDashoffset, strokeDasharray, pctVal: Math.round(pct * 100), index };
  });

  const activeSlice = activeIdx !== null ? slices[activeIdx] : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
          {slices.map((s, idx) => {
            const isHovered = activeIdx === idx;
            return (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={s.color || '#0284c7'}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={s.strokeDasharray}
                strokeDashoffset={s.strokeDashoffset}
                style={{
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'pointer',
                  opacity: activeIdx === null || isHovered ? 1 : 0.6,
                  filter: isHovered ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.25))' : 'none'
                }}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(null)}
              />
            );
          })}
        </svg>

        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            pointerEvents: 'none',
            padding: '10px'
          }}
        >
          {activeSlice ? (
            <>
              <span style={{ fontSize: '18px', fontWeight: 800, color: activeSlice.color || 'var(--primary-color)', lineHeight: 1.2 }}>
                {activeSlice.pct !== undefined ? `${activeSlice.pct}%` : `${activeSlice.pctVal}%`}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 700, marginTop: '2px', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeSlice.name}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>
                {Number(activeSlice.value).toLocaleString()}
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                {centerValue || total}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '2px' }}>
                {centerLabel || 'Total'}
              </span>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', minWidth: '135px' }}>
        {data.map((item, i) => {
          const isHovered = activeIdx === i;
          return (
            <div
              key={i}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseLeave={() => setActiveIdx(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                cursor: 'pointer',
                padding: '3px 6px',
                borderRadius: '6px',
                background: isHovered ? 'var(--hover-bg, #f8fafc)' : 'transparent',
                transition: 'background 0.2s ease',
                transform: isHovered ? 'translateX(2px)' : 'none'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                <span style={{ color: isHovered ? 'var(--primary-color)' : 'var(--text-primary)', fontWeight: isHovered ? 700 : 500 }}>
                  {item.name}
                </span>
              </span>
              <span style={{ fontWeight: 700, color: isHovered ? 'var(--primary-color)' : 'var(--text-muted)' }}>
                {item.pct !== undefined ? `${item.pct}%` : `${Math.round(((Number(item.value) || 0) / total) * 100)}%`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 3. Spider / Radar Chart with Interactive Vertices
export const RadarChart = ({ data = [], size = 230 }) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const center = size / 2;
  const radius = size * 0.36;
  const numAxes = data.length || 5;
  const angleSlice = (Math.PI * 2) / numAxes;

  const levels = [0.2, 0.4, 0.6, 0.8, 1.0];

  const getCoordinates = (index, valuePct) => {
    const angle = angleSlice * index - Math.PI / 2;
    const r = radius * (valuePct / 100);
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  };

  const topVendorPath = data.map((d, i) => {
    const coord = getCoordinates(i, d.top_vendor || 80);
    return `${i === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`;
  }).join(' ') + ' Z';

  const averagePath = data.map((d, i) => {
    const coord = getCoordinates(i, d.average || 60);
    return `${i === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`;
  }).join(' ') + ' Z';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {levels.map((lvl, lIdx) => {
          const polyPoints = Array.from({ length: numAxes }).map((_, i) => {
            const coord = getCoordinates(i, lvl * 100);
            return `${coord.x},${coord.y}`;
          }).join(' ');
          return (
            <polygon key={lIdx} points={polyPoints} fill="none" stroke="#e2e8f0" strokeWidth="1" />
          );
        })}

        {data.map((d, i) => {
          const end = getCoordinates(i, 100);
          const labelCoord = getCoordinates(i, 118);
          const isHovered = hoveredIdx === i;
          return (
            <g key={i} onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)} style={{ cursor: 'pointer' }}>
              <line x1={center} y1={center} x2={end.x} y2={end.y} stroke={isHovered ? '#8b5cf6' : '#cbd5e1'} strokeWidth={isHovered ? '2' : '1'} />
              <text
                x={labelCoord.x}
                y={labelCoord.y + 4}
                fontSize="9.5"
                fill={isHovered ? '#8b5cf6' : '#475569'}
                fontWeight={isHovered ? '700' : '600'}
                textAnchor="middle"
              >
                {d.subject}
              </text>
            </g>
          );
        })}

        <path d={topVendorPath} fill="rgba(139, 92, 246, 0.25)" stroke="#8b5cf6" strokeWidth="2.2" />
        <path d={averagePath} fill="rgba(2, 132, 199, 0.18)" stroke="#0284c7" strokeWidth="1.8" strokeDasharray="3 3" />

        {/* Interactive Vertex Dots */}
        {data.map((d, i) => {
          const topCoord = getCoordinates(i, d.top_vendor || 80);
          const avgCoord = getCoordinates(i, d.average || 60);
          const isHovered = hoveredIdx === i;
          return (
            <g key={`dots-${i}`} onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)} style={{ cursor: 'pointer' }}>
              <circle cx={topCoord.x} cy={topCoord.y} r={isHovered ? 5.5 : 3.5} fill="#8b5cf6" stroke="#ffffff" strokeWidth="1.5" />
              <circle cx={avgCoord.x} cy={avgCoord.y} r={isHovered ? 4.5 : 3} fill="#0284c7" stroke="#ffffff" strokeWidth="1.5" />
            </g>
          );
        })}
      </svg>

      {hoveredIdx !== null && data[hoveredIdx] && (
        <div style={{ marginTop: '4px', fontSize: '11.5px', background: '#f8fafc', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', color: '#1e293b' }}>
          <strong>{data[hoveredIdx].subject}</strong>: Top Vendor <span style={{ color: '#8b5cf6', fontWeight: 700 }}>{data[hoveredIdx].top_vendor}%</span> | Avg <span style={{ color: '#0284c7', fontWeight: 700 }}>{data[hoveredIdx].average}%</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '16px', fontSize: '11px', marginTop: '6px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '10px', height: '10px', background: '#8b5cf6', borderRadius: '2px', display: 'inline-block' }} />
          Top Vendor (Target)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '10px', height: '10px', background: '#0284c7', borderRadius: '2px', display: 'inline-block' }} />
          Average Industry
        </span>
      </div>
    </div>
  );
};

// 4. Delivery Status Half-Gauge Chart
export const HalfGaugeChart = ({ percentage = 78, items = [], title = "On-Time Delivery" }) => {
  const [hovered, setHovered] = useState(false);
  const size = 180;
  const radius = 68;
  const strokeWidth = 16;
  const circumference = Math.PI * radius;
  const progress = (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <div
        style={{ position: 'relative', width: size, height: size / 2 + 25, cursor: 'pointer' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          <path
            d={`M ${size / 2 - radius} ${size / 2 + 10} A ${radius} ${radius} 0 0 1 ${size / 2 + radius} ${size / 2 + 10}`}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          <path
            d={`M ${size / 2 - radius} ${size / 2 + 10} A ${radius} ${radius} 0 0 1 ${size / 2 + radius} ${size / 2 + 10}`}
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth={hovered ? strokeWidth + 2 : strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`}
            style={{ transition: 'all 0.5s ease' }}
          />
        </svg>

        <div
          style={{
            position: 'absolute',
            bottom: 6,
            left: 0,
            width: '100%',
            textAlign: 'center',
            transform: hovered ? 'scale(1.05)' : 'scale(1)',
            transition: 'transform 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{percentage}%</div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>{title}</div>
        </div>
      </div>

      <div style={{ width: '100%', marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px' }}>
        {items.map((it, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: it.color }} />
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{it.label}</span>
            </span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              {it.pct}% <span style={{ color: '#94a3b8', fontWeight: 400 }}>({it.count})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// 5. Grouped Bar Chart with Interactive Hover & Tooltips
export const GroupedBarChart = ({
  data = [],
  categories = ['delivery', 'quality', 'communication', 'compliance'],
  colors = ['#0284c7', '#10b981', '#f59e0b', '#8b5cf6'],
  height = 210,
  maxVal = 100
}) => {
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: null });

  const width = 460;
  const padding = { top: 20, right: 15, bottom: 30, left: 32 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const groupW = chartW / (data.length || 1);
  const barW = (groupW - 14) / categories.length;

  const handleMouseMove = (e, content) => {
    const rect = e.currentTarget.closest('.chart-container').getBoundingClientRect();
    setTooltip({
      visible: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      content
    });
  };

  const handleMouseLeave = () => {
    setTooltip({ visible: false, x: 0, y: 0, content: null });
  };

  return (
    <div className="chart-container" style={{ position: 'relative', width: '100%', overflowX: 'auto' }} onMouseLeave={handleMouseLeave}>
      <FloatingTooltip visible={tooltip.visible} x={tooltip.x} y={tooltip.y} content={tooltip.content} />
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {[0, 25, 50, 75, 100].map((val) => {
          const y = padding.top + chartH * (1 - val / 100);
          return (
            <g key={val}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#f1f5f9" strokeDasharray="2 2" />
              <text x={padding.left - 4} y={y + 3} fontSize="9" fill="#94a3b8" textAnchor="end">
                {val}
              </text>
            </g>
          );
        })}

        {data.map((d, gIdx) => {
          const groupX = padding.left + gIdx * groupW + 7;
          return (
            <g key={gIdx}>
              {categories.map((catKey, cIdx) => {
                const val = Number(d[catKey]) || 0;
                const barH = (val / maxVal) * chartH;
                const bx = groupX + cIdx * barW;
                const by = padding.top + chartH - barH;
                return (
                  <rect
                    key={cIdx}
                    x={bx}
                    y={by}
                    width={Math.max(2, barW - 2)}
                    height={Math.max(2, barH)}
                    fill={colors[cIdx]}
                    rx="3"
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                    onMouseMove={(e) =>
                      handleMouseMove(
                        e,
                        <span>
                          <strong>{d.vendor}</strong> — {catKey}: <span style={{ color: colors[cIdx] }}>{val}%</span>
                        </span>
                      )
                    }
                  />
                );
              })}
              <text x={groupX + (groupW - 14) / 2} y={height - 10} fontSize="10" fill="#64748b" textAnchor="middle" fontWeight="600">
                {d.vendor}
              </text>
            </g>
          );
        })}
      </svg>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', fontSize: '11px', marginTop: '6px', flexWrap: 'wrap' }}>
        {categories.map((c, i) => (
          <span key={c} style={{ display: 'flex', alignItems: 'center', gap: '5px', textTransform: 'capitalize' }}>
            <span style={{ width: '8px', height: '8px', background: colors[i], borderRadius: '2px', display: 'inline-block' }} />
            {c}
          </span>
        ))}
      </div>
    </div>
  );
};

// 6. Line Trend Chart with Gradient Fill & Active Point Markers
export const LineTrendChart = ({ data = [], keyName = 'score', height = 190, color = '#10b981', valueSuffix = '%' }) => {
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: null });

  const width = 440;
  const padding = { top: 25, right: 30, bottom: 25, left: 32 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const stepX = chartW / (data.length - 1 || 1);

  const points = data.map((d, i) => {
    const val = Number(d[keyName]) || 0;
    return {
      x: padding.left + i * stepX,
      y: padding.top + chartH - (val / 100) * chartH,
      val: val,
      month: d.month
    };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const handleMouseMove = (e, content) => {
    const rect = e.currentTarget.closest('.chart-container').getBoundingClientRect();
    setTooltip({
      visible: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      content
    });
  };

  const handleMouseLeave = () => {
    setTooltip({ visible: false, x: 0, y: 0, content: null });
  };

  return (
    <div className="chart-container" style={{ position: 'relative', width: '100%', overflowX: 'auto' }} onMouseLeave={handleMouseLeave}>
      <FloatingTooltip visible={tooltip.visible} x={tooltip.x} y={tooltip.y} content={tooltip.content} />
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {[0, 25, 50, 75, 100].map((v) => {
          const y = padding.top + chartH * (1 - v / 100);
          return (
            <g key={v}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#f1f5f9" strokeDasharray="2 2" />
              <text x={padding.left - 4} y={y + 3} fontSize="9" fill="#94a3b8" textAnchor="end">
                {v}
              </text>
            </g>
          );
        })}

        {points.length > 0 && (
          <path
            d={`${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`}
            fill={`${color}1a`}
          />
        )}

        <path d={pathD} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r="5"
              fill={color}
              stroke="#ffffff"
              strokeWidth="2.5"
              style={{ cursor: 'pointer', transition: 'r 0.2s ease' }}
              onMouseMove={(e) =>
                handleMouseMove(
                  e,
                  <span>
                    <strong>{p.month}</strong>: {p.val}{valueSuffix}
                  </span>
                )
              }
            />
            <text x={p.x} y={p.y - 9} fontSize="9.5" fill={color} fontWeight="700" textAnchor="middle">
              {p.val}{valueSuffix}
            </text>
            <text x={p.x} y={height - 6} fontSize="10" fill="#64748b" textAnchor="middle" fontWeight="600">
              {p.month}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

// 7. Horizontal Risk Tier Bar Chart with Tooltip & Hover Animation
export const HorizontalBarChart = ({
  data = {},
  colors = { 'Low Risk': '#10b981', 'Medium Risk': '#f59e0b', 'High Risk': '#ea580c', 'Critical Risk': '#f43f5e' }
}) => {
  const [hoveredTier, setHoveredTier] = useState(null);
  const values = Object.values(data).map(v => Number(v) || 0);
  const maxVal = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', padding: '8px 0' }}>
      {Object.entries(data).map(([tier, count]) => {
        const val = Number(count) || 0;
        const pct = Math.min(100, Math.round((val / maxVal) * 100));
        const totalPct = Math.round((val / total) * 100);
        const isHovered = hoveredTier === tier;

        return (
          <div
            key={tier}
            onMouseEnter={() => setHoveredTier(tier)}
            onMouseLeave={() => setHoveredTier(null)}
            style={{ cursor: 'pointer', transition: 'transform 0.15s ease', transform: isHovered ? 'translateX(3px)' : 'none' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
              <span style={{ fontWeight: isHovered ? 700 : 600, color: 'var(--text-primary)' }}>{tier}</span>
              <span style={{ fontWeight: 700, color: colors[tier] || '#64748b' }}>
                {val} Vendors <span style={{ color: '#94a3b8', fontWeight: 500 }}>({totalPct}%)</span>
              </span>
            </div>
            <div style={{ width: '100%', height: '14px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: colors[tier] || '#0284c7',
                  borderRadius: '6px',
                  transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isHovered ? `0 0 8px ${colors[tier] || '#0284c7'}` : 'none'
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
