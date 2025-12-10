"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import React, {
  Suspense,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";

type Props = {
  temperature: number | null;
  humidity: number | null;
  focus?: number; // 0..1 scroll zoom
};

type ZoneId = "A" | "B" | "C";

/* ================= Utils ================= */

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}

/** Palet IoT modern (hindari dominan putih/abu/hitam) */
const PALETTE = {
  chamberFloor: "#1b2bbf", // deep electric blue
  chamberWall: "#9f7aea", // violet
  rackA: "#18b7a5", // teal
  rackB: "#ff8f1f", // orange
  rackC: "#e84dbf", // pink-magenta
  rackTop: "#2ee6a6", // mint neon
  fanHousing: "#202a7a", // indigo
  mistBase: "#7dd3fc", // sky
  capBase: "#ffd54f", // warm yellow
  stemBase: "#ffe0b2", // cream tipis
};

/** warna kondisi suhu untuk glow environment */
function tempToColor(t: number | null) {
  if (t == null) return new THREE.Color("#22d3ee"); // cyan netral
  if (t < 22) return new THREE.Color("#3b82f6"); // dingin blue
  if (t <= 28) return new THREE.Color("#22c55e"); // ideal green
  return new THREE.Color("#fb7185"); // panas pink-red
}
function tempToIntensity(t: number | null) {
  if (t == null) return 0.6;
  const n = clamp01((t - 18) / (34 - 18));
  return 0.5 + n * 0.9;
}
function humToMistDensity(h: number | null) {
  if (h == null) return 0.02;
  const n = clamp01((h - 50) / 50);
  return 0.012 + n * 0.09;
}

/** warna indikator zona buat jamur */
function zoneToColor(z: ZoneId) {
  if (z === "A") return new THREE.Color(PALETTE.rackA);
  if (z === "B") return new THREE.Color(PALETTE.rackB);
  return new THREE.Color(PALETTE.rackC);
}

/* ================= Camera Rig ================= */

function CameraRig({ focus = 0 }: { focus?: number }) {
  const { camera } = useThree();
  useFrame(() => {
    const targetZ = 5.2 - focus * 2.0;
    const targetY = 1.85 - focus * 0.5;
    camera.position.z += (targetZ - camera.position.z) * 0.06;
    camera.position.y += (targetY - camera.position.y) * 0.06;
    camera.lookAt(0, 1.05, 0);
  });
  return null;
}

/* ================= Mist ================= */

function MistParticles({
  density,
  color,
}: {
  density: number;
  color: THREE.Color;
}) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, speeds } = useMemo(() => {
    const count = 140; // ringan
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 4.8;
      pos[i * 3 + 1] = Math.random() * 1.9 + 0.1;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 1.8;
      spd[i] = 0.04 + Math.random() * 0.12;
    }
    return { positions: pos, speeds: spd };
  }, []);

  useFrame((state, delta) => {
    const pts = pointsRef.current;
    if (!pts) return;

    const arr = pts.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < speeds.length; i++) {
      const yIdx = i * 3 + 1;
      arr[yIdx] += speeds[i] * delta * (0.16 + density);
      if (arr[yIdx] > 2.0) arr[yIdx] = 0.12;
    }
    pts.geometry.attributes.position.needsUpdate = true;
    pts.rotation.y = Math.sin(state.clock.elapsedTime * 0.04) * 0.025;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.028 + density * 0.055}
        color={color.clone().lerp(new THREE.Color(PALETTE.mistBase), 0.7)}
        transparent
        opacity={0.1 + density * 0.33}
        depthWrite={false}
      />
    </points>
  );
}

/* ================= Fan ================= */

