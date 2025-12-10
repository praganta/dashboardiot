import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const baseUrl = process.env.TB_URL;
  const username = process.env.TB_USERNAME;
  const password = process.env.TB_PASSWORD;
  const deviceId = process.env.TB_DEVICE_ID;

  if (!baseUrl || !username || !password || !deviceId) {
    return NextResponse.json(
      { error: "ThingsBoard env vars not set" },
      { status: 500 }
    );
  }

  try {
    // Login ke ThingsBoard
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!loginRes.ok) {
      const text = await loginRes.text();
      console.log("LOGIN ERROR:", text);
      return NextResponse.json(
        { error: "Failed to login to ThingsBoard", details: text },
        { status: 500 }
      );
    }

    const loginJson = await loginRes.json();
    const token = loginJson.token;

    // Range waktu: 10 menit terakhir
    const endTs = Date.now();
    const startTs = endTs - 20 * 60 * 60 * 1000;
    const keys = "temperature,humidity";

    const teleRes = await fetch(
      `${baseUrl}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${keys}&startTs=${startTs}&endTs=${endTs}&limit=500`,
      {
        headers: {
          "X-Authorization": `Bearer ${token}`,
        },
      }
    );

    if (!teleRes.ok) {
      const text = await teleRes.text();
      console.log("TB HISTORY ERROR:", text);
      return NextResponse.json(
        { error: "Failed to fetch telemetry history", details: text },
        { status: 500 }
      );
    }

    const teleJson = await teleRes.json();

    const temps = teleJson.temperature || [];
    const hums = teleJson.humidity || [];

    // Gabungkan
    const map = new Map();

    for (const p of temps) {
      map.set(p.ts, { ts: p.ts, temperature: parseFloat(p.value) });
    }

    for (const p of hums) {
      const obj = map.get(p.ts) || { ts: p.ts };
      obj.humidity = parseFloat(p.value);
      map.set(p.ts, obj);
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
