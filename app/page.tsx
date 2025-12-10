"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TelemetryChart } from "./TelemetryChart";
import { Environment3D } from "./Environment3D";
import { TrendInsights } from "./TrendInsights";
import { AlertsRules } from "./AlertsRules";

type Status = "ONLINE" | "OFFLINE" | "UNKNOWN";
type ZoneId = "A" | "B" | "C";

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

  // ✅ Zona aktif dari HERO 3D (buat dipakai di page 5)
  const [heroZone, setHeroZone] = useState<ZoneId>("A");

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

  // delta vs ideal (buat diagnosis/action)
  const tempDelta =
    temperature != null
      ? temperature < 22
        ? -(22 - temperature)
        : temperature > 28
        ? temperature - 28
        : 0
      : null;

  const humDelta =
    humidity != null
      ? humidity < 70
        ? -(70 - humidity)
        : humidity > 90
        ? humidity - 90
        : 0
      : null;

  // rekomendasi action sederhana
  function getActions() {
    if (status === "OFFLINE" || lastUpdateTs == null) {
      return [
        "Periksa power ESP32 dan koneksi WiFi.",
        "Cek token ThingsBoard dan endpoint API.",
        "Pastikan device mengirim telemetry.",
      ];
    }

    const out: string[] = [];
    if (temperature != null && temperature > 28)
      out.push("Nyalakan Fan / tambah exhaust (suhu tinggi).");
    if (temperature != null && temperature < 22)
      out.push("Kurangi airflow / gunakan pemanas jika ada (suhu rendah).");
    if (humidity != null && humidity < 70)
      out.push("Aktifkan Mist / tambah sumber air (RH rendah).");
    if (humidity != null && humidity > 90)
      out.push("Tingkatkan ventilasi / fan ON (RH tinggi).");

    if (out.length === 0) out.push("Monitoring normal, kondisi stabil.");
    return out;
  }

  const actions = getActions();

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
                  className={
                    status === "ONLINE"
                      ? "btn-live btn-live--on"
                      : "btn-live btn-live--off"
                  }
                >
                  <span
                    className={`live-dot ${
                      status === "ONLINE" ? "live-dot--on" : "live-dot--off"
                    }`}
                  />
                  Lihat Live Data
                  <span className="btn-live-glow" />
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
                activeZone={heroZone}
                onActiveZoneChange={setHeroZone}
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

        {/* =========== ENVIRONMENT / CONDITIONING (PAKET B) =========== */}
        <section
          id="environment"
          className="snap-start min-h-screen flex items-center"
        >
          <div className="max-w-6xl mx-auto px-4 py-10 w-full grid gap-6 lg:grid-cols-3 items-start">
            {/* ================= MONITORING (BESAR) ================= */}
            <div className="lg:col-span-2 space-y-4">
              <div className="space-y-2">
                <p className="hud-title">Conditioning</p>
                <h2 className="text-3xl font-bold">Maintain Ideal Condition</h2>
                <p className="text-sm text-slate-300 max-w-xl">
                  Jaga suhu di <b>22–28°C</b> dan kelembapan di <b>70–90%</b>.
                  Sistem menyalakan fan/mist otomatis jika keluar batas.
                </p>
              </div>

              {!isIdeal && (
                <div className="rounded-xl border border-red-500/40 glass neon-outline-red px-4 py-3 text-sm text-red-200">
                  ⚠️ Warning: kondisi di luar rentang ideal.
                  <div className="text-xs text-red-300/80 mt-1">
                    Fokus cek sensor zona <b>{heroZone}</b> dari panel 3D.
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
                        humidity != null
                          ? Math.min(100, Math.max(0, humidity))
                          : 0
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
                🎮 Inspect sensor Zona <b>{heroZone}</b> dari panel 3D di halaman pertama.{" "}
                <a href="#hero" className="underline ml-1">
                  Klik untuk kembali
                </a>
              </div>
            </div>

            {/* ================= DIAGNOSIS (KANAN ATAS) ================= */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 glass p-5 space-y-3">
                <div className="text-sm text-slate-400">Diagnosis</div>

                <div className="text-xl font-semibold">
                  {status === "OFFLINE" || lastUpdateTs == null
                    ? "Data Tidak Masuk"
                    : isIdeal
                    ? "Kondisi Ideal"
                    : "Perlu Perhatian"}
                </div>

                <div className="text-sm text-slate-300 space-y-1">
                  {temperature != null && (
                    <div>
                      Suhu sekarang{" "}
                      <b>{temperature.toFixed(1)}°C</b>{" "}
                      {tempDelta != null && tempDelta !== 0 && (
                        <span className="text-slate-400">
                          ({tempDelta > 0 ? "+" : ""}
                          {tempDelta.toFixed(1)}° dari ideal)
                        </span>
                      )}
                    </div>
                  )}

                  {humidity != null && (
                    <div>
                      RH sekarang <b>{humidity.toFixed(1)}%</b>{" "}
                      {humDelta != null && humDelta !== 0 && (
                        <span className="text-slate-400">
                          ({humDelta > 0 ? "+" : ""}
                          {humDelta.toFixed(1)}% dari ideal)
                        </span>
                      )}
                    </div>
                  )}

                  <div>
                    Fokus sensor: <b>Zona {heroZone}</b>
                  </div>

                  {lastUpdateText && (
                    <div className="text-xs text-slate-500">
                      Update terakhir: {lastUpdateText} WIB
                    </div>
                  )}
                </div>

                {/* ringkasan 24 jam dari TrendInsights */}
                <div className="pt-2">
                  <TrendInsights />
                </div>
              </div>

              {/* ================= ACTION (KANAN BAWAH) ================= */}
              <div className="rounded-2xl border border-slate-800 glass p-5 space-y-3">
                <div className="text-sm text-slate-400">Recommended Action</div>

                <ul className="text-sm text-slate-200 space-y-2">
                  {actions.map((a, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-[2px]">✅</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>

                <div className="text-xs text-slate-500 pt-1">
                  Tips: kalau warning muncul terus, cek Alerts + inspect zona di 3D.
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="snap-start h-24" />
      </div>
    </main>
  );
}