function Fan({
  position,
  temp,
  glowColor,
}: {
  position: [number, number, number];
  temp: number | null;
  glowColor: THREE.Color;
}) {
  const bladeRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!bladeRef.current) return;
    const t = temp ?? 0;
    const isHot = t > 28;
    const speed = isHot ? 5.8 : 1.1;
    bladeRef.current.rotation.z -= speed * delta;
    bladeRef.current.rotation.x =
      Math.sin(state.clock.elapsedTime * 0.9) * 0.012;
  });

  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.2, 0.2, 0.08, 24]} />
        <meshStandardMaterial color={PALETTE.fanHousing} roughness={0.7} />
      </mesh>

      <group ref={bladeRef} position={[0, 0.05, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]}>
            <boxGeometry args={[0.32, 0.045, 0.02]} />
            <meshStandardMaterial
              color={"#ffd166"}
              emissive={glowColor}
              emissiveIntensity={0.75}
            />
          </mesh>
        ))}
      </group>

      <pointLight
        position={[0, 0.18, 0]}
        intensity={temp != null && temp > 28 ? 0.75 : 0.25}
        color={glowColor}
        distance={1.2}
      />
    </group>
  );
}

/* ================= Racks (fixed) ================= */

function GrowRack({
  position,
  baseColor,
}: {
  position: [number, number, number];
  baseColor: string;
}) {
  const glow = new THREE.Color(baseColor);
  const topColor = new THREE.Color(PALETTE.rackTop);

  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[1.75, 0.22, 0.58]} />
        <meshStandardMaterial
          color={baseColor}
          roughness={0.8}
          emissive={glow}
          emissiveIntensity={0.08}
        />
      </mesh>

      <mesh position={[0, 0.135, 0]}>
        <boxGeometry args={[1.62, 0.04, 0.5]} />
        <meshStandardMaterial
          color={topColor}
          roughness={0.5}
          emissive={topColor}
          emissiveIntensity={0.25}
        />
      </mesh>
    </group>
  );
}

/* ================= Center Mushroom + SLIDE ANIMATION ================= */

function CenterMushroom({
  glowColor,
  activeZone,
  onClick,
  slideFromX,
  slideKey,
}: {
  glowColor: THREE.Color;
  activeZone: ZoneId;
  onClick: () => void;
  slideFromX: number; // start posisi x dari kiri/kanan
  slideKey: number;   // biar reset animasi tiap ganti zona
}) {
  const ref = useRef<THREE.Group>(null);
  const zoneColor = useMemo(() => zoneToColor(activeZone), [activeZone]);

  // posisi target tetap di tengah
  const targetPos = useMemo(() => new THREE.Vector3(0, 0.72, 0.15), []);

  // reset posisi jamur tiap ganti zona → mulai dari kiri/kanan
  useEffect(() => {
    if (!ref.current) return;
    ref.current.position.set(slideFromX, targetPos.y, targetPos.z);
  }, [slideKey, slideFromX, targetPos.y, targetPos.z]);

  useFrame((state) => {
    if (!ref.current) return;

    // slide halus menuju tengah
    ref.current.position.lerp(targetPos, 0.12);

    // idle kecil
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = Math.sin(t * 0.7) * 0.035;
    ref.current.scale.setScalar(1 + Math.sin(t * 1.8) * 0.015);
  });

  const stemH = 0.24;

  return (
    <group
      ref={ref}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "default")}
      onPointerDown={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {/* stem */}
      <mesh position={[0, stemH / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.085, stemH, 16]} />
        <meshStandardMaterial color={PALETTE.stemBase} roughness={0.85} />
      </mesh>

      {/* cap */}
      <mesh position={[0, stemH + 0.06, 0]}>
        <sphereGeometry args={[0.17, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={PALETTE.capBase}
          emissive={glowColor}
          emissiveIntensity={1.1}
          roughness={0.25}
          metalness={0.15}
        />
      </mesh>

      {/* ring indikator zona */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.11, 0.24, 32]} />
        <meshStandardMaterial
          color={zoneColor}
          emissive={zoneColor}
          emissiveIntensity={2.2}
          transparent
          opacity={0.75}
          depthWrite={false}
        />
      </mesh>

      <pointLight
        intensity={0.7}
        distance={1.6}
        color={glowColor}
        position={[0, 0.32, 0]}
      />
    </group>
  );
}

/* ================= Tooltip kecil ================= */

