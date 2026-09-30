import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { formatRupees } from '../../utils/currencyUtils';

// Vibrant Modern Palette Constants
export const CHART_PALETTE = {
  blue: '#38bdf8',       // Sky blue
  emerald: '#10b981',    // Emerald green
  purple: '#a855f7',     // Deep purple
  coral: '#f43f5e',      // Vibrant Coral/Rose
  yellow: '#facc15',     // Warm yellow
  amber: '#f59e0b',      // Amber
  orange: '#f97316',     // Orange
  indigo: '#6366f1',     // Indigo
  teal: '#14b8a6',       // Teal
  cyan: '#06b6d4',       // Cyan
  pink: '#ec4899',       // Pink
};

// Custom Glassmorphism Tooltip for Recharts
export const GlassTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-md text-xs z-50 min-w-[140px]">
      {label && <p className="font-bold text-white mb-1.5 border-b border-slate-800 pb-1">{label}</p>}
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => {
          const val = formatter ? formatter(entry.value, entry.name) : entry.value;
          return (
            <div key={`item-${index}`} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-sm"
                  style={{ backgroundColor: entry.color || entry.fill || '#38bdf8' }}
                />
                <span className="text-slate-300 font-medium">{entry.name}:</span>
              </div>
              <span className="font-mono font-bold text-white">{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 1. Dual-Axis Procurement Overview Chart (Bar: Cost, Line: POs)
// -------------------------------------------------------------
interface DualAxisProcurementProps {
  data: {
    period: string;
    cost: number;
    poCount: number;
  }[];
  height?: number;
}

export const ProcurementOverviewChart: React.FC<DualAxisProcurementProps> = ({
  data,
  height = 290,
}) => {
  const [visibleSeries, setVisibleSeries] = useState<{ cost: boolean; poCount: boolean }>({
    cost: true,
    poCount: true,
  });

  const handleLegendClick = (e: any) => {
    const { dataKey } = e;
    if (dataKey === 'cost' || dataKey === 'poCount') {
      setVisibleSeries((prev) => ({
        ...prev,
        [dataKey]: !prev[dataKey as 'cost' | 'poCount'],
      }));
    }
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="costBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} vertical={false} />
          <XAxis
            dataKey="period"
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
          />
          <YAxis
            yAxisId="left"
            stroke="#38bdf8"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
            tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#10b981"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `${val} POs`}
          />
          <Tooltip
            content={
              <GlassTooltip
                formatter={(val: number, name: string) =>
                  name === 'Procurement Cost' ? formatRupees(val) : `${val} Orders`
                }
              />
            }
          />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
            onClick={handleLegendClick}
            formatter={(value, entry: any) => {
              const key = entry.dataKey as 'cost' | 'poCount';
              const isHidden = !visibleSeries[key];
              return (
                <span
                  className={`cursor-pointer transition-opacity select-none ${
                    isHidden ? 'line-through opacity-40 text-slate-500' : 'text-slate-200 font-semibold'
                  }`}
                >
                  {value}
                </span>
              );
            }}
          />
          {visibleSeries.cost && (
            <Bar
              yAxisId="left"
              dataKey="cost"
              name="Procurement Cost"
              fill="url(#costBarGrad)"
              radius={[6, 6, 0, 0]}
              maxBarSize={42}
              animationDuration={800}
            />
          )}
          {visibleSeries.poCount && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="poCount"
              name="Number of POs"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 4, fill: '#10b981', stroke: '#0f172a', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#34d399', stroke: '#ffffff', strokeWidth: 2 }}
              animationDuration={1000}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// -------------------------------------------------------------
// 2. Active Purchase Orders Donut Chart (With Center Total)
// -------------------------------------------------------------
export interface ActivePODonutItem {
  name: string;
  count: number;
  color: string;
  statusKey?: string;
}

interface ActivePODonutProps {
  data: ActivePODonutItem[];
  totalCount: number;
  height?: number;
  onFilterStatus?: (status: string) => void;
  selectedStatus?: string | null;
}

export const ActivePurchaseOrdersDonutChart: React.FC<ActivePODonutProps> = ({
  data,
  totalCount,
  height = 260,
  onFilterStatus,
  selectedStatus,
}) => {
  const [hoveredSlice, setHoveredSlice] = useState<ActivePODonutItem | null>(null);

  return (
    <div className="relative w-full flex flex-col items-center justify-center">
      <div className="w-full relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={
                <GlassTooltip
                  formatter={(val: number) => {
                    const pct = totalCount > 0 ? ((val / totalCount) * 100).toFixed(1) : '0';
                    return `${val} POs (${pct}%)`;
                  }}
                />
              }
            />
            <Pie
              data={data}
              dataKey="count"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={96}
              paddingAngle={4}
              cornerRadius={6}
              onClick={(entry) => onFilterStatus && onFilterStatus(entry.name)}
              onMouseEnter={(entry) => setHoveredSlice(entry)}
              onMouseLeave={() => setHoveredSlice(null)}
              cursor="pointer"
              animationDuration={800}
            >
              {data.map((entry, index) => {
                const isSelected = selectedStatus === entry.name;
                const isDimmed = selectedStatus && !isSelected;
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    opacity={isDimmed ? 0.35 : 1}
                    stroke={isSelected ? '#ffffff' : '#0f172a'}
                    strokeWidth={isSelected ? 3 : 1.5}
                  />
                );
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Dynamic Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {hoveredSlice ? hoveredSlice.name : 'Active POs'}
          </span>
          <span className="text-2xl font-black text-white font-mono tracking-tight">
            {hoveredSlice ? hoveredSlice.count : totalCount}
          </span>
          <span className="text-[10px] text-slate-400">
            {hoveredSlice
              ? `${totalCount > 0 ? ((hoveredSlice.count / totalCount) * 100).toFixed(0) : 0}% of Total`
              : 'Orders In Pipeline'}
          </span>
        </div>
      </div>

      {/* Interactive Legend with click filtering */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-2 w-full">
        {data.map((item) => {
          const isSelected = selectedStatus === item.name;
          return (
            <button
              key={item.name}
              onClick={() => onFilterStatus && onFilterStatus(item.name)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                isSelected
                  ? 'bg-slate-800 border-white text-white shadow-md'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span>{item.name}</span>
              <span className="font-mono text-slate-400 text-[11px]">({item.count})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 3. Vendor Performance Summary Radar / Spider Chart
// -------------------------------------------------------------
export interface RadarAttributeItem {
  attribute: string; // e.g. Delivery, Quality, Communication, Compliance, Cost Efficiency
  average: number;
  topPerformer: number;
}

interface VendorRadarProps {
  data: RadarAttributeItem[];
  height?: number;
}

export const VendorPerformanceRadarChart: React.FC<VendorRadarProps> = ({
  data,
  height = 280,
}) => {
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="#334155" opacity={0.6} />
          <PolarAngleAxis dataKey="attribute" stroke="#cbd5e1" fontSize={11} fontStyle="bold" />
          <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#64748b" fontSize={10} />
          <Tooltip
            content={
              <GlassTooltip
                formatter={(val: number) => `${val}/100`}
              />
            }
          />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ paddingBottom: '10px', fontSize: '12px' }}
          />
          <Radar
            name="Vendor Average"
            dataKey="average"
            stroke="#38bdf8"
            fill="#38bdf8"
            fillOpacity={0.4}
            strokeWidth={2}
            animationDuration={800}
          />
          <Radar
            name="Top Performers (Tier 1)"
            dataKey="topPerformer"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.45}
            strokeWidth={2}
            animationDuration={1000}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

// -------------------------------------------------------------
// 4. Procurement Cost Breakdown Donut Chart
// -------------------------------------------------------------
export interface CategoryCostItem {
  category: string;
  cost: number;
  color: string;
}

interface CategoryCostDonutProps {
  data: CategoryCostItem[];
  totalCost: number;
  height?: number;
}

export const ProcurementCostDonutChart: React.FC<CategoryCostDonutProps> = ({
  data,
  totalCost,
  height = 260,
}) => {
  const [hoveredSlice, setHoveredSlice] = useState<CategoryCostItem | null>(null);

  return (
    <div className="relative w-full flex flex-col items-center justify-center">
      <div className="w-full relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={
                <GlassTooltip
                  formatter={(val: number) => {
                    const pct = totalCost > 0 ? ((val / totalCost) * 100).toFixed(1) : '0';
                    return `${formatRupees(val)} (${pct}%)`;
                  }}
                />
              }
            />
            <Pie
              data={data}
              dataKey="cost"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={96}
              paddingAngle={4}
              cornerRadius={6}
              onMouseEnter={(entry) => setHoveredSlice(entry)}
              onMouseLeave={() => setHoveredSlice(null)}
              cursor="pointer"
              animationDuration={800}
            >
              {data.map((entry, index) => (
                <Cell key={`cost-cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Total / Hover Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {hoveredSlice ? hoveredSlice.category : 'Total Spend'}
          </span>
          <span className="text-xl font-black text-white font-mono tracking-tight">
            {hoveredSlice ? formatRupees(hoveredSlice.cost) : formatRupees(totalCost)}
          </span>
          <span className="text-[10px] text-slate-400">
            {hoveredSlice
              ? `${totalCost > 0 ? ((hoveredSlice.cost / totalCost) * 100).toFixed(1) : 0}% Share`
              : 'All Categories'}
          </span>
        </div>
      </div>

      {/* Legend Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 w-full text-xs">
        {data.map((item) => (
          <div
            key={item.category}
            className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950/60 border border-slate-800"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-slate-300 font-medium truncate">{item.category}</span>
            </div>
            <span className="font-mono text-white font-bold ml-1">{formatRupees(item.cost)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 5. Delivery Status Semi-Circle Gauge & Breakdown
// -------------------------------------------------------------
interface DeliveryStatusGaugeProps {
  onTimePercentage: number;
  deliveredCount: number;
  inTransitCount: number;
  delayedCount: number;
  cancelledCount: number;
}

export const DeliveryStatusProgressGauge: React.FC<DeliveryStatusGaugeProps> = ({
  onTimePercentage,
  deliveredCount,
  inTransitCount,
  delayedCount,
  cancelledCount,
}) => {
  const total = deliveredCount + inTransitCount + delayedCount + cancelledCount || 1;

  // Gauge calculations for SVG Semi-Circle
  const radius = 70;
  const strokeWidth = 14;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, onTimePercentage)) / 100) * circumference;

  const getGaugeColor = (pct: number) => {
    if (pct >= 90) return '#10b981'; // emerald
    if (pct >= 75) return '#38bdf8'; // blue
    if (pct >= 60) return '#f59e0b'; // amber
    return '#f43f5e'; // rose
  };

  const gaugeColor = getGaugeColor(onTimePercentage);

  return (
    <div className="space-y-4">
      {/* Semi-Circle SVG Gauge */}
      <div className="relative flex flex-col items-center justify-center pt-2">
        <svg width="180" height="105" viewBox="0 0 180 105" className="overflow-visible">
          {/* Background Arc */}
          <path
            d="M 15 95 A 75 75 0 0 1 165 95"
            fill="none"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Progress Arc */}
          <path
            d="M 15 95 A 75 75 0 0 1 165 95"
            fill="none"
            stroke={gaugeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        <div className="absolute bottom-2 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-white font-mono tracking-tight">
            {onTimePercentage}%
          </span>
          <span className="text-[11px] font-semibold text-slate-400">On-Time Delivery</span>
        </div>
      </div>

      {/* Status Breakdown Badges with Progress */}
      <div className="space-y-2.5 pt-1 text-xs">
        {/* Delivered */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Delivered
            </span>
            <span className="font-mono font-bold text-white">
              {deliveredCount} ({Math.round((deliveredCount / total) * 100)}%)
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${(deliveredCount / total) * 100}%` }}
            />
          </div>
        </div>

        {/* In Transit */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
              In Transit
            </span>
            <span className="font-mono font-bold text-white">
              {inTransitCount} ({Math.round((inTransitCount / total) * 100)}%)
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-400 rounded-full transition-all duration-700"
              style={{ width: `${(inTransitCount / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Delayed */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Delayed
            </span>
            <span className="font-mono font-bold text-rose-400">
              {delayedCount} ({Math.round((delayedCount / total) * 100)}%)
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-rose-500 rounded-full transition-all duration-700"
              style={{ width: `${(delayedCount / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Cancelled */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              Cancelled
            </span>
            <span className="font-mono font-bold text-slate-400">
              {cancelledCount} ({Math.round((cancelledCount / total) * 100)}%)
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-600 rounded-full transition-all duration-700"
              style={{ width: `${(cancelledCount / total) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 6. Vendor Performance Comparison Grouped Multi-Bar Chart
// -------------------------------------------------------------
export interface VendorComparisonItem {
  vendorName: string;
  Delivery: number;
  Quality: number;
  Communication: number;
  Compliance: number;
}

interface VendorComparisonBarProps {
  data: VendorComparisonItem[];
  height?: number;
}

export const VendorPerformanceComparisonBarChart: React.FC<VendorComparisonBarProps> = ({
  data,
  height = 290,
}) => {
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} vertical={false} />
          <XAxis
            dataKey="vendorName"
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
          />
          <Tooltip content={<GlassTooltip formatter={(val: number) => `${val}/100`} />} />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
          />
          <Bar dataKey="Delivery" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={700} />
          <Bar dataKey="Quality" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={800} />
          <Bar dataKey="Communication" fill="#a855f7" radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={900} />
          <Bar dataKey="Compliance" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={1000} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// -------------------------------------------------------------
// 7. Reliability Score Trend Chart (Area with Vibrant Gradient)
// -------------------------------------------------------------
export interface ReliabilityTrendItem {
  period: string;
  score: number;
}

interface ReliabilityTrendProps {
  data: ReliabilityTrendItem[];
  height?: number;
  color?: string;
}

export const ReliabilityScoreTrendAreaChart: React.FC<ReliabilityTrendProps> = ({
  data,
  height = 260,
  color = '#10b981',
}) => {
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
          <defs>
            <linearGradient id="relTrendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.6} />
              <stop offset="100%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} vertical={false} />
          <XAxis
            dataKey="period"
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
          />
          <YAxis
            domain={[40, 100]}
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
          />
          <Tooltip content={<GlassTooltip formatter={(val: number) => `${val}/100 Score`} />} />
          <Area
            type="monotone"
            dataKey="score"
            name="Reliability Score"
            stroke={color}
            strokeWidth={3}
            fill="url(#relTrendGrad)"
            dot={{ r: 4, fill: color, stroke: '#0f172a', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: '#34d399', stroke: '#ffffff', strokeWidth: 2 }}
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// -------------------------------------------------------------
// 8. Contract Status Donut Chart
// -------------------------------------------------------------
export interface ContractStatusItem {
  status: string;
  count: number;
  color: string;
}

interface ContractStatusDonutProps {
  data: ContractStatusItem[];
  totalContracts: number;
  height?: number;
}

export const ContractStatusDonutChart: React.FC<ContractStatusDonutProps> = ({
  data,
  totalContracts,
  height = 250,
}) => {
  const [hovered, setHovered] = useState<ContractStatusItem | null>(null);

  return (
    <div className="relative w-full flex flex-col items-center justify-center">
      <div className="w-full relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={
                <GlassTooltip
                  formatter={(val: number) => {
                    const pct = totalContracts > 0 ? ((val / totalContracts) * 100).toFixed(1) : '0';
                    return `${val} Contracts (${pct}%)`;
                  }}
                />
              }
            />
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={92}
              paddingAngle={4}
              cornerRadius={6}
              onMouseEnter={(entry) => setHovered(entry)}
              onMouseLeave={() => setHovered(null)}
              cursor="pointer"
              animationDuration={800}
            >
              {data.map((entry, index) => (
                <Cell key={`contract-cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {hovered ? hovered.status : 'Total Contracts'}
          </span>
          <span className="text-2xl font-black text-white font-mono tracking-tight">
            {hovered ? hovered.count : totalContracts}
          </span>
          <span className="text-[10px] text-slate-400">
            {hovered
              ? `${totalContracts > 0 ? ((hovered.count / totalContracts) * 100).toFixed(0) : 0}% Share`
              : 'Enterprise Agreements'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 mt-2 w-full text-xs">
        {data.map((item) => (
          <div
            key={item.status}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800"
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-slate-300 font-medium">{item.status}:</span>
            <span className="font-mono text-white font-bold">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 9. Order History Combo Chart (Bar: Value, Line: Orders)
// -------------------------------------------------------------
export interface OrderHistoryItem {
  period: string;
  orderValue: number;
  orderCount: number;
}

interface OrderHistoryChartProps {
  data: OrderHistoryItem[];
  height?: number;
}

export const OrderHistoryComboChart: React.FC<OrderHistoryChartProps> = ({
  data,
  height = 280,
}) => {
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="orderValGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} vertical={false} />
          <XAxis
            dataKey="period"
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
          />
          <YAxis
            yAxisId="left"
            stroke="#10b981"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
            tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#38bdf8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `${val} POs`}
          />
          <Tooltip
            content={
              <GlassTooltip
                formatter={(val: number, name: string) =>
                  name === 'Order Value' ? formatRupees(val) : `${val} Orders`
                }
              />
            }
          />
          <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }} />
          <Bar
            yAxisId="left"
            dataKey="orderValue"
            name="Order Value"
            fill="url(#orderValGrad)"
            radius={[6, 6, 0, 0]}
            maxBarSize={38}
            animationDuration={800}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="orderCount"
            name="Number of Orders"
            stroke="#38bdf8"
            strokeWidth={3}
            dot={{ r: 4, fill: '#38bdf8', stroke: '#0f172a', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: '#7dd3fc', stroke: '#ffffff', strokeWidth: 2 }}
            animationDuration={1000}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// -------------------------------------------------------------
// 10. Communication Activity Donut Chart
// -------------------------------------------------------------
export interface CommunicationChannelItem {
  channel: string; // Emails, Calls, Meetings, Portal Messages, Support Tickets
  count: number;
  color: string;
}

interface CommDonutProps {
  data: CommunicationChannelItem[];
  totalActivities: number;
  height?: number;
}

export const CommunicationActivityDonutChart: React.FC<CommDonutProps> = ({
  data,
  totalActivities,
  height = 250,
}) => {
  const [hovered, setHovered] = useState<CommunicationChannelItem | null>(null);

  return (
    <div className="relative w-full flex flex-col items-center justify-center">
      <div className="w-full relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={
                <GlassTooltip
                  formatter={(val: number) => {
                    const pct = totalActivities > 0 ? ((val / totalActivities) * 100).toFixed(1) : '0';
                    return `${val} Interactions (${pct}%)`;
                  }}
                />
              }
            />
            <Pie
              data={data}
              dataKey="count"
              nameKey="channel"
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={92}
              paddingAngle={4}
              cornerRadius={6}
              onMouseEnter={(entry) => setHovered(entry)}
              onMouseLeave={() => setHovered(null)}
              cursor="pointer"
              animationDuration={800}
            >
              {data.map((entry, index) => (
                <Cell key={`comm-cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {hovered ? hovered.channel : 'Total Touchpoints'}
          </span>
          <span className="text-2xl font-black text-white font-mono tracking-tight">
            {hovered ? hovered.count : totalActivities}
          </span>
          <span className="text-[10px] text-slate-400">
            {hovered
              ? `${totalActivities > 0 ? ((hovered.count / totalActivities) * 100).toFixed(0) : 0}% Share`
              : 'Logged Engagements'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 mt-2 w-full text-xs">
        {data.map((item) => (
          <div
            key={item.channel}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800"
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-slate-300 font-medium">{item.channel}:</span>
            <span className="font-mono text-white font-bold">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 11. User Management Role Donut Chart
// -------------------------------------------------------------
export interface RoleCountItem {
  role: string;
  count: number;
  color: string;
}

interface UserRoleDonutProps {
  data: RoleCountItem[];
  totalUsers: number;
  height?: number;
}

export const UserManagementRoleDonutChart: React.FC<UserRoleDonutProps> = ({
  data,
  totalUsers,
  height = 260,
}) => {
  const [hovered, setHovered] = useState<RoleCountItem | null>(null);

  return (
    <div className="relative w-full flex flex-col items-center justify-center">
      <div className="w-full relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={
                <GlassTooltip
                  formatter={(val: number) => {
                    const pct = totalUsers > 0 ? ((val / totalUsers) * 100).toFixed(1) : '0';
                    return `${val} Accounts (${pct}%)`;
                  }}
                />
              }
            />
            <Pie
              data={data}
              dataKey="count"
              nameKey="role"
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={96}
              paddingAngle={4}
              cornerRadius={6}
              onMouseEnter={(entry) => setHovered(entry)}
              onMouseLeave={() => setHovered(null)}
              cursor="pointer"
              animationDuration={800}
            >
              {data.map((entry, index) => (
                <Cell key={`role-cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {hovered ? hovered.role : 'Total Users'}
          </span>
          <span className="text-2xl font-black text-white font-mono tracking-tight">
            {hovered ? hovered.count : totalUsers}
          </span>
          <span className="text-[10px] text-slate-400">
            {hovered
              ? `${totalUsers > 0 ? ((hovered.count / totalUsers) * 100).toFixed(0) : 0}% of Platform`
              : 'RBAC Directory'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 w-full text-xs">
        {data.map((item) => (
          <div
            key={item.role}
            className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950/60 border border-slate-800"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-slate-300 font-medium truncate">{item.role}</span>
            </div>
            <span className="font-mono text-white font-bold ml-1">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 12. Vendor Risk Distribution Bar Chart
// -------------------------------------------------------------
export interface RiskDistributionItem {
  riskLevel: 'Low Risk' | 'Medium Risk' | 'High Risk' | 'Critical Risk';
  count: number;
  color: string;
}

interface RiskBarProps {
  data: RiskDistributionItem[];
  height?: number;
}

export const VendorRiskBarChart: React.FC<RiskBarProps> = ({
  data,
  height = 260,
}) => {
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 15, right: 15, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} vertical={false} />
          <XAxis
            dataKey="riskLevel"
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
            allowDecimals={false}
          />
          <Tooltip content={<GlassTooltip formatter={(val: number) => `${val} Vendors`} />} />
          <Bar dataKey="count" name="Vendors" radius={[6, 6, 0, 0]} maxBarSize={48} animationDuration={800}>
            {data.map((entry, index) => (
              <Cell key={`risk-cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// -------------------------------------------------------------
// 13. Procurement Reports Combo Chart (Spend vs Volume)
// -------------------------------------------------------------
export interface ProcurementReportItem {
  period: string;
  spend: number;
  orderVolume: number;
}

interface ProcurementReportsComboProps {
  data: ProcurementReportItem[];
  height?: number;
}

export const ProcurementReportsComboChart: React.FC<ProcurementReportsComboProps> = ({
  data,
  height = 290,
}) => {
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="adminSpendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} vertical={false} />
          <XAxis
            dataKey="period"
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
          />
          <YAxis
            yAxisId="left"
            stroke="#a855f7"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
            tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#38bdf8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `${val} POs`}
          />
          <Tooltip
            content={
              <GlassTooltip
                formatter={(val: number, name: string) =>
                  name === 'Procurement Spend' ? formatRupees(val) : `${val} Orders`
                }
              />
            }
          />
          <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }} />
          <Bar
            yAxisId="left"
            dataKey="spend"
            name="Procurement Spend"
            fill="url(#adminSpendGrad)"
            radius={[6, 6, 0, 0]}
            maxBarSize={42}
            animationDuration={800}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="orderVolume"
            name="Order Volume"
            stroke="#38bdf8"
            strokeWidth={3}
            dot={{ r: 4, fill: '#38bdf8', stroke: '#0f172a', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: '#7dd3fc', stroke: '#ffffff', strokeWidth: 2 }}
            animationDuration={1000}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// -------------------------------------------------------------
// 14. Compliance Monitoring Donut Chart
// -------------------------------------------------------------
export interface ComplianceStatusItem {
  status: string; // Compliant, Minor Issues, Major Issues, Non-Compliant
  count: number;
  color: string;
}

interface ComplianceMonitoringDonutProps {
  data: ComplianceStatusItem[];
  totalAudited: number;
  overallComplianceRate: number;
  height?: number;
}

export const ComplianceMonitoringDonutChart: React.FC<ComplianceMonitoringDonutProps> = ({
  data,
  totalAudited,
  overallComplianceRate,
  height = 260,
}) => {
  const [hovered, setHovered] = useState<ComplianceStatusItem | null>(null);

  return (
    <div className="relative w-full flex flex-col items-center justify-center">
      <div className="w-full relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={
                <GlassTooltip
                  formatter={(val: number) => {
                    const pct = totalAudited > 0 ? ((val / totalAudited) * 100).toFixed(1) : '0';
                    return `${val} Records (${pct}%)`;
                  }}
                />
              }
            />
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={96}
              paddingAngle={4}
              cornerRadius={6}
              onMouseEnter={(entry) => setHovered(entry)}
              onMouseLeave={() => setHovered(null)}
              cursor="pointer"
              animationDuration={800}
            >
              {data.map((entry, index) => (
                <Cell key={`comp-cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {hovered ? hovered.status : 'Audit Compliance'}
          </span>
          <span className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
            {hovered ? hovered.count : `${overallComplianceRate}%`}
          </span>
          <span className="text-[10px] text-slate-400">
            {hovered
              ? `${totalAudited > 0 ? ((hovered.count / totalAudited) * 100).toFixed(0) : 0}% of Audits`
              : 'ISO / ESG Health'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2 w-full text-xs">
        {data.map((item) => (
          <div
            key={item.status}
            className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950/60 border border-slate-800"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-slate-300 font-medium truncate">{item.status}</span>
            </div>
            <span className="font-mono text-white font-bold ml-1">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 15. System Statistics Section (Progress bars & Live telemetry)
// -------------------------------------------------------------
interface SystemStatsProps {
  dbUsagePct: number; // e.g. 42
  apiLatencyMs: number; // e.g. 84
  activeSessions: number; // e.g. 28
  storageUsagePct: number; // e.g. 68
}

export const SystemStatisticsCard: React.FC<SystemStatsProps> = ({
  dbUsagePct = 42,
  apiLatencyMs = 84,
  activeSessions = 28,
  storageUsagePct = 68,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Database Usage */}
      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">Database Allocated</span>
          <span className="font-mono font-bold text-sky-400">{dbUsagePct}%</span>
        </div>
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full transition-all duration-700"
            style={{ width: `${dbUsagePct}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-500 font-mono">21.0 GB of 50.0 GB Postgres cluster</p>
      </div>

      {/* API Response Time */}
      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">API Response Time</span>
          <span className="font-mono font-bold text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {apiLatencyMs} ms
          </span>
        </div>
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, (apiLatencyMs / 200) * 100)}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-500 font-mono">Global edge p99: 112ms • SLA nominal</p>
      </div>

      {/* Active Session Count */}
      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">Active Concurrent Sessions</span>
          <span className="font-mono font-bold text-purple-400">{activeSessions} Online</span>
        </div>
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, (activeSessions / 50) * 100)}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-500 font-mono">Across 6 enterprise operational roles</p>
      </div>

      {/* Storage Usage */}
      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">Cloud Document Storage</span>
          <span className="font-mono font-bold text-amber-400">{storageUsagePct}%</span>
        </div>
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-700"
            style={{ width: `${storageUsagePct}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-500 font-mono">68.4 GB of 100.0 GB encrypted blob vault</p>
      </div>
    </div>
  );
};
