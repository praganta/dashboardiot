"use client";

import { useEffect, useMemo, useState } from "react";

type RawPoint = {
  ts: number;
  temperature: number | null;
  humidity: number | null;
};

type TrendLabel = "naik" | "turun" | "stabil";

type Stats = {
  minT: number | null;
  maxT: number | null;
  avgT: number | null;
  minH: number | null;
  maxH: number | null;
  avgH: number | null;
  idealPct: number | null;
  trendT: TrendLabel | null;
  trendH: TrendLabel | null;
  latestTs: number | null;
};

const TEMP_RANGE: [number, number] = [0, 100];
const HUM_RANGE: [number, number] = [0, 100];

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function mean(arr: number[]) {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function clampOrNull(v: unknown, [min, max]: [number, number]) {
  if (typeof v !== "number" || !isFinite(v)) return null;
  if (v < min || v > max) return null;
  return v;
}

export function TrendInsights() {
  const [points, setPoints] = useState<RawPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/tb/history", { cache: "no-store" });
        if (!res.ok) return;

        const json = (await res.json()) as any[];

        const sane: RawPoint[] = json.map((p) => ({
          ts: p.ts,
          temperature: clampOrNull(p.temperature, TEMP_RANGE),
          humidity: clampOrNull(p.humidity, HUM_RANGE),
        }));

        setPoints(sane);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const stats: Stats = useMemo(() => {
    if (points.length === 0) {
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
    const avgT = mean(temps);

    const minH = hums.length ? Math.min(...hums) : null;
    const maxH = hums.length ? Math.max(...hums) : null;
    const avgH = mean(hums);

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

    const n = points.length;
    const window = Math.max(6, Math.floor(n * 0.15));
    const last = points.slice(n - window);
    const prev = points.slice(Math.max(0, n - window * 2), n - window);

    const lastT = last.map(p => p.temperature).filter((v): v is number => v != null);
    const prevT = prev.map(p => p.temperature).filter((v): v is number => v != null);
    const lastH = last.map(p => p.humidity).filter((v): v is number => v != null);
    const prevH = prev.map(p => p.humidity).filter((v): v is number => v != null);

    function trend(a: number[], b: number[]) {
      const ma = mean(a);
      const mb = mean(b);
      if (ma == null || mb == null) return null;
      const d = ma - mb;
      if (Math.abs(d) < 0.25) return "stabil";
      return d > 0 ? "naik" : "turun";
    }

    return {
      minT, maxT, avgT,
      minH, maxH, avgH,
      idealPct,
      trendT: trend(lastT, prevT),
      trendH: trend(lastH, prevH),
      latestTs: points[points.length - 1]?.ts ?? null,
    };
  }, [points]);

  if (loading && points.length === 0) {
    return (
      <p className="text-xs text-slate-400 animate-pulse">
        Menghitung insight...
      </p>
    );
  }

  const tempBar =
    stats.avgT != null
      ? clamp(((stats.avgT - TEMP_RANGE[0]) / (TEMP_RANGE[1] - TEMP_RANGE[0])) * 100, 0, 100)
      : 0;

  const humBar =
    stats.avgH != null
      ? clamp(((stats.avgH - HUM_RANGE[0]) / (HUM_RANGE[1] - HUM_RANGE[0])) * 100, 0, 100)
      : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-800 glass p-4">
        <p className="text-xs text-slate-300 mb-2">Statistik Suhu (24 jam)</p>
        <div className="h-2 w-full bg-slate-800/70 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-sky-400 to-indigo-400 transition-all"
            style={{ width: `${tempBar}%` }}
          />
        </div>
        <p className="text-sm leading-relaxed">
          Min: <b>{stats.minT?.toFixed(1) ?? "—"}°C</b><br />
          Max: <b>{stats.maxT?.toFixed(1) ?? "—"}°C</b><br />
          Rata²: <b>{stats.avgT?.toFixed(1) ?? "—"}°C</b>
        </p>
        {stats.trendT && (
          <p className="mt-2 text-xs text-slate-400">
            Tren terakhir:{" "}
            <b className={
              stats.trendT === "naik" ? "text-rose-300"
              : stats.trendT === "turun" ? "text-cyan-300"
              : "text-emerald-300"
            }>
              {stats.trendT}
            </b>
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 glass p-4">
        <p className="text-xs text-slate-300 mb-2">Statistik RH (24 jam)</p>
        <div className="h-2 w-full bg-slate-800/70 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all"
            style={{ width: `${humBar}%` }}
          />
        </div>
        <p className="text-sm leading-relaxed">
          Min: <b>{stats.minH?.toFixed(1) ?? "—"}%</b><br />
          Max: <b>{stats.maxH?.toFixed(1) ?? "—"}%</b><br />
          Rata²: <b>{stats.avgH?.toFixed(1) ?? "—"}%</b>
        </p>
        {stats.trendH && (
          <p className="mt-2 text-xs text-slate-400">
            Tren terakhir:{" "}
            <b className={
              stats.trendH === "naik" ? "text-rose-300"
              : stats.trendH === "turun" ? "text-cyan-300"
              : "text-emerald-300"
            }>
              {stats.trendH}
            </b>
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 glass p-4">
        <p className="text-xs text-slate-300 mb-2">Kualitas Kondisi</p>
        <div className="text-sm">
          Waktu kondisi ideal:{" "}
          <b className="text-emerald-300">
            {stats.idealPct != null ? `${stats.idealPct.toFixed(0)}%` : "—"}
          </b>
        </div>
        <div className="mt-3 h-2 w-full bg-slate-800/70 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-fuchsia-400 to-violet-400 transition-all"
            style={{ width: `${stats.idealPct ?? 0}%` }}
          />
        </div>
        <p className="mt-3 text-xs text-slate-400 leading-relaxed">
          Ideal = Suhu 22–28°C & RH 70–90%.
          {stats.latestTs && (
            <>
              <br />
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
