"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
export function LatencyChart({
  points,
}: {
  points: { time: string; latency: number | null }[];
}) {
  if (!points.length)
    return (
      <div className="chart-empty">
        Response history will appear after the first successful checks.
      </div>
    );
  return (
    <div
      className="chart"
      role="img"
      aria-label={`Feed response time chart with ${points.length} observations`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: 12, right: 10, left: -25, bottom: 0 }}
        >
          <defs>
            <linearGradient id="latency-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#64dba7" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#64dba7" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#ffffff0a" vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={(v) =>
              new Date(v).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            }
            minTickGap={65}
            tick={{ fill: "#747c87", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `${v}`}
            tick={{ fill: "#747c87", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#171c22",
              border: "1px solid #30363e",
              borderRadius: 8,
              color: "#e8ecf0",
              fontSize: 12,
            }}
            labelFormatter={(v) => new Date(String(v)).toLocaleString()}
            formatter={(v) => [`${v} ms`, "Feed response"]}
          />
          <Area
            type="monotone"
            dataKey="latency"
            stroke="#64dba7"
            strokeWidth={2}
            fill="url(#latency-fill)"
            connectNulls={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
