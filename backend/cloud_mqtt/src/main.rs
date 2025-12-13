use rumqttc::{MqttOptions, AsyncClient, Event, Incoming, QoS};
use influxdb2::Client as InfluxClient;
use influxdb2::models::DataPoint;
use futures::stream;
use anyhow::Result;
use serde::Deserialize;
use std::time::Duration;
use tokio::time;
use tokio::task;
use tokio_util::codec::{FramedRead, LinesCodec};
use tokio_serial::SerialPortBuilderExt;
use futures::StreamExt;

// struktur data dari ESP
#[derive(Debug, Deserialize)]
struct Telemetry {
    temp_c: f32,
    hum_rh: f32,
}

#[tokio::main]
async fn main() -> Result<()> {
    // ---------------- MQTT Setup ----------------
    let mut mqttoptions = MqttOptions::new("edge-gateway", "demo.thingsboard.io", 1883);
    mqttoptions.set_credentials("vs4LHIbcEmNbVxxaB4EY", "");
    mqttoptions.set_keep_alive(Duration::from_secs(15));
    let (client, mut eventloop) = AsyncClient::new(mqttoptions, 10);

    // ---------------- InfluxDB Setup ----------------
    let influx = InfluxClient::new(
        "http://localhost:8086",
        "gnjr", // org
        "wv4n_sKUgQTt-uwoVIBwOGu4pdALo_5AMlJRQfxRPrkP4ZD5OSrRwZhnAANSu5584l0zhdRSgUQbdRNsiqjm7A==", // token
    );
    let bucket = "monitorskt";

    // ---------------- Serial Setup (async) ----------------
    let port_name = "/dev/ttyACM0"; // port esp32 S3
    let baud_rate = 115200;
    let serial = tokio_serial::new(port_name, baud_rate)
        .timeout(Duration::from_secs(2))
        .open_native_async()
        .expect("Gagal buka serial port");
        
    // Delay esp32S3
    println!("⏳ Menunggu ESP32 siap mengirim data...");
    time::sleep(Duration::from_secs(2)).await;
    println!("✅ Serial siap dibaca!");
    
    let mut reader = FramedRead::new(serial, LinesCodec::new());

    // ---------------- Task eventloop MQTT ----------------
    task::spawn(async move {
        loop {
            match eventloop.poll().await {
                Ok(notification) => match &notification {
                    Event::Incoming(Incoming::ConnAck(_)) => {
                        println!("✅ Berhasil terhubung ke ThingsBoard!");
                    }
                    Event::Incoming(Incoming::Publish(p)) => {
                        println!("📩 Pesan masuk | Topic: {}, Payload: {:?}", p.topic, p.payload);
                    }
                    _ => println!("⚡ MQTT event: {:?}", notification),
                },
                Err(e) => {
                    eprintln!("❌ MQTT eventloop error: {:?}", e);
                    break;
                }
            }
        }
    });

    // ---------------- Loop baca serial ----------------
    let mut counter: u64 = 1; // counter buat data
    while let Some(line_result) = reader.next().await {
        match line_result {
            Ok(line) => {
                // 🛡️ Tambahan filter: skip jika bukan teks ASCII (hindari error UTF-8)
                if !line.is_ascii() {
                   // println!("⚠️ Data non-UTF8 dilewati.");
                    continue;
                }

                if let Ok(data) = serde_json::from_str::<Telemetry>(&line) {
                    println!("\n───────── 📡 Data {} ─────────", counter);
                    println!("📟 Dari ESP   : {:?}", data);

                    // kirim ke ThingsBoard (MQTT)
                    let payload = format!(
                        r#"{{"temperature": {}, "humidity": {}}}"#,
                        data.temp_c, data.hum_rh
                    );
                    match client
                        .publish("v1/devices/me/telemetry", QoS::AtLeastOnce, false, payload)
                        .await
                    {
                        Ok(_) => println!("✅ Terkirim ke ThingsBoard"),
                        Err(e) => eprintln!("❌ Error publish MQTT: {:?}", e),
                    }

                    // simpan ke InfluxDB
                    let point = DataPoint::builder("telemetry")
                        .field("temperature", data.temp_c as f64)
                        .field("humidity", data.hum_rh as f64)
                        .build()?;

                    if let Err(e) = influx.write(bucket, stream::iter(vec![point])).await {
                        eprintln!("❌ Error tulis ke InfluxDB: {:?}", e);
                    } else {
                        println!("✅ Tersimpan di InfluxDB");
                    }

                    counter += 1;
                }
            }
            Err(e) => eprintln!("❌ Error baca serial: {:?}", e),
        }

        // 🕒 Delay pendek untuk menstabilkan komunikasi serial
        time::sleep(Duration::from_millis(200)).await;

        // 🕒 Delay utama antar pengiriman data
        time::sleep(Duration::from_secs(10)).await;
    }

    Ok(())
}
