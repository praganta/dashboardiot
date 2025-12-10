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
    // 1) Login ke ThingsBoard (dapat JWT token)
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!loginRes.ok) {
      const text = await loginRes.text();
      return NextResponse.json(
        { error: "Failed to login to ThingsBoard", details: text },
        { status: 500 }
      );
    }

    const loginJson = (await loginRes.json()) as { token: string };
    const token = loginJson.token;

    // 2) Ambil telemetry terakhir untuk temperature & humidity
    const keys = "temperature,humidity";

    const teleRes = await fetch(
      `${baseUrl}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${keys}&limit=1`,
      {
        headers: {
          "X-Authorization": `Bearer ${token}`,
        },
      }
    );

    if (!teleRes.ok) {
      const text = await teleRes.text();
      return NextResponse.json(
        { error: "Failed to fetch telemetry", details: text },
        { status: 500 }
      );
    }

    const teleJson = (await teleRes.json()) as any;

    const tempArr = teleJson.temperature as
      | { ts: number; value: string }[]
      | undefined;
    const humArr = teleJson.humidity as
      | { ts: number; value: string }[]
      | undefined;

    const tempVal = tempArr?.[0]?.value ?? null;
    const humVal = humArr?.[0]?.value ?? null;
    const ts = tempArr?.[0]?.ts ?? humArr?.[0]?.ts ?? null;

    return NextResponse.json({
      temperature: tempVal !== null ? parseFloat(tempVal) : null,
      humidity: humVal !== null ? parseFloat(humVal) : null,
      ts,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unexpected error", details: String(err) },
      { status: 500 }
    );
  }
}
