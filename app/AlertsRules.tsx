"use client";

import { useEffect, useMemo, useState } from "react";

type Status = "ONLINE" | "OFFLINE" | "UNKNOWN";
type Severity = "INFO" | "WARN" | "CRIT";

type Alert = {
  id: string;
  title: string;
  severity: Severity;
  valueText: string;
  ts: number; // timestamp yang stabil
  suggestion: string;
};

function severityColor(sev: Severity) {
  if (sev === "CRIT") return "text-red-200 border-red-500/40 neon-outline-red";
  if (sev === "WARN") return "text-amber-200 border-amber-500/40";
  return "text-slate-200 border-slate-500/40";
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
  // ✅ NOW dibuat state biar SSR & first client render sama (null)
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // jalan hanya di client
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000); // kalau mau age jalan realtime
    return () => clearInterval(id);
  }, []);

  const alerts = useMemo<Alert[]>(() => {
    // kalau now masih null (SSR + first paint), jangan bikin alert berbasis umur
    const out: Alert[] = [];
    const safeNow = now ?? ts ?? 0;
    const safeTs = ts ?? safeNow;

    // R5 Gateway offline / stale
    if (!ts || status === "OFFLINE") {
      out.push({
        id: "gateway-offline",
        title: "Gateway Offline / Data Stale",
        severity: "CRIT",
        valueText:
          ts && now
            ? `Age ${Math.floor((safeNow - ts) / 1000)}s`
            : "No timestamp",
        ts: safeTs,
        suggestion: "Check ESP32 power / WiFi / ThingsBoard token.",
      });
      return out;
    }

    // R1 Temp High
    if (temperature != null && temperature > 28) {
      out.push({
        id: "temp-high",
        title: "Temperature High",
        severity: temperature > 30 ? "CRIT" : "WARN",
        valueText: `${temperature.toFixed(1)}°C`,
        ts: safeTs,
        suggestion: "Fan ON / check ventilation.",
      });
    }

    // R2 Temp Low
    if (temperature != null && temperature < 22) {
      out.push({
        id: "temp-low",
        title: "Temperature Low",
        severity: temperature < 20 ? "CRIT" : "WARN",
        valueText: `${temperature.toFixed(1)}°C`,
        ts: safeTs,
        suggestion: "Reduce airflow / heater if available.",
      });
    }

    // R3 RH High
    if (humidity != null && humidity > 90) {
      out.push({
        id: "rh-high",
        title: "Humidity High",
        severity: humidity > 94 ? "CRIT" : "WARN",
        valueText: `${humidity.toFixed(1)}%`,
        ts: safeTs,
        suggestion: "Increase exhaust / fan ON.",
      });
    }

    // R4 RH Low
    if (humidity != null && humidity < 70) {
      out.push({
        id: "rh-low",
        title: "Humidity Low",
        severity: humidity < 65 ? "CRIT" : "WARN",
        valueText: `${humidity.toFixed(1)}%`,
        ts: safeTs,
        suggestion: "Mist ON / add water.",
      });
    }

    return out;
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
              Active alerts: {alerts.length}
            </div>

            {/* ✅ ts stabil, aman ditampilkan */}
            {updatedText && (
              <div className="text-xs text-slate-500">
                Updated: {updatedText} WIB
              </div>
            )}
          </div>

          <div className="text-xs text-slate-400 space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              CRIT = tindakan segera
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              WARN = waspada
            </div>
          </div>
        </div>

        {/* RIGHT FEED */}
        <div className="lg:col-span-2 space-y-2">
          {alerts.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/30 glass p-4 text-emerald-200">
              ✅ Tidak ada alert aktif. Kondisi ideal.
            </div>
          ) : (
            alerts.map((a) => (
              <div
                key={a.id}
                className={`rounded-xl border glass p-4 ${severityColor(
                  a.severity
                )}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">
                    {a.severity} — {a.title}
                  </div>

                  {/* ✅ pake ts stabil, dan now hanya buat age (bukan timestamp utama) */}
                  <div className="text-xs opacity-70">
                    {formatTime(a.ts)}
                  </div>
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
