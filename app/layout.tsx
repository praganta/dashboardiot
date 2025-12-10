import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// ✅ penting buat HP
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#030712", // slate-950 vibe
};

export const metadata: Metadata = {
  title: {
    default: "IoT Mushroom Chamber Monitor",
    template: "%s • IoT Monitor",
  },
  description:
    "Dashboard IoT untuk monitoring suhu & kelembapan kumbung jamur secara realtime, historis, dan visual 3D.",
  applicationName: "IoT Mushroom Monitor",
  keywords: [
    "IoT",
    "kumbung jamur",
    "monitoring suhu",
    "monitoring kelembapan",
    "thingsboard",
    "esp32",
  ],
  authors: [{ name: "Praganta W" }],
  creator: "Praganta W",

  // ✅ biar share link di WA/IG ada preview cakep
  openGraph: {
    title: "IoT Mushroom Chamber Monitor",
    description:
      "Monitoring suhu & RH kumbung jamur realtime + grafik historis + panel 3D.",
    type: "website",
    locale: "id_ID",
    siteName: "IoT Mushroom Monitor",
  },

  // optional kalau nanti kamu pasang favicon custom
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
