"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TelemetryChart } from "./TelemetryChart";
import { Environment3D } from "./Environment3D";
import { TrendInsights } from "./TrendInsights";
import { AlertsRules } from "./AlertsRules";

type Status = "ONLINE" | "OFFLINE" | "UNKNOWN";

/** helper buat detect section aktif */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  const observers = useRef<IntersectionObserver[]>([]);

  useEffect(() => {
    observers.current.forEach((o) => o.disconnect());
    observers.current = [];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(id);
        },
        { threshold: 0.6 }
      );

      obs.observe(el);
      observers.current.push(obs);
    });

    return () => observers.current.forEach((o) => o.disconnect());
  }, [ids]);

  return active;
}

export default function Home() {
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("UNKNOWN");
  const [lastUpdateTs, setLastUpdateTs] = useState<number | null>(null);

  // scrollY progress 0..1
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const p = h > 0 ? window.scrollY / h : 0;
      setScrollY(p);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // fetch latest TB data
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/tb/latest");
        if (!res.ok) {
          setStatus("OFFLINE");
          return;
        }

        const json: {
          temperature: number | null;
          humidity: number | null;
          ts: number | null;
        } = await res.json();

        setTemperature(json.temperature);
        setHumidity(json.humidity);
        setLastUpdateTs(json.ts);

        if (!json.ts) {
          setStatus("OFFLINE");
        } else {
          const ageMs = Date.now() - json.ts;
          const THRESHOLD_MS = 2 * 60 * 1000;
          setStatus(ageMs > THRESHOLD_MS ? "OFFLINE" : "ONLINE");
        }
      } catch (err) {
        console.error(err);
        setStatus("OFFLINE");
      }
    }

    fetchData();
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, []);

  const lastUpdateText =
    lastUpdateTs != null
      ? new Date(lastUpdateTs).toLocaleTimeString("id-ID", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : null;

  // nav active section
  const sectionIds = useMemo(
    () => ["hero", "live", "alerts", "history", "environment"],
    []
  );
  const active = useActiveSection(sectionIds);

  const isIdeal =
    temperature != null &&
    humidity != null &&
    temperature >= 22 &&
    temperature <= 28 &&
    humidity >= 70 &&
    humidity <= 90;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Floating nav */}
      <div className="fixed z-50 right-4 top-1/2 -translate-y-1/2 hidden md:flex flex-col gap-2">
        {sectionIds.map((id, idx) => (
          <a
            key={id}
            href={`#${id}`}
            className={`h-9 w-9 rounded-full grid place-items-center border text-xs transition
              ${
                active === id
                  ? "bg-white text-slate-950 border-white neon-outline-cyan"
                  : "glass text-slate-200 border-slate-700 hover:bg-slate-800"
              }`}
            aria-label={`Go to section ${id}`}
          >
            {idx + 1}
          </a>
        ))}
      </div>

      {/* Scroll container */}
      <div className="snap-y snap-mandatory h-screen overflow-y-scroll scroll-smooth">
        {/* =========== HERO SECTION =========== */}
        <section id="hero" className="snap-start min-h-screen flex items-center">
          <div className="max-w-6xl mx-auto px-4 py-10 grid gap-8 lg:grid-cols-2 items-center">
            <div className="space-y-4">
              <p className="hud-title">smart farming / kumbung jamur</p>

              <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
                IoT Environment{" "}
                <span className="text-emerald-400">Monitor</span>
              </h1>

              <p className="text-slate-300 max-w-xl">
                Website interaktif berbasis scroll untuk melihat kondisi kumbung
                secara live, historis, dan visual.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                {/* Temperature card */}
                <div className="rounded-2xl border border-slate-800 glass px-4 py-3">
                  <p className="text-xs text-slate-400">Temperature</p>
                  <p className="text-2xl font-semibold">
                    {temperature != null ? `${temperature.toFixed(1)}°C` : "—"}
                  </p>
                </div>

                {/* Humidity card */}
                <div className="rounded-2xl border border-slate-800 glass px-4 py-3">
                  <p className="text-xs text-slate-400">Humidity</p>
                  <p className="text-2xl font-semibold">
                    {humidity != null ? `${humidity.toFixed(1)}%` : "—"}
                  </p>
                </div>

                {/* Gateway card */}
                <div
                  className={`rounded-2xl border px-4 py-3 glass ${
                    status === "ONLINE"
                      ? "neon-outline-emerald text-emerald-200"
                      : status === "OFFLINE"
                      ? "neon-outline-red text-red-200"
                      : "neon-outline-cyan text-slate-200"
                  }`}
                >
                  <p className="text-xs opacity-80">Gateway</p>
                  <p className="text-2xl font-semibold">
                    {status === "UNKNOWN" ? "—" : status}
                  </p>
                  {lastUpdateText && (
                    <p className="text-[11px] opacity-70 mt-1">
                      Update terakhir: {lastUpdateText} WIB
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-4 flex gap-2 flex-wrap">
                <a
                  href="#live"
                  className="rounded-full bg-white text-slate-950 px-4 py-2 text-sm font-medium hover:bg-slate-200 transition"
                >
                  Lihat Live Data
                </a>
                <a
                  href="#alerts"
                  className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:bg-slate-900 transition glass"
                >
                  Alerts
                </a>
                <a
                  href="#history"
                  className="rounded-full border border-slate-700 px-4 py-2 text-sm hover:bg-slate-900 transition glass"
                >
                  Trend 24 Jam
                </a>
              </div>
            </div>

            {/* 3D hanya di HERO */}
            <div
              className="transition-transform duration-300"
              style={{ transform: `translateY(${scrollY * -20}px)` }}
            >
              <Environment3D
                temperature={temperature}
                humidity={humidity}
                focus={0.15}
              />
            </div>
          </div>
        </section>

        {/* =========== LIVE SECTION =========== */}
        <section id="live" className="snap-start min-h-screen flex items-center">
          <div className="max-w-6xl mx-auto px-4 py-10 w-full">
            <div className="grid gap-6 lg:grid-cols-3 items-start">
              <div className="lg:col-span-1 space-y-3">
                <h2 className="text-3xl font-bold">Live Telemetry</h2>
                <p className="text-sm text-slate-400">
                  Data realtime dari ESP32 via ThingsBoard.
                </p>

                <div className="mt-4 space-y-2">
                  <div className="rounded-2xl border border-slate-800 glass p-4">
                    <p className="text-xs text-slate-400">Suhu sekarang</p>
                    <p className="text-3xl font-semibold">
                      {temperature != null ? `${temperature.toFixed(1)}°C` : "—"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-800 glass p-4">
                    <p className="text-xs text-slate-400">Kelembapan sekarang</p>
                    <p className="text-3xl font-semibold">
                      {humidity != null ? `${humidity.toFixed(1)}%` : "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 rounded-2xl border border-slate-800 glass p-4 sm:p-6">
                <p className="text-sm font-medium text-slate-200 mb-1">
                  Riwayat pendek (update realtime)
                </p>
                <TelemetryChart />
              </div>
            </div>
          </div>
        </section>

        {/* =========== ALERTS SECTION =========== */}
        <section id="alerts" className="snap-start min-h-screen flex items-center">
          <div className="max-w-6xl mx-auto px-4 py-10 w-full space-y-3">
            <h2 className="text-3xl font-bold">Alerts & Rules</h2>
            <p className="text-sm text-slate-400">
              Deteksi otomatis saat chamber keluar dari range ideal.
            </p>

            <AlertsRules
              temperature={temperature}
              humidity={humidity}
              status={status}
              ts={lastUpdateTs}
            />
          </div>
        </section>

        {/* =========== HISTORY SECTION =========== */}
        <section id="history" className="snap-start min-h-screen flex items-center">
          <div className="max-w-6xl mx-auto px-4 py-10 w-full space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold">Trend 24 Jam</h2>
              <p className="text-sm text-slate-400">
                Analisa siklus harian kumbung dari data 24 jam terakhir.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 glass p-4 sm:p-6">
              <TelemetryChart />
            </div>

            <TrendInsights />
          </div>
        </section>

        {/* =========== ENVIRONMENT / HUD SECTION (tanpa 3D) =========== */}
        <section
          id="environment"
          className="snap-start min-h-screen flex items-center"
        >
          <div className="max-w-6xl mx-auto px-4 py-10 w-full grid gap-8 lg:grid-cols-2 items-center">
            {/* HUD kiri */}
            <div className="space-y-4">
              <p className="hud-title">Conditioning</p>

              <h2 className="text-3xl font-bold">Maintain Ideal Condition</h2>

              <p className="text-sm text-slate-300 max-w-md">
                Jaga suhu di <b>22–28°C</b> dan kelembapan di{" "}
                <b>70–90% </b>. Sistem menyalakan fan/mist otomatis jika keluar batas.
              </p>

              {!isIdeal && (
                <div className="rounded-xl border border-red-500/40 glass neon-outline-red px-4 py-3 text-sm text-red-200">
                  ⚠️ Warning: kondisi di luar rentang ideal.
                  <div className="text-xs text-red-300/80 mt-1">
                    Cek alerts, lalu inspect sensor A/B/C di panel 3D.
                  </div>
                </div>
              )}

              {/* Temperature gauge */}
              <div className="rounded-2xl border border-slate-800 glass p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">Temperature Gauge</p>
                  <p className="text-xs text-slate-200 font-medium">
                    {temperature != null ? temperature.toFixed(1) : "—"}°C
                  </p>
                </div>

                <div className="mt-2 h-2 w-full bg-slate-800 rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-sky-400 transition-all"
                    style={{
                      width: `${
                        temperature != null
                          ? Math.min(
                              100,
                              Math.max(0, ((temperature - 15) / 20) * 100)
                            )
                          : 0
                      }%`,
                    }}
                  />
                  <div className="absolute inset-0 flex">
                    <div className="w-[35%]" />
                    <div className="w-[30%] bg-emerald-400/20" />
                    <div className="w-[35%]" />
                  </div>
                </div>

                <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                  <span>15°C</span>
                  <span className="text-emerald-300">Ideal 22–28</span>
                  <span>35°C</span>
                </div>
              </div>

              {/* Humidity gauge */}
              <div className="rounded-2xl border border-slate-800 glass p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">Humidity Gauge</p>
                  <p className="text-xs text-slate-200 font-medium">
                    {humidity != null ? humidity.toFixed(1) : "—"}%
                  </p>
                </div>

                <div className="mt-2 h-2 w-full bg-slate-800 rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-emerald-400 transition-all"
                    style={{
                      width: `${
                        humidity != null ? Math.min(100, Math.max(0, humidity)) : 0
                      }%`,
                    }}
                  />
                  <div className="absolute inset-0 flex">
                    <div className="w-[70%]" />
                    <div className="w-[20%] bg-emerald-400/20" />
                    <div className="w-[10%]" />
                  </div>
                </div>

                <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                  <span>0%</span>
                  <span className="text-emerald-300">Ideal 70–90</span>
                  <span>100%</span>
                </div>
              </div>

              {/* status mini */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-800 glass p-3 text-center text-xs">
                  <div className="text-slate-400">Fan</div>
                  <div className="mt-1 font-semibold">
                    {(temperature ?? 0) > 28 ? "ACTIVE" : "IDLE"}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 glass p-3 text-center text-xs">
                  <div className="text-slate-400">Mist</div>
                  <div className="mt-1 font-semibold">
                    {(humidity ?? 0) < 70 ? "ACTIVE" : "IDLE"}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 glass p-3 text-center text-xs">
                  <div className="text-slate-400">Status</div>
                  <div className="mt-1 font-semibold">
                    {isIdeal ? "IDEAL" : "WARNING"}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 glass p-3 text-xs text-slate-300">
                🎮 Inspect sensor A/B/C dari 3D panel di halaman pertama.
              </div>
            </div>

            {/* kanan: info ringkas aja */}
            <div className="rounded-2xl border border-slate-800 glass p-6 space-y-3">
              <div className="text-sm text-slate-400">Quick Summary</div>
              <div className="text-2xl font-semibold">
                {isIdeal ? "Condition Stable" : "Needs Attention"}
              </div>
              <div className="text-sm text-slate-300">
                Pantau Alerts untuk tahu rule mana yang aktif.
              </div>
            </div>
          </div>
        </section>

        <div className="snap-start h-24" />
      </div>
    </main>
  );
}
