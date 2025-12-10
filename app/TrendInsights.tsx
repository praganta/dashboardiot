"use client";

import { useEffect, useMemo, useState } from "react";

type RawPoint = {
  ts: number;
  temperature?: number;
  humidity?: number;
};

type Stats = {
  minT: number | null;
  maxT: number | null;
  avgT: number | null;
  minH: number | null;
  maxH: number | null;
  avgH: number | null;
  idealPct: number | null;
  trendT: "naik" | "turun" | "stabil" | null;
  trendH: "naik" | "turun" | "stabil" | null;
  latestTs: number | null;
};

function mean(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function TrendInsights() {
  const [points, setPoints] = useState<RawPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/tb/history");
        if (!res.ok) return;
        const json = (await res.json()) as RawPoint[];
        setPoints(json);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 15000); // refresh insight tiap 15 detik
    return () => clearInterval(id);
  }, []);

  const stats: Stats = useMemo(() => {
    if (!points.length) {
      return {
        minT: null, maxT: null, avgT: null,
        minH: null, maxH: null, avgH: null,
        idealPct: null, trendT: null, trendH: null,
        latestTs: null,
      };
    }

    const temps = points.map(p => p.temperature).filter((v): v is number => v != null);
    const hums  = points.map(p => p.humidity).filter((v): v is number => v != null);

    const minT = temps.length ? Math.min(...temps) : null;
    const maxT = temps.length ? Math.max(...temps) : null;
    const avgT = temps.length ? mean(temps) : null;

    const minH = hums.length ? Math.min(...hums) : null;
    const maxH = hums.length ? Math.max(...hums) : null;
    const avgH = hums.length ? mean(hums) : null;

    // ==== persentase kondisi ideal (22–28°C & 70–90% RH)
    let idealCount = 0;
    let validCount = 0;
    for (const p of points) {
      if (p.temperature == null || p.humidity == null) continue;
      validCount++;
      const isIdeal =
        p.temperature >= 22 && p.temperature <= 28 &&
        p.humidity >= 70 && p.humidity <= 90;
      if (isIdeal) idealCount++;
    }
    const idealPct = validCount ? (idealCount / validCount) * 100 : null;

    // ==== trend sederhana: rata2 10% terakhir vs 10% sebelumnya
    const n = points.length;
    const window = Math.max(4, Math.floor(n * 0.1));
    const last = points.slice(n - window);
    const prev = points.slice(n - window * 2, n - window);

    const lastT = last.map(p => p.temperature).filter((v): v is number => v != null);
    const prevT = prev.map(p => p.temperature).filter((v): v is number => v != null);
    const lastH = last.map(p => p.humidity).filter((v): v is number => v != null);
    const prevH = prev.map(p => p.humidity).filter((v): v is number => v != null);

    function trend(a: number[], b: number[]) {
      if (!a.length || !b.length) return null;
      const d = mean(a) - mean(b);
      if (Math.abs(d) < 0.2) return "stabil";
      return d > 0 ? "naik" : "turun";
    }

    const trendT = trend(lastT, prevT);
    const trendH = trend(lastH, prevH);

    return {
      minT, maxT, avgT,
      minH, maxH, avgH,
      idealPct,
      trendT, trendH,
      latestTs: points[points.length - 1]?.ts ?? null,
    };
  }, [points]);

  if (loading && !points.length) {
    return <p className="text-xs text-slate-500">Menghitung insight...</p>;
  }

  const tempBar = stats.avgT != null
    ? clamp(((stats.avgT - 15) / 20) * 100, 0, 100)
    : 0;

  const humBar = stats.avgH != null
    ? clamp(stats.avgH, 0, 100)
    : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {/* Card 1: Suhu */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="text-xs text-slate-400 mb-2">Statistik Suhu (24 jam)</p>

        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-sky-400 transition-all"
            style={{ width: `${tempBar}%` }}
          />
        </div>

        <p className="text-sm leading-relaxed">
          Min: <b>{stats.minT?.toFixed(1) ?? "—"}°C</b><br/>
          Max: <b>{stats.maxT?.toFixed(1) ?? "—"}°C</b><br/>
          Rata²: <b>{stats.avgT?.toFixed(1) ?? "—"}°C</b>
        </p>

        {stats.trendT && (
          <p className="mt-2 text-xs text-slate-500">
            Tren terakhir: <b>{stats.trendT}</b>
          </p>
        )}
      </div>

      {/* Card 2: RH */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="text-xs text-slate-400 mb-2">Statistik RH (24 jam)</p>

        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-emerald-400 transition-all"
            style={{ width: `${humBar}%` }}
          />
        </div>

        <p className="text-sm leading-relaxed">
          Min: <b>{stats.minH?.toFixed(1) ?? "—"}%</b><br/>
          Max: <b>{stats.maxH?.toFixed(1) ?? "—"}%</b><br/>
          Rata²: <b>{stats.avgH?.toFixed(1) ?? "—"}%</b>
        </p>

        {stats.trendH && (
          <p className="mt-2 text-xs text-slate-500">
            Tren terakhir: <b>{stats.trendH}</b>
          </p>
        )}
      </div>

      {/* Card 3: Ideal time */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <p className="text-xs text-slate-400 mb-2">Kualitas Kondisi</p>

        <div className="text-sm">
          Waktu kondisi ideal:{" "}
          <b>
            {stats.idealPct != null ? `${stats.idealPct.toFixed(0)}%` : "—"}
          </b>
        </div>

        <p className="mt-2 text-xs text-slate-500 leading-relaxed">
          Ideal = Suhu 22–28°C & RH 70–90%.{" "}
          {stats.latestTs && (
            <>
              Update terakhir:{" "}
              {new Date(stats.latestTs).toLocaleTimeString("id-ID", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
              })} WIB
            </>
          )}
        </p>
      </div>
    </div>
  );
}