function ZoneTooltip({
  zoneId,
  temperature,
  humidity,
  onClose,
}: {
  zoneId: ZoneId;
  temperature: number | null;
  humidity: number | null;
  onClose: () => void;
}) {
  return (
    <Html position={[0, 1.2, 0.2]} center>
      <div className="relative w-[155px] rounded-xl border border-slate-700 bg-slate-950/95 px-3 py-2 text-[11px] text-slate-100 shadow-xl">
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-slate-900 border border-slate-600 grid place-items-center text-xs"
        >
          ✕
        </button>

        <div className="font-semibold text-sm mb-1">
          Jamur Zona {zoneId}
        </div>

        <div className="grid grid-cols-2 gap-y-1">
          <span className="text-slate-400">Suhu</span>
          <span className="text-right font-semibold">
            {temperature != null ? `${temperature.toFixed(1)}°C` : "—"}
          </span>

          <span className="text-slate-400">RH</span>
          <span className="text-right font-semibold">
            {humidity != null ? `${humidity.toFixed(1)}%` : "—"}
          </span>
        </div>
      </div>
    </Html>
  );
}

/* ================= Scene ================= */

function ChamberScene({
  temperature,
  humidity,
  activeZone,
  onClickMushroom,
  slideFromX,
  slideKey,
}: {
  temperature: number | null;
  humidity: number | null;
  activeZone: ZoneId;
  onClickMushroom: () => void;
  slideFromX: number;
  slideKey: number;
}) {
  const envColor = useMemo(() => tempToColor(temperature), [temperature]);
  const lightIntensity = tempToIntensity(temperature);
  const mistDensity = humToMistDensity(humidity);

  const backWallRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!backWallRef.current) return;
    const tt = state.clock.elapsedTime;
    const mat = backWallRef.current.material as THREE.MeshStandardMaterial;
    mat.emissive = envColor;
    mat.emissiveIntensity = 0.06 + Math.sin(tt * 0.5) * 0.03;
  });

  return (
    <>
      <fog attach="fog" args={["#2a2ad6", 3.2, 9]} />

      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[8, 4]} />
        <meshStandardMaterial color={PALETTE.chamberFloor} roughness={0.95} />
      </mesh>

      {/* walls */}
      <mesh ref={backWallRef} position={[0, 1.35, -0.95]}>
        <boxGeometry args={[6.4, 2.9, 0.08]} />
        <meshStandardMaterial color={PALETTE.chamberWall} roughness={0.9} />
      </mesh>
      <mesh position={[-3.2, 1.35, 0]}>
        <boxGeometry args={[0.08, 2.9, 2.8]} />
        <meshStandardMaterial color={PALETTE.chamberWall} roughness={0.9} />
      </mesh>
      <mesh position={[3.2, 1.35, 0]}>
        <boxGeometry args={[0.08, 2.9, 2.8]} />
        <meshStandardMaterial color={PALETTE.chamberWall} roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.8, 0]}>
        <boxGeometry args={[6.4, 0.08, 2.8]} />
        <meshStandardMaterial color={PALETTE.chamberWall} roughness={0.9} />
      </mesh>

      {/* racks (tetap 3 buat konteks zona ABC) */}
      <GrowRack position={[-1.9, 0.25, 0.35]} baseColor={PALETTE.rackA} />
      <GrowRack position={[0, 0.25, 0.05]} baseColor={PALETTE.rackB} />
      <GrowRack position={[1.9, 0.25, -0.25]} baseColor={PALETTE.rackC} />

      {/* fans */}
      <Fan position={[-2.45, 2.2, 0.7]} temp={temperature} glowColor={envColor} />
      <Fan position={[2.45, 2.2, 0.7]} temp={temperature} glowColor={envColor} />

      {/* jamur slide dari kiri/kanan lalu stop di tengah */}
      <CenterMushroom
        glowColor={envColor}
        activeZone={activeZone}
        onClick={onClickMushroom}
        slideFromX={slideFromX}
        slideKey={slideKey}
      />

      {/* effects */}
      <MistParticles density={mistDensity} color={envColor} />

      {/* lighting */}
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 6, 3]} intensity={1.0} color={"#ffe9b0"} />
      <directionalLight
        position={[-4, 3, 1]}
        intensity={0.75 * lightIntensity}
        color={envColor}
      />
      <pointLight position={[0, 2.2, 1.5]} intensity={0.5} color={"#a78bfa"} distance={7} />
    </>
  );
}

