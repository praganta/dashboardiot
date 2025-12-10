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
      const res = await fetch("/api/tb/history");
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
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
          <XAxis dataKey="time" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#111827", // bg-slate-900
              border: "1px solid #374151", // border-slate-700
              borderRadius: "8px",
              color: "white",
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="temperature"
            name="Temperature (°C)"
            stroke="#60A5FA" // biru
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="humidity"
            name="Humidity (%)"
            stroke="#34D399" // hijau
            strokeDasharray="5 5"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
