"use client";

import { useEffect, useMemo, useState } from "react";

type Status = "ONLINE" | "OFFLINE" | "UNKNOWN";
type Severity = "INFO" | "WARN" | "CRIT";

type Alert = {
  id: string;
  title: string;
  severity: Severity;
  valueText: string;
  ts: number; // timestamp stabil (sensor)
  suggestion: string;
};

function severityBadge(sev: Severity) {
  if (sev === "CRIT")
    return "text-rose-200 border-rose-500/40 neon-outline-red bg-rose-500/10";
  if (sev === "WARN")
    return "text-amber-200 border-amber-400/40 bg-amber-400/10";
  return "text-cyan-200 border-cyan-400/30 bg-cyan-400/10";
}

function severityRank(sev: Severity) {
  return sev === "CRIT" ? 0 : sev === "WARN" ? 1 : 2;
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString("id-ID", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AlertsRules({
  temperature,
  humidity,
  status,
  ts,
}: {
  temperature: number | null;
  humidity: number | null;
  status: Status;
  ts: number | null;
}) {
  // SSR-safe: first render null, then client update
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const alerts = useMemo<Alert[]>(() => {
    const out: Alert[] = [];

    const safeNow = now ?? ts ?? 0;
    const safeTs = ts ?? safeNow;

    const ageSec =
      ts && now ? Math.max(0, Math.floor((safeNow - ts) / 1000)) : null;

    const stale =
      ts && now ? safeNow - ts > 2 * 60 * 1000 : false; // 2 menit

    // Gateway offline / stale
    if (!ts || status === "OFFLINE" || stale) {
      out.push({
        id: "gateway-offline",
        title: !ts
          ? "Gateway Tidak Mengirim Data"
          : status === "OFFLINE"
          ? "Gateway Offline"
          : "Data Terlalu Lama (Stale)",
        severity: "CRIT",
        valueText: ageSec != null ? `Age ${ageSec}s` : "No timestamp",
        ts: safeTs,
        suggestion:
          "Cek power ESP32, WiFi, dan token ThingsBoard. Restart jika perlu.",
      });
      return out; // kalau CRIT gateway, stop rule lain
    }

    // Temperature high
    if (temperature != null && temperature > 28) {
      out.push({
        id: "temp-high",
        title: "Suhu Terlalu Tinggi",
        severity: temperature > 30 ? "CRIT" : "WARN",
        valueText: `${temperature.toFixed(1)}°C`,
        ts: safeTs,
        suggestion: "Nyalakan fan / cek ventilasi kumbung.",
      });
    }

    // Temperature low
    if (temperature != null && temperature < 22) {
      out.push({
        id: "temp-low",
        title: "Suhu Terlalu Rendah",
        severity: temperature < 20 ? "CRIT" : "WARN",
        valueText: `${temperature.toFixed(1)}°C`,
        ts: safeTs,
        suggestion: "Kurangi airflow / gunakan pemanas bila ada.",
      });
    }

    // RH high
    if (humidity != null && humidity > 90) {
      out.push({
        id: "rh-high",
        title: "Kelembapan Terlalu Tinggi",
        severity: humidity > 94 ? "CRIT" : "WARN",
        valueText: `${humidity.toFixed(1)}%`,
        ts: safeTs,
        suggestion: "Tingkatkan exhaust / fan ON.",
      });
    }

    // RH low
    if (humidity != null && humidity < 70) {
      out.push({
        id: "rh-low",
        title: "Kelembapan Terlalu Rendah",
        severity: humidity < 65 ? "CRIT" : "WARN",
        valueText: `${humidity.toFixed(1)}%`,
        ts: safeTs,
        suggestion: "Mist ON / tambah air.",
      });
    }

    // sort by severity then newest
    return out.sort((a, b) => {
      const s = severityRank(a.severity) - severityRank(b.severity);
      if (s !== 0) return s;
      return b.ts - a.ts;
    });
  }, [temperature, humidity, status, ts, now]);

  const globalState =
    alerts.some((a) => a.severity === "CRIT")
      ? "CRITICAL"
      : alerts.length > 0
      ? "WARNING"
      : "IDEAL";

  const updatedText = ts ? formatTime(ts) : null;

  return (
    <section className="rounded-2xl border border-slate-800 glass p-5 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-3">
        {/* LEFT SUMMARY */}
        <div className="space-y-3">
          <p className="hud-title">alerts & rules</p>

          <div className="rounded-xl border border-slate-700 glass p-4">
            <div className="text-xs text-slate-400">System State</div>
            <div className="mt-1 text-2xl font-semibold">{globalState}</div>
            <div className="mt-2 text-xs text-slate-500">
              Alert aktif: {alerts.length}
            </div>

            {updatedText && (
              <div className="text-xs text-slate-500">
                Update terakhir: {updatedText} WIB
              </div>
            )}
          </div>

          <div className="text-xs text-slate-400 space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              CRIT = tindakan segera
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              WARN = perlu perhatian
            </div>
          </div>
        </div>

        {/* RIGHT FEED */}
        <div className="lg:col-span-2 space-y-2">
          {alerts.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/30 glass p-4 text-emerald-200">
              ✅ Kondisi stabil — tidak ada alert aktif.
              <div className="text-xs text-emerald-300/80 mt-1">
                Semua parameter berada di rentang ideal.
              </div>
            </div>
          ) : (
            alerts.map((a) => (
              <div
                key={a.id}
                className={`rounded-xl border glass p-4 ${severityBadge(
                  a.severity
                )}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">
                    {a.severity} — {a.title}
                  </div>
                  <div className="text-xs opacity-70">{formatTime(a.ts)}</div>
                </div>

                <div className="mt-1 text-sm">
                  Value: <b>{a.valueText}</b>
                </div>

                <div className="mt-2 text-xs text-slate-300">
                  Suggested: {a.suggestion}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
