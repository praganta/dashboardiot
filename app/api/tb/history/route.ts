import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type TBPoint = { ts: number; value: string };
type TBResp = {
  temperature?: TBPoint[];
  humidity?: TBPoint[];
};

export async function GET() {
  const TB_URL = process.env.TB_URL;
  const TB_USERNAME = process.env.TB_USERNAME;
  const TB_PASSWORD = process.env.TB_PASSWORD;
  const TB_DEVICE_ID = process.env.TB_DEVICE_ID;

  if (!TB_URL || !TB_USERNAME || !TB_PASSWORD || !TB_DEVICE_ID) {
    return NextResponse.json(
      { error: "ThingsBoard env vars not set" },
      { status: 500 }
    );
  }

  try {
    // 1) Login ThingsBoard
    const loginRes = await fetch(`${TB_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: TB_USERNAME, password: TB_PASSWORD }),
    });

    if (!loginRes.ok) {
      const text = await loginRes.text();
      return NextResponse.json(
        { error: "Failed to login to ThingsBoard", details: text },
        { status: 500 }
      );
    }

    const { token } = await loginRes.json();

    // 2) Range waktu: 24 jam terakhir (buat Trend 24 Jam)
    const endTs = Date.now();
    const startTs = endTs - 24 * 60 * 60 * 1000; // ✅ 24 jam
    const keys = "temperature,humidity";

    const teleRes = await fetch(
      `${TB_URL}/api/plugins/telemetry/DEVICE/${TB_DEVICE_ID}/values/timeseries` +
        `?keys=${keys}&startTs=${startTs}&endTs=${endTs}&limit=2000`,
      {
        headers: { "X-Authorization": `Bearer ${token}` },
        cache: "no-store",
      }
    );

    if (!teleRes.ok) {
      const text = await teleRes.text();
      return NextResponse.json(
        { error: "Failed to fetch telemetry history", details: text },
        { status: 500 }
      );
    }

    const teleJson = (await teleRes.json()) as TBResp;

    const suhuList = teleJson.temperature ?? [];
    const rhList = teleJson.humidity ?? [];

    // 3) Gabung berdasarkan timestamp
    const map = new Map<number, {
      ts: number;
      temperature: number | null;
      humidity: number | null;
    }>();

    for (const p of suhuList) {
      const v = Number(p.value);
      map.set(p.ts, {
        ts: p.ts,
        temperature: Number.isFinite(v) ? v : null,
        humidity: null,
      });
    }

    for (const p of rhList) {
      const v = Number(p.value);
      const prev = map.get(p.ts) ?? { ts: p.ts, temperature: null, humidity: null };
      prev.humidity = Number.isFinite(v) ? v : null;
      map.set(p.ts, prev);
    }

    const points = Array.from(map.values()).sort((a, b) => a.ts - b.ts);

    return NextResponse.json(points);
  } catch (err) {
    return NextResponse.json(
      { error: "Unexpected error", details: String(err) },
      { status: 500 }
    );
  }
}
