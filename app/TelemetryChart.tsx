"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type RawPoint = {
  ts: number;
  temperature?: number;
  humidity?: number;
};

type ChartPoint = {
  time: string;
  temperature?: number;
  humidity?: number;
};

export function TelemetryChart() {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/tb/history", { cache: "no-store" });
      if (!res.ok) {
        console.error("Failed to fetch history");
        return;
      }
      const json = (await res.json()) as RawPoint[];

      const formatted: ChartPoint[] = json.map((p) => ({
        time: new Date(p.ts).toLocaleTimeString("id-ID", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        temperature: p.temperature,
        humidity: p.humidity,
      }));

      setData(formatted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(); // load pertama kali
    const id = setInterval(load, 5000); // refresh tiap 5 detik
    return () => clearInterval(id);
  }, []);

  if (loading && data.length === 0) {
    return <p className="text-xs text-slate-500">Memuat data grafik...</p>;
  }

  if (!loading && data.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Belum ada data historis untuk ditampilkan.
      </p>
    );
  }

  return (
    <div className="w-full h-64 sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 24, left: 0, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />

          <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={16} />

          {/* Y kiri suhu (FIXED 0–100°C) */}
          <YAxis
            yAxisId="temp"
            tick={{ fontSize: 10 }}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}°C`}
          />

          {/* Y kanan RH (FIXED 0–100%) */}
          <YAxis
            yAxisId="hum"
            orientation="right"
            tick={{ fontSize: 10 }}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: "#111827",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "white",
              fontSize: "12px",
            }}
          />
          <Legend />

          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="temperature"
            name="Temperature (°C)"
            stroke="#60A5FA"
            strokeWidth={2.2}
            dot={false}
            isAnimationActive
            animationDuration={600}
            connectNulls
          />

          <Line
            yAxisId="hum"
            type="monotone"
            dataKey="humidity"
            name="Humidity (%)"
            stroke="#34D399"
            strokeDasharray="5 5"
            strokeWidth={2.2}
            dot={false}
            isAnimationActive
            animationDuration={600}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
