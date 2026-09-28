import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendDataPoint {
  day: string;
  passed: number;
  failed: number;
  total?: number;
}

interface TrendChartProps {
  data?: TrendDataPoint[];
  height?: number;
}

const defaultTrendData: TrendDataPoint[] = [
  { day: 'Day 1-5', passed: 24, failed: 3 },
  { day: 'Day 6-10', passed: 32, failed: 2 },
  { day: 'Day 11-15', passed: 28, failed: 5 },
  { day: 'Day 16-20', passed: 35, failed: 1 },
  { day: 'Day 21-25', passed: 42, failed: 4 },
  { day: 'Day 26-30', passed: 48, failed: 2 }
];

export const TrendChart: React.FC<TrendChartProps> = ({
  data = defaultTrendData,
  height = 180
}) => {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradientPassed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradientFailed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="day" 
            stroke="#64748b" 
            fontSize={11} 
            tickLine={false}
            axisLine={false} 
          />
          <YAxis 
            stroke="#64748b" 
            fontSize={11} 
            tickLine={false}
            axisLine={false} 
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(51, 65, 85, 0.8)',
              borderRadius: '12px',
              fontSize: '11px',
              color: '#f8fafc',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
            }}
          />
          <Area
            type="monotone"
            dataKey="passed"
            name="Passed Runs"
            stroke="#10b981"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#gradientPassed)"
          />
          <Area
            type="monotone"
            dataKey="failed"
            name="Failed Runs"
            stroke="#f43f5e"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#gradientFailed)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
