"use client";

import React, { useState, useRef, useEffect } from "react";
import { FloorPlan, Room, Door, Window } from "@/lib/types";
import {
  Compass,
  Eye,
  EyeOff,
  Download,
  FileJson,
  Check,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
} from "lucide-react";

interface FloorPlanCanvasProps {
  layout: FloorPlan;
  orientation?: string;
  roadFacing?: string;
  activeFloor?: number;
}

// ── Refined visual styles (sophisticated interior pastel color theme) ─────
const ROOM_STYLES: Record<
  string,
  { bg: string; border: string; labelColor: string; icon: string; label: string }
> = {
  living:           { bg: "#FCFBF7", border: "#DCD8CD", labelColor: "#4C4637", icon: "🛋️", label: "Living Room" },
  kitchen:          { bg: "#FAF0EC", border: "#E8D5CC", labelColor: "#7A5749", icon: "🍳", label: "Kitchen" },
  "bedroom-master": { bg: "#F3F8FC", border: "#CEDBE8", labelColor: "#3D5266", icon: "🛏️", label: "Master Bedroom" },
  "bedroom-2":      { bg: "#F4F9F4", border: "#CEDCDB", labelColor: "#3E5742", icon: "🛏️", label: "Bedroom 2" },
  "bedroom-3":      { bg: "#F4F9F4", border: "#CEDCDB", labelColor: "#3E5742", icon: "🛏️", label: "Bedroom 3" },
  "bathroom-1":     { bg: "#F0F9FA", border: "#CBE2E4", labelColor: "#385C60", icon: "🚿", label: "Bathroom" },
  "bathroom-2":     { bg: "#F0F9FA", border: "#CBE2E4", labelColor: "#385C60", icon: "🚿", label: "Bathroom 2" },
  parking:          { bg: "#F8F9FA", border: "#E5E7EB", labelColor: "#4B5563", icon: "🚗", label: "Parking Space" },
  garden:           { bg: "#EDF7ED", border: "#C7E2C7", labelColor: "#2E5C2E", icon: "🌿", label: "Garden / Lawn" },
  staircase:        { bg: "#F7F5FA", border: "#E2DAE8", labelColor: "#523C66", icon: "🪜", label: "Staircase" },
  pooja:            { bg: "#FFFBEA", border: "#F6E3AD", labelColor: "#6A531C", icon: "🪔", label: "Pooja Room" },
  dining:           { bg: "#FFF9F2", border: "#F6E3CD", labelColor: "#755635", icon: "🍽️", label: "Dining Area" },
  
  // Upper floor styles
  balcony:          { bg: "#FFFDF5", border: "#F5EAD2", labelColor: "#6B5826", icon: "🌅", label: "Balcony" },
  family:           { bg: "#FCFBF7", border: "#DCD8CD", labelColor: "#4C4637", icon: "🛋️", label: "Family Lounge" },
  "bedroom-guest":  { bg: "#F4F9F4", border: "#CEDCDB", labelColor: "#3E5742", icon: "🛏️", label: "Guest Bedroom" },
  terrace:          { bg: "#ECFDF5", border: "#A7F3D0", labelColor: "#065F46", icon: "🌳", label: "Open Terrace" },
  study:            { bg: "#F5F3FF", border: "#DDD6FE", labelColor: "#5B21B6", icon: "📚", label: "Study Room" },
};

function getStyle(id: string) {
  for (const key of Object.keys(ROOM_STYLES)) {
    if (id === key || id.startsWith(key)) return ROOM_STYLES[key];
  }
  return { bg: "#FAF9F6", border: "#E8E6E1", labelColor: "#4B5563", icon: "🏠", label: "Room" };
}

// Clean number formatting
function fmt(n: number): string {
  const r = Math.round(n * 2) / 2;
  return r % 1 === 0 ? String(r) : r.toFixed(1);
}