/* ================= Export ================= */

export function Environment3D({ temperature, humidity, focus = 0 }: Props) {
  const t = temperature ?? null;
  const h = humidity ?? null;
  const headerColor = useMemo(() => tempToColor(t), [t]);

  const zones: ZoneId[] = ["A", "B", "C"];
  const [activeZone, setActiveZone] = useState<ZoneId>("A");
  const [showTooltip, setShowTooltip] = useState(false);

  // buat tau arah slide (kiri/kanan)
  const prevZoneRef = useRef<ZoneId>("A");
  const [slideFromX, setSlideFromX] = useState(0.9);
  const [slideKey, setSlideKey] = useState(0);

  function goToZone(next: ZoneId) {
    const prev = prevZoneRef.current;
    prevZoneRef.current = next;

    const prevIdx = zones.indexOf(prev);
    const nextIdx = zones.indexOf(next);
    const dir = nextIdx > prevIdx ? 1 : -1; // kanan atau kiri

    setSlideFromX(dir * 0.9); // start dari kanan/kiri
    setActiveZone(next);
    setShowTooltip(false);
    setSlideKey((k) => k + 1); // trigger reset animasi
  }

  function prevZone() {
    const idx = zones.indexOf(activeZone);
    const next = (idx - 1 + zones.length) % zones.length;
    goToZone(zones[next]);
  }
  function nextZone() {
    const idx = zones.indexOf(activeZone);
    const next = (idx + 1) % zones.length;
    goToZone(zones[next]);
  }

  return (
    <div className="relative w-full h-80 rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      {/* overlay kiri atas */}
      <div className="absolute left-3 top-3 z-10 text-xs bg-slate-950/90 rounded-md px-3 py-2 border border-slate-700 text-slate-100 shadow">
        <div>T: {t != null ? `${t.toFixed(1)}°C` : "—"}</div>
        <div>H: {h != null ? `${h.toFixed(1)}%` : "—"}</div>
        <div
          className="mt-1 text-[10px] font-medium tracking-wide uppercase"
          style={{ color: headerColor.getStyle() }}
        >
          Smart Mushroom Chamber
        </div>
      </div>

      {/* arrows */}
      <div className="absolute z-10 right-3 top-3 flex gap-2">
        <button
          onClick={prevZone}
          className="h-8 w-8 rounded-full grid place-items-center border border-slate-700 bg-slate-950/80 text-slate-100 hover:bg-slate-900"
          aria-label="Previous zone"
        >
          ◀
        </button>
        <button
          onClick={nextZone}
          className="h-8 w-8 rounded-full grid place-items-center border border-slate-700 bg-slate-950/80 text-slate-100 hover:bg-slate-900"
          aria-label="Next zone"
        >
          ▶
        </button>
      </div>

      {/* label zona aktif */}
      <div className="absolute z-10 right-3 top-14 text-[11px] px-2 py-1 rounded-md border border-slate-700 bg-slate-950/80 text-slate-100">
        Jamur Zona {activeZone}
      </div>

      <Canvas camera={{ position: [0, 1.85, 5.2], fov: 30 }}>
        <CameraRig focus={focus} />
        <Suspense fallback={null}>
          <ChamberScene
            temperature={t}
            humidity={h}
            activeZone={activeZone}
            onClickMushroom={() => setShowTooltip(true)}
            slideFromX={slideFromX}
            slideKey={slideKey}
          />

          {showTooltip && (
            <ZoneTooltip
              zoneId={activeZone}
              temperature={t}
              humidity={h}
              onClose={() => setShowTooltip(false)}
            />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}