export default function FloorPlanCanvas({
  layout,
  orientation = "North",
  roadFacing = "North",
  activeFloor = 0,
}: FloorPlanCanvasProps) {
  const [showVastu, setShowVastu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1.0);

  const svgRef = useRef<SVGSVGElement>(null);
  const svgFullscreenRef = useRef<SVGSVGElement>(null);

  const { plotLength: W, plotBreadth: H, rooms = [], doors = [], windows = [] } = layout;

  // ── Scale and Padding ───────────────────────────────────────────────────
  const SC = 20; // 1 ft = 20 SVG units
  const PAD = 48;
  const svgW = W * SC;
  const svgH = H * SC;
  const viewW = svgW + PAD * 2;
  const viewH = svgH + PAD * 2;

  // ── Wall Thickness Constants ───────────────────────────────────────────
  const T_ext = 0.5; // External walls (6 inches / 0.5 ft)
  const T_int = 0.35; // Internal walls (4.2 inches / 0.35 ft)

  // Find boundaries of the house structure dynamically
  const houseLeft = rooms.length > 0 ? Math.min(...rooms.map((r) => r.x)) : 1.5;
  const houseRight = rooms.length > 0 ? Math.max(...rooms.map((r) => r.x + r.width)) : W - 1.5;
  const houseTop = rooms.length > 0 ? Math.min(...rooms.map((r) => r.y)) : 1.5;
  const houseBottom = rooms.length > 0 ? Math.max(...rooms.map((r) => r.y + r.height)) : H - 1.5;

  // Calculates room drawing bounds shifted inward by wall thicknesses
  function getRoomOffsets(room: Room) {
    const leftOffset = Math.abs(room.x - houseLeft) < 0.1 ? T_ext : T_int / 2;
    const rightOffset =
      Math.abs(room.x + room.width - houseRight) < 0.1 ? T_ext : T_int / 2;
    const topOffset = Math.abs(room.y - houseTop) < 0.1 ? T_ext : T_int / 2;
    const bottomOffset =
      Math.abs(room.y + room.height - houseBottom) < 0.1 ? T_ext : T_int / 2;

    return { leftOffset, rightOffset, topOffset, bottomOffset };
  }

  // ── Keyboard Shortcuts for Fullscreen Modal ──────────────────────────────
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      } else if (e.key === "+" || e.key === "=") {
        setZoom((z) => Math.min(3.0, z + 0.25));
      } else if (e.key === "-") {
        setZoom((z) => Math.max(0.75, z - 0.25));
      } else if (e.key === "0") {
        setZoom(1.0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // ── Locate Entry Points ─────────────────────────────────────────────────
  const parkingRoom = rooms.find((r) => r.id === "parking");
  const livingRoom = rooms.find((r) => r.id === "living");

  function gateCenter(): { x: number; y: number } {
    // Gate is always at the center of the road-facing plot boundary edge
    if (roadFacing === "North") return { x: W / 2, y: 0 };
    if (roadFacing === "South") return { x: W / 2, y: H };
    if (roadFacing === "West") return { x: 0, y: H / 2 };
    if (roadFacing === "East") return { x: W, y: H / 2 };
    return { x: W / 2, y: 0 };
  }

  function mainDoorPoint(): { x: number; y: number } | null {
    const door = doors.find((d) => d.room === "living");
    if (!door || !livingRoom) return null;
    const pos = door.position + door.width / 2;
    switch (door.wall) {
      case "top":
        return { x: livingRoom.x + pos, y: livingRoom.y };
      case "bottom":
        return { x: livingRoom.x + pos, y: livingRoom.y + livingRoom.height };
      case "left":
        return { x: livingRoom.x, y: livingRoom.y + pos };
      case "right":
        return { x: livingRoom.x + livingRoom.width, y: livingRoom.y + pos };
    }
  }

  const gc = gateCenter();
  const md = mainDoorPoint();

  function buildEntryPath(): string {
    if (!md) return "";
    const gx = gc.x * SC, gy = gc.y * SC;
    const dx = md.x * SC, dy = md.y * SC;
    if (roadFacing === "North" || roadFacing === "South") {
      return `${gx},${gy} ${gx},${dy} ${dx},${dy}`;
    } else {
      return `${gx},${gy} ${dx},${gy} ${dx},${dy}`;
    }
  }

  // ── Helper: Scaling & Clamping ──────────────────────────────────────────
  const furnitureScale = (roomW: number, roomH: number) => {
    const area = roomW * roomH;
    if (area < 80) return 0.65;
    if (area < 120) return 0.80;
    if (area < 180) return 0.90;
    return 1.0;
  };

  const clampedRect = (
    roomX: number,
    roomY: number,
    roomW: number,
    roomH: number,
    offsetX: number,
    offsetY: number,
    itemW: number,
    itemH: number,
    padding = 4
  ) => {
    const innerW = roomW - padding * 2;
    const innerH = roomH - padding * 2;
    if (itemW > innerW || itemH > innerH) {
      return null;
    }
    const targetX = roomX + offsetX;
    const targetY = roomY + offsetY;
    const minX = roomX + padding;
    const maxX = roomX + roomW - padding - itemW;
    const minY = roomY + padding;
    const maxY = roomY + roomH - padding - itemH;
    const x = Math.max(minX, Math.min(targetX, maxX));
    const y = Math.max(minY, Math.min(targetY, maxY));
    return { x, y, w: itemW, h: itemH };
  };

  const getRoomAbbreviation = (id: string): string => {
    if (id === "bedroom-master") return "MB";
    if (id === "bedroom-2") return "B2";
    if (id === "bedroom-3") return "B3";
    if (id === "bedroom-guest") return "GB";
    if (id === "living") return "L";
    if (id === "kitchen") return "K";
    if (id.startsWith("bathroom")) return "WC";
    if (id === "staircase") return "S";
    if (id === "parking") return "P";
    if (id === "pooja") return "PJ";
    if (id === "dining") return "D";
    if (id === "garden") return "G";
    if (id === "balcony") return "B";
    if (id === "family") return "FL";
    if (id === "terrace") return "T";
    if (id === "study") return "ST";
    return "R";
  };

  // ── Render Furniture Vectors ────────────────────────────────────────────
  const renderFurniture = (room: Room) => {
    const { leftOffset, rightOffset, topOffset, bottomOffset } = getRoomOffsets(room);
    const rx = (room.x + leftOffset) * SC;
    const ry = (room.y + topOffset) * SC;
    const rw = (room.width - leftOffset - rightOffset) * SC;
    const rh = (room.height - topOffset - bottomOffset) * SC;

    const color = "rgba(112, 128, 144, 0.22)"; // soft slate grey
    const stroke = 1.0;

    // Small utility rooms shouldn't contain large furniture clutter
    const isSmall = room.width < 5.5 || room.height < 5.5;
    if (isSmall && !room.id.startsWith("bathroom") && room.id !== "pooja") {
      return null;
    }

    const scale = furnitureScale(room.width, room.height);

    if (room.id === "bedroom-master" || room.id.startsWith("bedroom-2") || room.id.startsWith("bedroom-3")) {
      // ── Double Bed Outline ──
      const bW = Math.min(rw * 0.75, 95) * scale;
      const bH = Math.min(rh * 0.8, 105) * scale;
      const bed = clampedRect(rx, ry, rw, rh, (rw - bW) / 2, 12 * scale, bW, bH, 4);

      if (!bed) return null;

      const pW = (bed.w - 14 * scale) / 2;
      const pH = 15 * scale;

      return (
        <g key={`furn-${room.id}`} className="pointer-events-none select-none">
          {/* Bed frame */}
          <rect x={bed.x} y={bed.y} width={bed.w} height={bed.h} rx={4 * scale} fill="none" stroke={color} strokeWidth={stroke} />
          {/* Headboard */}
          <rect x={bed.x} y={bed.y} width={bed.w} height={10 * scale} rx={1 * scale} fill="none" stroke={color} strokeWidth={stroke} />
          {/* Pillows */}
          <rect x={bed.x + 5 * scale} y={bed.y + 14 * scale} width={pW} height={pH} rx={2 * scale} fill="none" stroke={color} strokeWidth={stroke} />
          <rect x={bed.x + bed.w - 5 * scale - pW} y={bed.y + 14 * scale} width={pW} height={pH} rx={2 * scale} fill="none" stroke={color} strokeWidth={stroke} />
          {/* Sheet fold */}
          <line x1={bed.x} y1={bed.y + bed.h * 0.42} x2={bed.x + bed.w} y2={bed.y + bed.h * 0.42} stroke={color} strokeWidth={stroke} />
          <line x1={bed.x} y1={bed.y + bed.h * 0.42} x2={bed.x + bed.w * 0.18} y2={bed.y + bed.h * 0.52} stroke={color} strokeWidth={stroke} />
        </g>
      );
    }

    if (room.id === "living") {
      // ── Sofa Set ──
      const sW = Math.min(rw * 0.7, 110) * scale;
      const sH = 28 * scale;
      const sofa = clampedRect(rx, ry, rw, rh, (rw - sW) / 2, 15 * scale, sW, sH, 4);

      if (!sofa) return null;

      const tableW = 44 * scale;
      const tableH = 24 * scale;
      const table = clampedRect(rx, ry, rw, rh, (rw - tableW) / 2, 15 * scale + sH + 18 * scale, tableW, tableH, 4);

      return (
        <g key={`furn-${room.id}`} className="pointer-events-none select-none">
          {/* Sofa frame */}
          <rect x={sofa.x} y={sofa.y} width={sofa.w} height={sofa.h} rx={3 * scale} fill="none" stroke={color} strokeWidth={stroke} />
          {/* Sofa Backrest */}
          <rect x={sofa.x} y={sofa.y} width={sofa.w} height={8 * scale} fill="none" stroke={color} strokeWidth={stroke} />
          {/* Sofa Armrests */}
          <rect x={sofa.x} y={sofa.y + 8 * scale} width={8 * scale} height={20 * scale} rx={1 * scale} fill="none" stroke={color} strokeWidth={stroke} />
          <rect x={sofa.x + sofa.w - 8 * scale} y={sofa.y + 8 * scale} width={8 * scale} height={20 * scale} rx={1 * scale} fill="none" stroke={color} strokeWidth={stroke} />
          {/* Coffee Table */}
          {table && (
            <rect x={table.x} y={table.y} width={table.w} height={table.h} rx={2 * scale} fill="none" stroke={color} strokeWidth={stroke} />
          )}
        </g>
      );
    }

    if (room.id === "kitchen") {
      // ── Kitchen L-Counter with Sink & Stove ──
      const cW_scaled = 28 * scale;
      const topCounter = clampedRect(rx, ry, rw, rh, 0, 0, rw, cW_scaled, 0);

      if (!topCounter) return null;

      const leftCounter = clampedRect(rx, ry, rw, rh, 0, cW_scaled, cW_scaled, rh - cW_scaled, 0);
      
      const stoveW = 36 * scale;
      const stoveH = 18 * scale;
      const stove = clampedRect(rx, ry, rw, rh, rw / 2 - stoveW / 2, 5 * scale, stoveW, stoveH, 4);

      const sinkW = 18 * scale;
      const sinkH = 26 * scale;
      const sink = clampedRect(rx, ry, rw, rh, 5 * scale, rh / 2 - sinkH / 2, sinkW, sinkH, 4);

      return (
        <g key={`furn-${room.id}`} className="pointer-events-none select-none">
          {/* Top Counter */}
          <rect x={topCounter.x} y={topCounter.y} width={topCounter.w} height={topCounter.h} fill="none" stroke={color} strokeWidth={stroke} />
          {/* Left Counter */}
          {leftCounter && (
            <rect x={leftCounter.x} y={leftCounter.y} width={leftCounter.w} height={leftCounter.h} fill="none" stroke={color} strokeWidth={stroke} />
          )}
          {/* Stove */}
          {stove && (
            <g transform={`translate(${stove.x}, ${stove.y})`}>
              <rect x={0} y={0} width={stove.w} height={stove.h} rx={2 * scale} fill="none" stroke={color} strokeWidth={stroke} />
              <circle cx={9 * scale} cy={9 * scale} r={5 * scale} fill="none" stroke={color} strokeWidth={stroke} />
              <circle cx={27 * scale} cy={9 * scale} r={5 * scale} fill="none" stroke={color} strokeWidth={stroke} />
            </g>
          )}
          {/* Sink */}
          {sink && (
            <g transform={`translate(${sink.x}, ${sink.y})`}>
              <rect x={0} y={0} width={sink.w} height={sink.h} rx={2 * scale} fill="none" stroke={color} strokeWidth={stroke} />
              <circle cx={9 * scale} cy={13 * scale} r={6 * scale} fill="none" stroke={color} strokeWidth={stroke} />
              <circle cx={9 * scale} cy={2 * scale} r={1.5} fill={color} />
            </g>
          )}
        </g>
      );
    }

    if (room.id.startsWith("bathroom")) {
      // ── Toilet WC & Sink ──
      const tW = 20 * scale;
      const tH = 30 * scale;
      const wc = clampedRect(rx, ry, rw, rh, 8 * scale, 8 * scale, tW, tH, 4);

      if (!wc) return null;

      const sW = 16 * scale;
      const sH = 16 * scale;
      const sink = clampedRect(rx, ry, rw, rh, rw - 24 * scale, 8 * scale, sW, sH, 4);

      return (
        <g key={`furn-${room.id}`} className="pointer-events-none select-none">
          {/* WC Tank */}
          <rect x={wc.x} y={wc.y} width={wc.w} height={9 * scale} rx={1 * scale} fill="none" stroke={color} strokeWidth={stroke} />
          {/* WC Bowl */}
          <ellipse cx={wc.x + wc.w / 2} cy={wc.y + 19 * scale} rx={8 * scale} ry={11 * scale} fill="none" stroke={color} strokeWidth={stroke} />
          <ellipse cx={wc.x + wc.w / 2} cy={wc.y + 19 * scale} rx={5 * scale} ry={8 * scale} fill="none" stroke={color} strokeWidth={stroke} opacity={0.5} />
          {/* Sink Basin */}
          {sink && (
            <>
              <rect x={sink.x} y={sink.y} width={sink.w} height={sink.h} rx={3 * scale} fill="none" stroke={color} strokeWidth={stroke} />
              <circle cx={sink.x + 8 * scale} cy={sink.y + 8 * scale} r={5 * scale} fill="none" stroke={color} strokeWidth={stroke} />
            </>
          )}
        </g>
      );
    }

    if (room.id === "dining") {
      // ── Dining Table ──
      const tW = 66 * scale;
      const tH = 36 * scale;
      const table = clampedRect(rx, ry, rw, rh, (rw - tW) / 2, (rh - tH) / 2, tW, tH, 4);

      if (!table) return null;

      return (
        <g key={`furn-${room.id}`} className="pointer-events-none select-none">
          {/* Table */}
          <rect x={table.x} y={table.y} width={table.w} height={table.h} rx={3 * scale} fill="none" stroke={color} strokeWidth={stroke} />
          {/* Chairs */}
          <rect x={table.x + 10 * scale} y={table.y - 6 * scale} width={14 * scale} height={6 * scale} rx={1 * scale} fill="none" stroke={color} strokeWidth={stroke} />
          <rect x={table.x + table.w - 24 * scale} y={table.y - 6 * scale} width={14 * scale} height={6 * scale} rx={1 * scale} fill="none" stroke={color} strokeWidth={stroke} />
          <rect x={table.x + 10 * scale} y={table.y + table.h} width={14 * scale} height={6 * scale} rx={1 * scale} fill="none" stroke={color} strokeWidth={stroke} />
          <rect x={table.x + table.w - 24 * scale} y={table.y + table.h} width={14 * scale} height={6 * scale} rx={1 * scale} fill="none" stroke={color} strokeWidth={stroke} />
        </g>
      );
    }

    if (room.id === "parking") {
      // ── Dotted Car Outline ──
      const cW = Math.min(rw * 0.7, 75) * scale;
      const cH = Math.min(rh * 0.78, 145) * scale;
      const car = clampedRect(rx, ry, rw, rh, (rw - cW) / 2, (rh - cH) / 2, cW, cH, 4);

      if (!car) return null;

      return (
        <g key={`furn-${room.id}`} className="pointer-events-none select-none">
          {/* Car Body */}
          <rect x={car.x} y={car.y} width={car.w} height={car.h} rx={10 * scale} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray="3,2" />
          {/* Windshield */}
          <path d={`M ${car.x + 8 * scale} ${car.y + car.h * 0.22} Q ${car.x + car.w / 2} ${car.y + car.h * 0.15} ${car.x + car.w - 8 * scale} ${car.y + car.h * 0.22}`} fill="none" stroke={color} strokeWidth={stroke} />
          {/* Rear Windshield */}
          <path d={`M ${car.x + 8 * scale} ${car.y + car.h * 0.78} Q ${car.x + car.w / 2} ${car.y + car.h * 0.85} ${car.x + car.w - 8 * scale} ${car.y + car.h * 0.78}`} fill="none" stroke={color} strokeWidth={stroke} />
        </g>
      );
    }

    if (room.id === "pooja") {
      // ── Pooja Mandir Altar ──
      const tW = 30 * scale;
      const tH = 30 * scale;
      const mandir = clampedRect(rx, ry, rw, rh, rw / 2 - tW / 2, rh / 2 - tH / 2, tW, tH, 4);

      if (!mandir) return null;

      const mcx = mandir.x + mandir.w / 2;
      const mcy = mandir.y + mandir.h / 2;

      return (
        <g key={`furn-${room.id}`} className="pointer-events-none select-none">
          {/* concentric square bases */}
          <rect x={mandir.x} y={mandir.y} width={mandir.w} height={mandir.h} rx={2 * scale} fill="none" stroke={color} strokeWidth={stroke} />
          <rect x={mcx - 10 * scale} y={mcy - 10 * scale} width={20 * scale} height={20 * scale} rx={1 * scale} fill="none" stroke={color} strokeWidth={stroke} />
          {/* Oil lamp flame */}
          <path d={`M ${mcx} ${mcy - 4 * scale} C ${mcx - 3 * scale} ${mcy} ${mcx - 3 * scale} ${mcy + 3 * scale} ${mcx} ${mcy + 5 * scale} C ${mcx + 3 * scale} ${mcy + 3 * scale} ${mcx + 3 * scale} ${mcy} ${mcx} ${mcy - 4 * scale} Z`} fill="none" stroke={color} strokeWidth={stroke} />
        </g>
      );
    }

    return null;
  };

  // ── Render Staircase Treads and Arrow ───────────────────────────────────
  const renderStaircase = (room: Room) => {
    const { leftOffset, rightOffset, topOffset, bottomOffset } = getRoomOffsets(room);
    const rx = (room.x + leftOffset) * SC;
    const ry = (room.y + topOffset) * SC;
    const rw = (room.width - leftOffset - rightOffset) * SC;
    const rh = (room.height - topOffset - bottomOffset) * SC;

    const scale = furnitureScale(room.width, room.height);
    const color = "rgba(74, 85, 104, 0.25)";
    const stroke = 1.0;
    const elements: React.JSX.Element[] = [];

    const isVertical = rh > rw;
    const len = isVertical ? rh : rw;
    const treadSpacing = 10 * scale;
    const treadCount = Math.floor((len - 8) / treadSpacing);
    const clampedCount = Math.max(2, Math.min(treadCount, 12));

    if (isVertical) {
      const stepH = rh / (clampedCount + 1);
      for (let i = 1; i <= clampedCount; i++) {
        const y = ry + i * stepH;
        elements.push(
          <line key={`stair-${i}`} x1={rx} y1={y} x2={rx + rw} y2={y} stroke={color} strokeWidth={stroke} />
        );
      }
      const midX = rx + rw / 2;
      elements.push(
        <line key="stair-mid" x1={midX} y1={ry + 10} x2={midX} y2={ry + rh - 10} stroke={color} strokeWidth={stroke} strokeDasharray="3,3" />
      );
      if (rh >= 60) {
        const arrowY1 = ry + rh - 15;
        const arrowY2 = ry + 15;
        elements.push(
          <g key="stair-arrow">
            <circle cx={midX} cy={arrowY1} r={3} fill={color} />
            <line x1={midX} y1={arrowY1} x2={midX} y2={arrowY2} stroke={color} strokeWidth={1.2} markerEnd="url(#arr-grey)" />
            <text x={midX + 8} y={arrowY1} fill="rgba(74, 85, 104, 0.4)" fontSize={9} fontWeight="bold">UP</text>
          </g>
        );
      }
    } else {
      const stepW = rw / (clampedCount + 1);
      for (let i = 1; i <= clampedCount; i++) {
        const x = rx + i * stepW;
        elements.push(
          <line key={`stair-${i}`} x1={x} y1={ry} x2={x} y2={ry + rh} stroke={color} strokeWidth={stroke} />
        );
      }
      const midY = ry + rh / 2;
      elements.push(
        <line key="stair-mid" x1={rx + 10} y1={midY} x2={rx + rw - 10} y2={midY} stroke={color} strokeWidth={stroke} strokeDasharray="3,3" />
      );
      if (rw >= 60) {
        const arrowX1 = rx + 15;
        const arrowX2 = rx + rw - 15;
        elements.push(
          <g key="stair-arrow">
            <circle cx={arrowX1} cy={midY} r={3} fill={color} />
            <line x1={arrowX1} y1={midY} x2={arrowX2} y2={midY} stroke={color} strokeWidth={1.2} markerEnd="url(#arr-grey)" />
            <text x={arrowX1} y={midY - 8} fill="rgba(74, 85, 104, 0.4)" fontSize={9} fontWeight="bold">UP</text>
          </g>
        );
      }
    }

    return <g key={`stairs-${room.id}`}>{elements}</g>;
  };

  // ── Render Wall Clearings for Thresholds ───────────────────────────────
  const renderDoorClearing = (door: Door, room: Room, idx: number) => {
    const rx = room.x * SC, ry = room.y * SC;
    const rw = room.width * SC, rh = room.height * SC;
    const dw = door.width * SC, pos = door.position * SC;
    const s = getStyle(door.room);

    let cx = 0, cy = 0, cw = 0, ch = 0;
    const tw = (Math.abs(room.y - houseTop) < 0.1 ? T_ext : T_int) * SC;

    switch (door.wall) {
      case "top":
        cx = rx + pos;
        cy = ry - tw / 2 - 1.5;
        cw = dw;
        ch = tw + 3;
        break;
      case "bottom":
        cx = rx + pos;
        cy = ry + rh - tw / 2 - 1.5;
        cw = dw;
        ch = tw + 3;
        break;
      case "left":
        cx = rx - tw / 2 - 1.5;
        cy = ry + pos;
        cw = tw + 3;
        ch = dw;
        break;
      case "right":
        cx = rx + rw - tw / 2 - 1.5;
        cy = ry + pos;
        cw = tw + 3;
        ch = dw;
        break;
    }

    return (
      <rect key={`door-clr-${idx}`} x={cx} y={cy} width={cw} height={ch} fill={s.bg} />
    );
  };

  const renderWindowClearing = (win: Window, room: Room, idx: number) => {
    const rx = room.x * SC, ry = room.y * SC;
    const rw = room.width * SC, rh = room.height * SC;
    const ww = win.width * SC, pos = win.position * SC;

    let cx = 0, cy = 0, cw = 0, ch = 0;
    const tw = (Math.abs(room.y - houseTop) < 0.1 ? T_ext : T_int) * SC;

    switch (win.wall) {
      case "top":
        cx = rx + pos;
        cy = ry - tw / 2 - 1.5;
        cw = ww;
        ch = tw + 3;
        break;
      case "bottom":
        cx = rx + pos;
        cy = ry + rh - tw / 2 - 1.5;
        cw = ww;
        ch = tw + 3;
        break;
      case "left":
        cx = rx - tw / 2 - 1.5;
        cy = ry + pos;
        cw = tw + 3;
        ch = ww;
        break;
      case "right":
        cx = rx + rw - tw / 2 - 1.5;
        cy = ry + pos;
        cw = tw + 3;
        ch = ww;
        break;
    }

    // Windows clear to clean white representing glass aperture
    return (
      <rect key={`win-clr-${idx}`} x={cx} y={cy} width={cw} height={ch} fill="#FFFFFF" />
    );
  };

  // ── Render Doors (Swing Arcs and Panels) ────────────────────────────────
  const renderDoor = (door: Door, room: Room, idx: number) => {
    const rx = room.x * SC, ry = room.y * SC;
    const rw = room.width * SC, rh = room.height * SC;
    const dw = door.width * SC, pos = door.position * SC;
    const isMain = door.room === "living";

    const { leftOffset, rightOffset, topOffset, bottomOffset } = getRoomOffsets(room);
    const rx_inner = (room.x + leftOffset) * SC;
    const ry_inner = (room.y + topOffset) * SC;
    const rw_inner = (room.width - leftOffset - rightOffset) * SC;
    const rh_inner = (room.height - topOffset - bottomOffset) * SC;

    let xh = 0, yh = 0, xc = 0, yc = 0, xo = 0, yo = 0, arc = "", panel = "";
    const color = isMain ? "#1D4ED8" : "#78350F"; // Royal Blue main door, Warm Amber other doors
    const strokeW = isMain ? 2.5 : 1.8;

    const depth = (door.wall === "top" || door.wall === "bottom") ? rh_inner : rw_inner;

    if (depth < dw) {
      let x1 = 0, y1 = 0, x2 = 0, y2 = 0, cx = 0, cy = 0;
      switch (door.wall) {
        case "top":
          x1 = rx + pos; y1 = ry;
          x2 = rx + pos + dw; y2 = ry;
          cx = rx + pos + dw / 2; cy = ry;
          break;
        case "bottom":
          x1 = rx + pos; y1 = ry + rh;
          x2 = rx + pos + dw; y2 = ry + rh;
          cx = rx + pos + dw / 2; cy = ry + rh;
          break;
        case "left":
          x1 = rx; y1 = ry + pos;
          x2 = rx; y2 = ry + pos + dw;
          cx = rx; cy = ry + pos + dw / 2;
          break;
        case "right":
          x1 = rx + rw; y1 = ry + pos;
          x2 = rx + rw; y2 = ry + pos + dw;
          cx = rx + rw; cy = ry + pos + dw / 2;
          break;
      }
      return (
        <g key={`door-${idx}`}>
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeWidth={1.5}
            strokeDasharray="3,3"
          />
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={color}
            fontSize={12}
            fontWeight="bold"
          >
            ↔
          </text>
        </g>
      );
    }

    switch (door.wall) {
      case "top":
        if (pos < (rw - dw) / 2) {
          xh = rx + pos; yh = ry;
          xc = rx + pos + dw; yc = ry;
          xo = xh; yo = yh + dw;
          arc = `M ${xo} ${yo} A ${dw} ${dw} 0 0 0 ${xc} ${yc}`;
        } else {
          xh = rx + pos + dw; yh = ry;
          xc = rx + pos; yc = ry;
          xo = xh; yo = yh + dw;
          arc = `M ${xo} ${yo} A ${dw} ${dw} 0 0 1 ${xc} ${yc}`;
        }
        panel = `M ${xh} ${yh} L ${xo} ${yo}`;
        break;
      case "bottom":
        if (pos < (rw - dw) / 2) {
          xh = rx + pos; yh = ry + rh;
          xc = rx + pos + dw; yc = ry + rh;
          xo = xh; yo = yh - dw;
          arc = `M ${xo} ${yo} A ${dw} ${dw} 0 0 1 ${xc} ${yc}`;
        } else {
          xh = rx + pos + dw; yh = ry + rh;
          xc = rx + pos; yc = ry + rh;
          xo = xh; yo = yh - dw;
          arc = `M ${xo} ${yo} A ${dw} ${dw} 0 0 0 ${xc} ${yc}`;
        }
        panel = `M ${xh} ${yh} L ${xo} ${yo}`;
        break;
      case "left":
        if (pos < (rh - dw) / 2) {
          xh = rx; yh = ry + pos;
          xc = rx; yc = ry + pos + dw;
          xo = xh + dw; yo = yh;
          arc = `M ${xo} ${yo} A ${dw} ${dw} 0 0 1 ${xc} ${yc}`;
        } else {
          xh = rx; yh = ry + pos + dw;
          xc = rx; yc = ry + pos;
          xo = xh + dw; yo = yh;
          arc = `M ${xo} ${yo} A ${dw} ${dw} 0 0 0 ${xc} ${yc}`;
        }
        panel = `M ${xh} ${yh} L ${xo} ${yo}`;
        break;
      case "right":
        if (pos < (rh - dw) / 2) {
          xh = rx + rw; yh = ry + pos;
          xc = rx + rw; yc = ry + pos + dw;
          xo = xh - dw; yo = yh;
          arc = `M ${xo} ${yo} A ${dw} ${dw} 0 0 0 ${xc} ${yc}`;
        } else {
          xh = rx + rw; yh = ry + pos + dw;
          xc = rx + rw; yc = ry + pos;
          xo = xh - dw; yo = yh;
          arc = `M ${xo} ${yo} A ${dw} ${dw} 0 0 1 ${xc} ${yc}`;
        }
        panel = `M ${xh} ${yh} L ${xo} ${yo}`;
        break;
    }

    const clipId = `clip-${room.id}-${idx}`;

    return (
      <g key={`door-${idx}`}>
        <defs>
          <clipPath id={clipId}>
            <rect x={rx_inner} y={ry_inner} width={rw_inner} height={rh_inner} />
          </clipPath>
        </defs>
        <path
          d={arc}
          fill="none"
          stroke={color}
          strokeWidth={0.8}
          strokeDasharray="3,2"
          opacity={0.4}
          clipPath={`url(#${clipId})`}
        />
        <path
          d={panel}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
      </g>
    );
  };

  // ── Render Windows ──────────────────────────────────────────────────────
  const renderWindow = (win: Window, room: Room, idx: number) => {
    const rx = room.x * SC, ry = room.y * SC;
    const rw = room.width * SC, rh = room.height * SC;
    const ww = win.width * SC, pos = win.position * SC;

    let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
    switch (win.wall) {
      case "top":    x1 = rx + pos; y1 = ry;      x2 = x1 + ww; y2 = ry;      break;
      case "bottom": x1 = rx + pos; y1 = ry + rh; x2 = x1 + ww; y2 = ry + rh; break;
      case "left":   x1 = rx;       y1 = ry + pos; x2 = rx;      y2 = y1 + ww; break;
      case "right":  x1 = rx + rw;  y1 = ry + pos; x2 = rx + rw; y2 = y1 + ww; break;
    }

    const isH = win.wall === "top" || win.wall === "bottom";
    const glassColor = "#38BDF8"; // modern cyan glass

    return (
      <g key={`win-${idx}`}>
        {isH ? (
          <>
            {/* Sill Line */}
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748B" strokeWidth={1.5} />
            {/* Glass Panes */}
            <line x1={x1} y1={y1 - 2.5} x2={x2} y2={y2 - 2.5} stroke={glassColor} strokeWidth={1.2} />
            <line x1={x1} y1={y1 + 2.5} x2={x2} y2={y2 + 2.5} stroke={glassColor} strokeWidth={1.2} />
            {/* Center Sash Tick */}
            <line x1={(x1 + x2) / 2} y1={y1 - 3.5} x2={(x1 + x2) / 2} y2={y1 + 3.5} stroke="#64748B" strokeWidth={1} />
          </>
        ) : (
          <>
            {/* Sill Line */}
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748B" strokeWidth={1.5} />
            {/* Glass Panes */}
            <line x1={x1 - 2.5} y1={y1} x2={x1 - 2.5} y2={y2} stroke={glassColor} strokeWidth={1.2} />
            <line x1={x1 + 2.5} y1={y1} x2={x1 + 2.5} y2={y2} stroke={glassColor} strokeWidth={1.2} />
            {/* Center Sash Tick */}
            <line x1={x1 - 3.5} y1={(y1 + y2) / 2} x2={x1 + 3.5} y2={(y1 + y2) / 2} stroke="#64748B" strokeWidth={1} />
          </>
        )}
      </g>
    );
  };

  // ── Unified SVG Content Generator ───────────────────────────────────────
  const renderSVGContent = () => {
    const houseW = (houseRight - houseLeft) * SC;
    const houseH = (houseBottom - houseTop) * SC;

    return (
      <>
        <defs>
          {/* Architectural grids */}
          <pattern id="grid-sm" width={SC} height={SC} patternUnits="userSpaceOnUse">
            <path d={`M ${SC} 0 L 0 0 0 ${SC}`} fill="none" stroke="#EAE6DA" strokeWidth="0.5" />
          </pattern>
          <pattern id="grid-lg" width={SC * 5} height={SC * 5} patternUnits="userSpaceOnUse">
            <rect width={SC * 5} height={SC * 5} fill="url(#grid-sm)" />
            <path d={`M ${SC * 5} 0 L 0 0 0 ${SC * 5}`} fill="none" stroke="#DCD8CD" strokeWidth="0.9" />
          </pattern>
          {/* Arrow markers */}
          <marker id="arr-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 1.5 L 8 5 L 0 8.5 Z" fill="#15803D" />
          </marker>
          <marker id="arr-grey" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 0 1.5 L 8 5 L 0 8.5 Z" fill="rgba(74, 85, 104, 0.4)" />
          </marker>
        </defs>

        <g transform={`translate(${PAD}, ${PAD})`}>
          {/* Plot Grid */}
          <rect width={svgW} height={svgH} fill="url(#grid-lg)" />

          {/* Plot Boundary Fence */}
          <rect x={0} y={0} width={svgW} height={svgH} fill="none" stroke="#475569" strokeWidth={3} strokeDasharray="6,4" />

          {/* ── Solid Structural Walls Background ── */}
          {rooms.length > 0 && (
            <rect
              x={houseLeft * SC}
              y={houseTop * SC}
              width={houseW}
              height={houseH}
              fill="#334155" // Slate-700 solid fill representing concrete walls
              stroke="#1E293B"
              strokeWidth={1.5}
            />
          )}

          {/* ── Room Floors (overlaid on top of wall background) ── */}
          {rooms.map((room) => {
            const s = getStyle(room.id);
            const { leftOffset, rightOffset, topOffset, bottomOffset } = getRoomOffsets(room);
            const rx = (room.x + leftOffset) * SC;
            const ry = (room.y + topOffset) * SC;
            const rw = (room.width - leftOffset - rightOffset) * SC;
            const rh = (room.height - topOffset - bottomOffset) * SC;

            const isSmall = room.width < 5.5 || room.height < 5.5;

            return (
              <g key={`room-grp-${room.id}`}>
                {/* Floor Area */}
                <rect
                  x={rx}
                  y={ry}
                  width={rw}
                  height={rh}
                  fill={s.bg}
                  stroke={s.border}
                  strokeWidth={1}
                />

                {/* Vector CAD Furniture Details */}
                {renderFurniture(room)}

                {/* Staircase treads */}
                {room.id === "staircase" && renderStaircase(room)}

                {/* Text Labels centered inside room floor */}
                {(() => {
                  const availW = room.width * SC - 8;
                  const labelX = rx + rw / 2;
                  const labelY = ry + rh / 2;

                  if (availW < 40) {
                    return (
                      <g className="pointer-events-none select-none">
                        <text
                          x={labelX}
                          y={labelY}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={s.labelColor}
                          fontSize={8}
                          fontWeight="700"
                          style={{ fontFamily: "Outfit, sans-serif" }}
                        >
                          {getRoomAbbreviation(room.id)}
                        </text>
                      </g>
                    );
                  } else if (availW <= 70) {
                    return (
                      <g className="pointer-events-none select-none">
                        <text
                          x={labelX}
                          y={labelY}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={s.labelColor}
                          fontSize={9}
                          fontWeight="700"
                          style={{ fontFamily: "Outfit, sans-serif" }}
                        >
                          {room.label}
                        </text>
                      </g>
                    );
                  } else {
                    const showEmoji = room.height * SC > 80;
                    return (
                      <g className="pointer-events-none select-none">
                        {showEmoji && (
                          <text
                            x={labelX}
                            y={labelY - 14}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={20}
                            className="opacity-85"
                          >
                            {s.icon}
                          </text>
                        )}
                        <text
                          x={labelX}
                          y={showEmoji ? labelY + 8 : labelY - 4}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={s.labelColor}
                          fontSize={11}
                          fontWeight="700"
                          style={{ fontFamily: "Outfit, sans-serif" }}
                        >
                          {room.label}
                        </text>
                        <text
                          x={labelX}
                          y={showEmoji ? labelY + 22 : labelY + 10}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={s.labelColor}
                          fontSize={8}
                          fontWeight="500"
                          className="opacity-70"
                          style={{ fontFamily: "monospace" }}
                        >
                          {fmt(room.width)}′ × {fmt(room.height)}′
                        </text>
                      </g>
                    );
                  }
                })()}
              </g>
            );
          })}

          {/* ── Wall Clearing for Doors/Windows ── */}
          {doors.map((door, i) => {
            const room = rooms.find((r) => r.id === door.room);
            return room ? renderDoorClearing(door, room, i) : null;
          })}
          {windows.map((win, i) => {
            const room = rooms.find((r) => r.id === win.room);
            return room ? renderWindowClearing(win, room, i) : null;
          })}

          {/* ── Openings Rendering (Doors/Windows drawn on top of cleared segments) ── */}
          {doors.map((door, i) => {
            const room = rooms.find((r) => r.id === door.room);
            return room ? renderDoor(door, room, i) : null;
          })}
          {windows.map((win, i) => {
            const room = rooms.find((r) => r.id === win.room);
            return room ? renderWindow(win, room, i) : null;
          })}

          {/* ── Outer Boundary Gate ── */}
          {(() => {
            const gx = gc.x * SC, gy = gc.y * SC;
            const gateW = 8 * SC;
            const leafW = gateW / 2;

            if (roadFacing === "North" || roadFacing === "South") {
              const wallY = roadFacing === "North" ? 0 : svgH;
              const outY = roadFacing === "North" ? -leafW : leafW;
              const sweepLeft = roadFacing === "North" ? 1 : 0;
              const sweepRight = roadFacing === "North" ? 0 : 1;

              return (
                <g key="road-gate">
                  {/* Gate Gap Clearing */}
                  <line x1={gx - leafW} y1={wallY} x2={gx + leafW} y2={wallY} stroke="#F8F6F0" strokeWidth={15} />
                  {/* Concrete Posts */}
                  <rect x={gx - leafW - 6} y={wallY - 6} width={12} height={12} fill="#1E293B" rx={1.5} />
                  <rect x={gx + leafW - 6} y={wallY - 6} width={12} height={12} fill="#1E293B" rx={1.5} />
                  {/* Gate Swing Lines (Outward) */}
                  <line x1={gx - leafW} y1={wallY} x2={gx - leafW} y2={wallY + outY} stroke="#16A34A" strokeWidth={2.5} />
                  <line x1={gx + leafW} y1={wallY} x2={gx + leafW} y2={wallY + outY} stroke="#16A34A" strokeWidth={2.5} />
                  {/* Swing Dash Arcs */}
                  <path d={`M ${gx - leafW} ${wallY + outY} A ${leafW} ${leafW} 0 0 ${sweepLeft} ${gx} ${wallY}`} fill="none" stroke="#16A34A" strokeWidth={1.2} strokeDasharray="3,2" opacity={0.6} />
                  <path d={`M ${gx + leafW} ${wallY + outY} A ${leafW} ${leafW} 0 0 ${sweepRight} ${gx} ${wallY}`} fill="none" stroke="#16A34A" strokeWidth={1.2} strokeDasharray="3,2" opacity={0.6} />
                  {/* Text Label */}
                  <text x={gx} y={wallY + (roadFacing === "North" ? 22 : -16)} textAnchor="middle" fill="#15803D" fontSize={16} fontWeight="900" style={{ fontFamily: "Outfit, sans-serif" }}>
                    🚧 GATE
                  </text>
                </g>
              );
            } else {
              const wallX = roadFacing === "West" ? 0 : svgW;
              const outX = roadFacing === "West" ? -leafW : leafW;
              const sweepTop = roadFacing === "West" ? 0 : 1;
              const sweepBottom = roadFacing === "West" ? 1 : 0;

              return (
                <g key="road-gate">
                  {/* Gate Gap Clearing */}
                  <line x1={wallX} y1={gy - leafW} x2={wallX} y2={gy + leafW} stroke="#F8F6F0" strokeWidth={15} />
                  {/* Concrete Posts */}
                  <rect x={wallX - 6} y={gy - leafW - 6} width={12} height={12} fill="#1E293B" rx={1.5} />
                  <rect x={wallX - 6} y={gy + leafW - 6} width={12} height={12} fill="#1E293B" rx={1.5} />
                  {/* Gate Swing Lines (Outward) */}
                  <line x1={wallX} y1={gy - leafW} x2={wallX + outX} y2={gy - leafW} stroke="#16A34A" strokeWidth={2.5} />
                  <line x1={wallX} y1={gy + leafW} x2={wallX + outX} y2={gy + leafW} stroke="#16A34A" strokeWidth={2.5} />
                  {/* Swing Dash Arcs */}
                  <path d={`M ${wallX + outX} ${gy - leafW} A ${leafW} ${leafW} 0 0 ${sweepTop} ${wallX} ${gy}`} fill="none" stroke="#16A34A" strokeWidth={1.2} strokeDasharray="3,2" opacity={0.6} />
                  <path d={`M ${wallX + outX} ${gy + leafW} A ${leafW} ${leafW} 0 0 ${sweepBottom} ${wallX} ${gy}`} fill="none" stroke="#16A34A" strokeWidth={1.2} strokeDasharray="3,2" opacity={0.6} />
                  {/* Text Label */}
                  <text x={wallX + (roadFacing === "West" ? 22 : -22)} y={gy} textAnchor="middle" fill="#15803D" fontSize={16} fontWeight="900" style={{ fontFamily: "Outfit, sans-serif", writingMode: "vertical-rl" } as React.CSSProperties}>
                    🚧 GATE
                  </text>
                </g>
              );
            }
          })()}

          {/* ── Entry Path Guide ── */}
          {md && (
            <polyline
              points={buildEntryPath()}
              fill="none"
              stroke="#16A34A"
              strokeWidth={1.5}
              strokeDasharray="6,4"
              strokeOpacity={0.55}
              markerEnd="url(#arr-green)"
              opacity={0.8}
            />
          )}

          {/* ── Main Door Indicator Tag ── */}
          {md && (() => {
            const dx = md.x * SC, dy = md.y * SC;
            const door = doors.find((d) => d.room === "living");
            if (!door) return null;

            let tx = dx, ty = dy, anchor: "start" | "end" | "middle" = "middle";
            const off = 26;
            switch (door.wall) {
              case "top":    ty -= off; break;
              case "bottom": ty += off; break;
              case "left":   tx -= off; anchor = "end"; break;
              case "right":  tx += off; anchor = "start"; break;
            }

            return (
              <g key="main-door-indicator">
                <circle cx={dx} cy={dy} r={8} fill="#2563EB" opacity={0.15} className="animate-pulse" />
                <circle cx={dx} cy={dy} r={3} fill="#2563EB" />
                <text x={tx} y={ty} textAnchor={anchor} dominantBaseline="middle" fill="#1D4ED8" fontSize={14} fontWeight="850" style={{ fontFamily: "Outfit, sans-serif", letterSpacing: "0.05em" }}>
                  ★ MAIN DOOR
                </text>
              </g>
            );
          })()}

          {/* ── Vastu 3x3 Overlay Grid ── */}
          {showVastu && (() => {
            const labels = [
              ["NW (Vayu)", "N (Kuber)", "NE (Pooja)"],
              ["W (Varun)", "Brahmasthan", "E (Aditya)"],
              ["SW (Master Bed)", "S (Yama)", "SE (Agni / Kitchen)"],
            ];
            return (
              <g opacity={0.65} key="vastu-grid">
                <line x1={svgW / 3} y1={0} x2={svgW / 3} y2={svgH} stroke="#B91C1C" strokeWidth={1.5} strokeDasharray="5,4" />
                <line x1={2 * svgW / 3} y1={0} x2={2 * svgW / 3} y2={svgH} stroke="#B91C1C" strokeWidth={1.5} strokeDasharray="5,4" />
                <line x1={0} y1={svgH / 3} x2={svgW} y2={svgH / 3} stroke="#B91C1C" strokeWidth={1.5} strokeDasharray="5,4" />
                <line x1={0} y1={2 * svgH / 3} x2={svgW} y2={2 * svgH / 3} stroke="#B91C1C" strokeWidth={1.5} strokeDasharray="5,4" />
                {labels.map((row, ri) =>
                  row.map((lbl, ci) => (
                    <g key={`vastu-${ri}-${ci}`}>
                      <rect x={(ci * svgW) / 3 + 4} y={(ri * svgH) / 3 + 4} width={svgW / 3 - 8} height={svgH / 3 - 8} fill="none" stroke="#FEE2E2" strokeWidth={0.5} />
                      <text
                        x={(ci * svgW) / 3 + svgW / 6}
                        y={(ri * svgH) / 3 + svgH / 6}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#B91C1C"
                        fontSize={10}
                        fontWeight="700"
                        style={{ fontFamily: "Outfit, sans-serif" }}
                      >
                        {lbl}
                      </text>
                    </g>
                  ))
                )}
              </g>
            );
          })()}
        </g>

        {/* ── Road Indicator Layer ── */}
        {roadFacing && (() => {
          const thickness = 35, gap = 8;
          let rx = 0, ry = 0, rw = 0, rh = 0, tx = 0, ty = 0, tRot = 0;
          switch (roadFacing) {
            case "North":
              rx = PAD; ry = PAD - thickness - gap; rw = svgW; rh = thickness;
              tx = PAD + svgW / 2; ty = ry + thickness / 2; break;
            case "South":
              rx = PAD; ry = PAD + svgH + gap; rw = svgW; rh = thickness;
              tx = PAD + svgW / 2; ty = ry + thickness / 2; break;
            case "West":
              rx = PAD - thickness - gap; ry = PAD; rw = thickness; rh = svgH;
              tx = rx + thickness / 2; ty = PAD + svgH / 2; tRot = -90; break;
            case "East":
              rx = PAD + svgW + gap; ry = PAD; rw = thickness; rh = svgH;
              tx = rx + thickness / 2; ty = PAD + svgH / 2; tRot = 90; break;
          }
          return (
            <g key="road-strip">
              <rect x={rx} y={ry} width={rw} height={rh} fill="#E2E8F0" rx={4} stroke="#CBD5E1" strokeWidth={1} />
              {roadFacing === "North" || roadFacing === "South" ? (
                <line x1={rx + 15} y1={ry + rh / 2} x2={rx + rw - 15} y2={ry + rh / 2} stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="8,6" />
              ) : (
                <line x1={rx + rw / 2} y1={ry + 15} x2={rx + rw / 2} y2={ry + rh - 15} stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="8,6" />
              )}
              <text
                x={tx}
                y={ty}
                transform={tRot ? `rotate(${tRot}, ${tx}, ${ty})` : undefined}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#475569"
                fontSize={15}
                fontWeight="800"
                style={{ fontFamily: "Outfit, sans-serif", letterSpacing: "0.15em" }}
              >
                🛣️ ROAD ACCESS
              </text>
            </g>
          );
        })()}

        {/* ── Plot Dimension Ruler Guides ── */}
        {/* Width Ruler (Bottom) */}
        <g key="ruler-width">
          <line x1={PAD} y1={PAD + svgH + 20} x2={PAD + svgW} y2={PAD + svgH + 20} stroke="#475569" strokeWidth={1.2} />
          <line x1={PAD} y1={PAD + svgH + 15} x2={PAD} y2={PAD + svgH + 25} stroke="#475569" strokeWidth={1.2} />
          <line x1={PAD + svgW} y1={PAD + svgH + 15} x2={PAD + svgW} y2={PAD + svgH + 25} stroke="#475569" strokeWidth={1.2} />
          <text x={PAD + svgW / 2} y={PAD + svgH + 36} textAnchor="middle" fill="#334155" fontSize={16} fontWeight="700" style={{ fontFamily: "monospace" }}>
            {fmt(W)} ft
          </text>
        </g>
        {/* Height Ruler (Right) */}
        <g key="ruler-height">
          <line x1={PAD + svgW + 20} y1={PAD} x2={PAD + svgW + 20} y2={PAD + svgH} stroke="#475569" strokeWidth={1.2} />
          <line x1={PAD + svgW + 15} y1={PAD} x2={PAD + svgW + 25} y2={PAD} stroke="#475569" strokeWidth={1.2} />
          <line x1={PAD + svgW + 15} y1={PAD + svgH} x2={PAD + svgW + 25} y2={PAD + svgH} stroke="#475569" strokeWidth={1.2} />
          <text x={PAD + svgW + 36} y={PAD + svgH / 2} textAnchor="middle" fill="#334155" fontSize={16} fontWeight="700" transform={`rotate(-90, ${PAD + svgW + 36}, ${PAD + svgH / 2})`} style={{ fontFamily: "monospace" }}>
            {fmt(H)} ft
          </text>
        </g>

        {/* ── Neat Compass Indicator ── */}
        <g transform={`translate(${viewW - 50}, 50)`} key="compass">
          <circle cx={0} cy={0} r={22} fill="#FFFFFF" stroke="#E2E8F0" strokeWidth={1.5} className="shadow-xs" />
          <g transform={`rotate(${orientation === "Northeast" ? 45 : orientation === "East" ? 90 : orientation === "Southeast" ? 135 : orientation === "South" ? 180 : orientation === "Southwest" ? 225 : orientation === "West" ? 270 : orientation === "Northwest" ? 315 : 0})`}>
            {/* North Arrow */}
            <path d="M 0 -15 L -4 -2 L 0 -5 L 4 -2 Z" fill="#DC2626" />
            {/* South Arrow */}
            <path d="M 0 15 L -4 2 L 0 5 L 4 2 Z" fill="#64748B" />
            <line x1={0} y1={-5} x2={0} y2={5} stroke="#475569" strokeWidth={1} />
          </g>
          <text x={0} y={-22} textAnchor="middle" fill="#DC2626" fontSize={9} fontWeight="900" style={{ fontFamily: "Outfit, sans-serif" }}>
            N
          </text>
        </g>
      </>
    );
  };

  // ── Download Actions ────────────────────────────────────────────────────
  const downloadSVG = (ref: React.RefObject<SVGSVGElement | null>) => {
    if (!ref.current) return;
    const data = new XMLSerializer().serializeToString(ref.current);
    const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `house_plan_${W}x${H}ft_${roadFacing}_road_floor_${activeFloor}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadPNG = (ref: React.RefObject<SVGSVGElement | null>) => {
    if (!ref.current) return;
    const svgEl = ref.current;
    const width = viewW;
    const height = viewH;
    
    const svgString = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const DOMURL = window.URL || window.webkitURL || window;
    const blobURL = DOMURL.createObjectURL(svgBlob);
    
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(2, 2);
        ctx.fillStyle = "#F5F3EF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);
        
        try {
          const pngURL = canvas.toDataURL("image/png");
          const a = document.createElement("a");
          a.href = pngURL;
          a.download = `house_plan_${W}x${H}ft_${roadFacing}_road_floor_${activeFloor}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch (err) {
          console.error("Canvas toDataURL failed:", err);
        }
      }
      DOMURL.revokeObjectURL(blobURL);
    };
    image.src = blobURL;
  };

  const copyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(layout, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-[#E0DBCD] shadow-sm overflow-hidden flex-1 min-h-[50vh] lg:min-h-0 w-full">
      {/* ── Header Toolbar ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-between items-center gap-3 bg-[#FAFAF6] border-b border-[#E0DBCD] px-5 py-3.5 z-10 shrink-0">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-[#2C3539]" />
          <h2 className="font-bold text-sm md:text-base text-[#2C3539] font-outfit">
            {activeFloor === 0 ? "Ground Floor" : `Floor ${activeFloor}`} Draft — {fmt(W)}′ × {fmt(H)}′
            <span className="ml-2 text-xs font-normal text-stone-500 font-mono">
              ({W * H} sq ft)
            </span>
          </h2>
        </div>
        <div className="flex gap-2">
          {/* Toggle Vastu */}
          <button
            onClick={() => setShowVastu(!showVastu)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              showVastu
                ? "bg-[#2C3539] text-white border-[#2C3539]"
                : "bg-white text-[#2C3539] border-[#E0DBCD] hover:bg-stone-50"
            }`}
          >
            {showVastu ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            Vastu Grid
          </button>
          {/* Export SVG */}
          <button
            onClick={() => downloadSVG(svgRef)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-[#2C3539] border border-[#E0DBCD] hover:bg-stone-50 rounded-lg text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" /> Export SVG
          </button>
          {/* Export PNG */}
          <button
            onClick={() => downloadPNG(svgRef)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-[#2C3539] border border-[#E0DBCD] hover:bg-stone-50 rounded-lg text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" /> Export PNG
          </button>
          {/* Expand Fullscreen */}
          <button
            onClick={() => {
              setZoom(1.0);
              setIsFullscreen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-[#2C3539] border border-[#E0DBCD] hover:bg-stone-50 rounded-lg text-xs font-medium"
          >
            <Maximize2 className="w-3.5 h-3.5" /> Fullscreen
          </button>
        </div>
      </div>

      {/* ── Main Canvas Area (Constrained viewport, fits 1 page!) ─────────── */}
      <div className="flex-1 min-h-0 bg-[#F5F3EF] relative overflow-hidden">
        <div className="absolute inset-0 p-4 flex items-center justify-center">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${viewW} ${viewH}`}
            className="w-full h-full max-w-full max-h-full drop-shadow-md select-none"
          >
            {renderSVGContent()}
          </svg>
        </div>
      </div>

      {/* ── Warnings Notice Banner ── */}
      {layout.warnings && layout.warnings.length > 0 && (
        <div className="bg-amber-50 border-y border-amber-200 px-5 py-2 shrink-0 text-xs text-amber-800 font-medium">
          {layout.warnings.map((warn, i) => (
            <div key={i} className="flex items-start gap-1.5 leading-relaxed">
              <span className="shrink-0 text-amber-500 font-bold">⚠️ Warning:</span>
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Legend Bar ───────────────────────────────────────────────────── */}
      <div className="bg-[#FAFAF6] border-t border-[#E0DBCD] px-4 py-1.5 shrink-0">
        <div className="flex flex-wrap gap-x-3.5 gap-y-1 items-center">
          <span className="text-[9px] font-bold text-stone-500 uppercase tracking-wider">
            Legend:
          </span>
          <div className="flex items-center gap-1 text-[11px] text-[#37474F] font-medium">
            <div className="w-2.5 h-2.5 bg-[#334155] border border-[#1E293B]" />
            <span>Structural Wall</span>
          </div>
          {rooms
            .filter(
              (r, i, a) =>
                a.findIndex((x) => getStyle(x.id).icon === getStyle(r.id).icon) === i
            )
            .map((room) => {
              const s = getStyle(room.id);
              return (
                <div
                  key={`leg-${room.id}`}
                  className="flex items-center gap-1 text-[11px] text-[#37474F] font-medium"
                >
                  <div
                    className="w-2.5 h-2.5 rounded border"
                    style={{ background: s.bg, borderColor: s.border }}
                  />
                  <span>
                    {s.icon} {s.label}
                  </span>
                </div>
              );
            })}
        </div>
        <div className="flex flex-wrap gap-3 mt-1 text-[9.5px] text-stone-400 font-medium">
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-3.5 h-0 border-b-[1.5px] border-dashed"
              style={{ borderColor: "#16A34A" }}
            ></span>
            Main Entry Path
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-[#16A34A]"></span>
            Road Gate
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-[#2563EB]"></span>
            Main Door (★)
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-3.5 h-0 border-b-[1.5px]"
              style={{ borderColor: "#38BDF8" }}
            ></span>
            Window Aperture
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-3.5 h-0 border-b-[1.5px]"
              style={{ borderColor: "#78350F" }}
            ></span>
            Swinging Door
          </span>
        </div>
      </div>

      {/* ── Explanation Drawer (Clean dynamic notes) ───────────────────────── */}
      <div className="border-t border-[#E0DBCD] px-5 py-2.5 bg-white shrink-0">
        <p className="text-xs text-[#455A64] leading-relaxed">
          <span className="font-bold text-[#263238] font-outfit">Draft Notes: </span>
          {layout.explanation}
        </p>
      </div>

      {/* ── INTERACTIVE FULLSCREEN MODAL OVERLAY ──────────────────────────── */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-[#161819] flex flex-col animate-fade-in text-stone-350 select-none">
          {/* Modal Header */}
          <div className="flex justify-between items-center bg-[#202224] border-b border-stone-800 px-6 py-4 shrink-0">
            <div className="flex items-center gap-3">
              <Compass className="w-5 h-5 text-red-500 animate-spin-slow" />
              <div>
                <h3 className="font-extrabold text-sm md:text-base text-white font-outfit">
                  Interactive Design Draft — {fmt(W)}′ × {fmt(H)}′
                </h3>
                <p className="text-[10px] text-stone-500 font-mono mt-0.5">
                  Zoom: {Math.round(zoom * 100)}% | Use +/- keys to zoom, Esc to exit
                </p>
              </div>
            </div>

            {/* Modal Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}
                className="p-2 bg-stone-800 hover:bg-stone-700 active:bg-stone-600 rounded-lg text-stone-300 transition-all"
                title="Zoom Out (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom((z) => Math.min(3.0, z + 0.25))}
                className="p-2 bg-stone-800 hover:bg-stone-700 active:bg-stone-600 rounded-lg text-stone-300 transition-all"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom(1.0)}
                className="p-2 bg-stone-800 hover:bg-stone-700 active:bg-stone-600 rounded-lg text-stone-300 transition-all flex items-center gap-1 text-xs"
                title="Reset Zoom (0)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Fit
              </button>
              <div className="h-6 w-[1px] bg-stone-800 mx-1" />
              <button
                onClick={() => setShowVastu(!showVastu)}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                  showVastu
                    ? "bg-red-700 text-white border-red-700 hover:bg-red-650"
                    : "bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-700"
                }`}
              >
                Vastu Grid
              </button>
              <button
                onClick={() => downloadSVG(svgFullscreenRef)}
                className="px-3 py-2 bg-stone-850 border border-stone-700 text-stone-300 hover:bg-stone-800 rounded-lg text-xs font-semibold flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> SVG
              </button>
              <button
                onClick={() => downloadPNG(svgFullscreenRef)}
                className="px-3 py-2 bg-stone-850 border border-stone-700 text-stone-300 hover:bg-stone-800 rounded-lg text-xs font-semibold flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> PNG
              </button>
              <button
                onClick={copyJSON}
                className="px-3 py-2 bg-stone-850 border border-stone-700 text-stone-300 hover:bg-stone-800 rounded-lg text-xs font-semibold flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <FileJson className="w-3.5 h-3.5" />}
                Copy JSON
              </button>
              <div className="h-6 w-[1px] bg-stone-800 mx-1" />
              <button
                onClick={() => setIsFullscreen(false)}
                className="p-2 bg-red-950/40 hover:bg-red-900/50 active:bg-red-900 text-red-400 rounded-lg transition-all"
                title="Close Fullscreen (Esc)"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Modal Canvas (With Scrollbars & Dynamic Sizing!) */}
          <div className="flex-1 overflow-auto p-8 bg-[#18191B] min-h-0 min-w-0 flex">
            <div
              style={{
                width: `${viewW * zoom}px`,
                height: `${viewH * zoom}px`,
                transition: "width 0.1s ease-out, height 0.1s ease-out",
              }}
              className="m-auto relative flex items-center justify-center select-none shadow-2xl bg-[#F5F3EF] rounded-xl border border-stone-800"
            >
              <svg
                ref={svgFullscreenRef}
                viewBox={`0 0 ${viewW} ${viewH}`}
                className="w-full h-full"
              >
                {renderSVGContent()}
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
