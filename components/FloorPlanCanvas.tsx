"use client";

import React, { useState, useRef } from "react";
import { FloorPlan, Room, Door, Window } from "@/lib/types";
import { Compass, Eye, EyeOff, Download, FileJson, Copy, Check } from "lucide-react";

interface FloorPlanCanvasProps {
  layout: FloorPlan;
  orientation?: string;
  roadFacing?: string;
}

export default function FloorPlanCanvas({ layout, orientation = "North", roadFacing }: FloorPlanCanvasProps) {
  const [showVastuOverlay, setShowVastuOverlay] = useState(false);
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const { plotLength, plotBreadth, rooms, doors, windows, staircase, explanation } = layout;

  // Formatter to resolve JS float precision issues (e.g., 12.9500000000003 -> 13, 2.69999 -> 2.7)
  const formatNum = (val: number) => {
    return Number(val.toFixed(1));
  };

  // Shorten labels for small rooms to prevent text overflow
  const getShortLabel = (label: string, width: number) => {
    if (width < 6) {
      if (label.includes("Bathroom")) return label.replace("Bathroom", "Bath");
      if (label.includes("Pooja")) return "Pooja";
      if (label.includes("Bedroom")) return label.replace("Bedroom", "Bed");
      if (label.includes("Staircase")) return "Stairs";
    }
    if (width < 4) {
      if (label.includes("Bathroom")) return label.replace("Bathroom", "B");
      if (label.includes("Pooja")) return "Pj";
    }
    return label;
  };

  // Scale: 1 foot = 10 SVG units
  const scale = 10;
  const svgW = plotLength * scale;
  const svgH = plotBreadth * scale;

  // Set margins for roads/indicators
  const padding = 60;
  const viewWidth = svgW + padding * 2;
  const viewHeight = svgH + padding * 2;

  // Color mapping for room types
  const getRoomColor = (id: string) => {
    const key = id.toLowerCase();
    if (key.includes("master")) return "rgba(136, 192, 208, 0.15)"; // Soft blue
    if (key.includes("bedroom")) return "rgba(143, 188, 187, 0.15)"; // Muted teal
    if (key.includes("kitchen")) return "rgba(208, 135, 112, 0.15)"; // Warm orange
    if (key.includes("bathroom") || key.includes("toilet")) return "rgba(163, 190, 140, 0.12)"; // Soft green
    if (key.includes("staircase") || key.includes("stairs")) return "rgba(180, 142, 173, 0.15)"; // Muted purple
    if (key.includes("pooja")) return "rgba(235, 203, 139, 0.22)"; // Gold yellow
    if (key.includes("parking") || key.includes("garage")) return "rgba(76, 86, 106, 0.08)"; // Grey
    if (key.includes("garden") || key.includes("lawn")) return "rgba(163, 190, 140, 0.35)"; // Grass green
    if (key.includes("living") || key.includes("hall") || key.includes("drawing")) return "rgba(235, 203, 139, 0.1)"; // Soft warm cream
    return "rgba(229, 233, 240, 0.15)"; // Default neutral
  };

  const getRoomBorderColor = (id: string) => {
    const key = id.toLowerCase();
    if (key.includes("garden")) return "#a3be8c";
    if (key.includes("parking")) return "#d8dee9";
    return "#2e3440"; // Heavy architect line
  };

  // Render a door arc swing
  const renderDoor = (door: Door, room: Room, idx: number) => {
    // Find room coordinates
    const rx = room.x * scale;
    const ry = room.y * scale;
    const rw = room.width * scale;
    const rh = room.height * scale;

    const dw = door.width * scale;
    const pos = door.position * scale;

    let doorLineX1 = 0, doorLineY1 = 0, doorLineX2 = 0, doorLineY2 = 0;
    let arcPath = "";

    // Wall coordinates
    switch (door.wall) {
      case "top":
        doorLineX1 = rx + pos;
        doorLineY1 = ry;
        doorLineX2 = rx + pos + dw;
        doorLineY2 = ry;
        // Draw door open inwards (90 deg arc)
        arcPath = `M ${doorLineX1} ${doorLineY1} A ${dw} ${dw} 0 0 1 ${doorLineX1 + dw} ${doorLineY1 + dw} L ${doorLineX1 + dw} ${doorLineY1}`;
        break;
      case "bottom":
        doorLineX1 = rx + pos;
        doorLineY1 = ry + rh;
        doorLineX2 = rx + pos + dw;
        doorLineY2 = ry + rh;
        arcPath = `M ${doorLineX1} ${doorLineY1} A ${dw} ${dw} 0 0 0 ${doorLineX1 + dw} ${doorLineY1 - dw} L ${doorLineX1 + dw} ${doorLineY1}`;
        break;
      case "left":
        doorLineX1 = rx;
        doorLineY1 = ry + pos;
        doorLineX2 = rx;
        doorLineY2 = ry + pos + dw;
        arcPath = `M ${doorLineX1} ${doorLineY1} A ${dw} ${dw} 0 0 1 ${doorLineX1 + dw} ${doorLineY1 + dw} L ${doorLineX1} ${doorLineY1 + dw}`;
        break;
      case "right":
        doorLineX1 = rx + rw;
        doorLineY1 = ry + pos;
        doorLineX2 = rx + rw;
        doorLineY2 = ry + pos + dw;
        arcPath = `M ${doorLineX1} ${doorLineY1} A ${dw} ${dw} 0 0 0 ${doorLineX1 - dw} ${doorLineY1 + dw} L ${doorLineX1} ${doorLineY1 + dw}`;
        break;
    }

    return (
      <g key={`door-${idx}`} className="opacity-80">
        {/* Door arc swing */}
        <path d={arcPath} fill="none" stroke="#4c566a" strokeWidth={1} strokeDasharray="2,2" />
        {/* Open door panel line */}
        {door.wall === "top" && <line x1={doorLineX1} y1={doorLineY1} x2={doorLineX1} y2={doorLineY1 + dw} stroke="#2e3440" strokeWidth={2} />}
        {door.wall === "bottom" && <line x1={doorLineX1} y1={doorLineY1} x2={doorLineX1} y2={doorLineY1 - dw} stroke="#2e3440" strokeWidth={2} />}
        {door.wall === "left" && <line x1={doorLineX1} y1={doorLineY1} x2={doorLineX1 + dw} y2={doorLineY1} stroke="#2e3440" strokeWidth={2} />}
        {door.wall === "right" && <line x1={doorLineX1} y1={doorLineY1} x2={doorLineX1 - dw} y2={doorLineY1} stroke="#2e3440" strokeWidth={2} />}
        {/* Cover the main wall with a clean white/backgap space */}
        <line x1={doorLineX1} y1={doorLineY1} x2={doorLineX2} y2={doorLineY2} stroke="#fdfbf7" strokeWidth={3} />
      </g>
    );
  };

  // Render a window symbol
  const renderWindow = (win: Window, room: Room, idx: number) => {
    const rx = room.x * scale;
    const ry = room.y * scale;
    const rw = room.width * scale;
    const rh = room.height * scale;

    const ww = win.width * scale;
    const pos = win.position * scale;

    let wx1 = 0, wy1 = 0, wx2 = 0, wy2 = 0;

    switch (win.wall) {
      case "top":
        wx1 = rx + pos; wy1 = ry;
        wx2 = rx + pos + ww; wy2 = ry;
        break;
      case "bottom":
        wx1 = rx + pos; wy1 = ry + rh;
        wx2 = rx + pos + ww; wy2 = ry + rh;
        break;
      case "left":
        wx1 = rx; wy1 = ry + pos;
        wx2 = rx; wy2 = ry + pos + ww;
        break;
      case "right":
        wx1 = rx + rw; wy1 = ry + pos;
        wx2 = rx + rw; wy2 = ry + pos + ww;
        break;
    }

    return (
      <g key={`win-${idx}`}>
        {/* Thick white gap under window */}
        <line x1={wx1} y1={wy1} x2={wx2} y2={wy2} stroke="#fdfbf7" strokeWidth={4} />
        {/* Double window lines */}
        {win.wall === "top" || win.wall === "bottom" ? (
          <>
            <line x1={wx1} y1={wy1 - 1.5} x2={wx2} y2={wy2 - 1.5} stroke="#5e81ac" strokeWidth={1} />
            <line x1={wx1} y1={wy1 + 1.5} x2={wx2} y2={wy2 + 1.5} stroke="#5e81ac" strokeWidth={1} />
            <rect x={wx1} y={wy1 - 2} width={ww} height={4} fill="rgba(136, 192, 208, 0.3)" stroke="none" />
          </>
        ) : (
          <>
            <line x1={wx1 - 1.5} y1={wy1} x2={wx2 - 1.5} y2={wy2} stroke="#5e81ac" strokeWidth={1} />
            <line x1={wx1 + 1.5} y1={wy1} x2={wx2 + 1.5} y2={wy2} stroke="#5e81ac" strokeWidth={1} />
            <rect x={wx1 - 2} y={wy1} width={4} height={ww} fill="rgba(136, 192, 208, 0.3)" stroke="none" />
          </>
        )}
      </g>
    );
  };

  // Actions
  const downloadSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = `floor_plan_${plotLength}x${plotBreadth}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const copyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(layout, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#fdfbf7] rounded-2xl border border-[#e0dbcd] p-6 shadow-sm">
      {/* Visual Canvas Header Actions */}
      <div className="flex flex-wrap justify-between items-center gap-4 border-b border-[#e0dbcd] pb-4 mb-4">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-[#2c3539]" />
          <h2 className="font-semibold text-lg text-[#2c3539] font-outfit">2D House Blueprint</h2>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowVastuOverlay(!showVastuOverlay)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              showVastuOverlay
                ? "bg-[#2c3539] text-[#fdfbf7] border-[#2c3539]"
                : "bg-white text-[#2c3539] border-[#e0dbcd] hover:bg-[#fcfbf7]"
            }`}
          >
            {showVastuOverlay ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            Vastu Grid
          </button>

          <button
            onClick={downloadSVG}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-[#2c3539] border border-[#e0dbcd] hover:bg-[#fcfbf7] rounded-lg text-xs font-medium transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Download SVG
          </button>

          <button
            onClick={copyJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-[#2c3539] border border-[#e0dbcd] hover:bg-[#fcfbf7] rounded-lg text-xs font-medium transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <FileJson className="w-3.5 h-3.5" />}
            Copy JSON
          </button>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className="flex-1 flex items-center justify-center overflow-auto min-h-[350px] bg-[#fcfbf7] rounded-xl border border-[#eeeada] relative p-4">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          className="max-h-[550px] drop-shadow-md select-none transition-all duration-300"
          style={{ aspectRatio: `${viewWidth}/${viewHeight}` }}
        >
          <defs>
            {/* Blueprint Grid pattern (1 foot = 10 units, grid subdivision every 10 units) */}
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#eeeada" strokeWidth="0.5" />
            </pattern>
            {/* Major grid lines every 50 units (5 feet) */}
            <pattern id="major-grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <rect width="50" height="50" fill="url(#grid)" />
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e0dbcd" strokeWidth="0.8" />
            </pattern>
            {/* Entry Arrowhead Marker */}
            <marker
              id="entry-arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
            </marker>
            <marker
              id="house-entry-arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#0f4c81" />
            </marker>
          </defs>

          {/* SVG Group shifted by padding */}
          <g transform={`translate(${padding}, ${padding})`}>
            {/* 1. Grid Paper Background */}
            <rect width={svgW} height={svgH} fill="url(#major-grid)" />

            {/* 2. Plot Boundary line */}
            <rect
              x={0}
              y={0}
              width={svgW}
              height={svgH}
              fill="none"
              stroke="#2c3539"
              strokeWidth={4}
              strokeLinejoin="miter"
            />

            {/* 3. Vastu Overlay (3x3 Grid) */}
            {showVastuOverlay && (
              <g className="transition-opacity duration-300">
                {/* 3x3 Division grid */}
                <line x1={svgW / 3} y1={0} x2={svgW / 3} y2={svgH} stroke="#bf616a" strokeWidth={1} strokeDasharray="3,3" />
                <line x1={(svgW * 2) / 3} y1={0} x2={(svgW * 2) / 3} y2={svgH} stroke="#bf616a" strokeWidth={1} strokeDasharray="3,3" />
                <line x1={0} y1={svgH / 3} x2={svgW} y2={svgH / 3} stroke="#bf616a" strokeWidth={1} strokeDasharray="3,3" />
                <line x1={0} y1={(svgH * 2) / 3} x2={svgW} y2={(svgH * 2) / 3} stroke="#bf616a" strokeWidth={1} strokeDasharray="3,3" />

                {/* Vastu Quadrants Text - labels at corner coords */}
                {(() => {
                  const xCols = [svgW / 6, (svgW * 3) / 6, (svgW * 5) / 6];
                  const yRows = [svgH / 6, (svgH * 3) / 6, (svgH * 5) / 6];
                  const vastuZones = [
                    ["NW (Vayu)", "North (Kuber)", "NE (Ishanya - Pooja)"],
                    ["West (Varun)", "Brahma (Space)", "East (Aditya)"],
                    ["SW (Nairutya - Master)", "South (Yama)", "SE (Agni - Kitchen)"],
                  ];

                  return yRows.map((y, rowIdx) =>
                    xCols.map((x, colIdx) => (
                      <text
                        key={`vastu-${rowIdx}-${colIdx}`}
                        x={x}
                        y={y}
                        fill="#bf616a"
                        fontSize={8}
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="opacity-40 select-none font-sans tracking-wide pointer-events-none"
                      >
                        {vastuZones[rowIdx][colIdx]}
                      </text>
                    ))
                  );
                })()}
              </g>
            )}

            {/* 4. Render Rooms */}
            {rooms.map((room) => {
              const rx = room.x * scale;
              const ry = room.y * scale;
              const rw = room.width * scale;
              const rh = room.height * scale;
              const isHovered = hoveredRoom === room.id;

              // Avoid drawing raw staircase rectangle directly if we want to draw custom stairs pattern
              const isStaircase = room.id === "staircase";
              const isGarden = room.id === "garden";
              const isParking = room.id === "parking";

              // Check room size to decide if we show dimensions and what font sizes to use
              const showDimensions = room.width >= 5.0 && room.height >= 5.0 && !isGarden && !isParking;
              const labelFontSize = Math.min(room.width, room.height) < 5.0 ? 8 : 10;

              return (
                <g
                  key={room.id}
                  onMouseEnter={() => setHoveredRoom(room.id)}
                  onMouseLeave={() => setHoveredRoom(null)}
                  className="cursor-pointer transition-all duration-200"
                >
                  {/* Room Fill Rect */}
                  <rect
                    x={rx}
                    y={ry}
                    width={rw}
                    height={rh}
                    fill={getRoomColor(room.id)}
                    stroke={getRoomBorderColor(room.id)}
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    className="transition-colors duration-200"
                  />

                  {/* Draw Staircase Custom Details */}
                  {isStaircase && (
                    <g opacity={0.65}>
                      {/* Draw stair treads */}
                      {rw > rh ? (
                        // Horizontal stairs
                        Array.from({ length: Math.floor(room.width / 0.8) }).map((_, i) => (
                          <line
                            key={`tread-${i}`}
                            x1={rx + i * 8}
                            y1={ry}
                            x2={rx + i * 8}
                            y2={ry + rh}
                            stroke="#2e3440"
                            strokeWidth={1}
                          />
                        ))
                      ) : (
                        // Vertical stairs
                        Array.from({ length: Math.floor(room.height / 0.8) }).map((_, i) => (
                          <line
                            key={`tread-${i}`}
                            x1={rx}
                            y1={ry + i * 8}
                            x2={rx + rw}
                            y2={ry + i * 8}
                            stroke="#2e3440"
                            strokeWidth={1}
                          />
                        ))
                      )}
                      {/* Direction arrow line */}
                      <path
                        d={`M ${rx + rw / 2} ${ry + rh - 6} L ${rx + rw / 2} ${ry + 6} M ${rx + rw / 2 - 3} ${ry + 9} L ${rx + rw / 2} ${ry + 5} L ${rx + rw / 2 + 3} ${ry + 9}`}
                        fill="none"
                        stroke="#2e3440"
                        strokeWidth={1.5}
                      />
                    </g>
                  )}

                  {/* Draw Parking Details */}
                  {isParking && (
                    <g opacity={0.4} className="pointer-events-none">
                      {/* Simple Car Outline */}
                      <rect x={rx + rw / 2 - 12} y={ry + rh / 2 - 20} width={24} height={40} rx={4} fill="none" stroke="#4c566a" strokeWidth={1} />
                      <rect x={rx + rw / 2 - 10} y={ry + rh / 2 - 14} width={20} height={12} rx={2} fill="none" stroke="#4c566a" strokeWidth={1} />
                    </g>
                  )}

                  {/* Room Text Label */}
                  {!isGarden && (
                    <text
                      x={rx + rw / 2}
                      y={showDimensions ? (ry + rh / 2 - 4) : (ry + rh / 2)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#2e3440"
                      fontSize={labelFontSize}
                      fontWeight="600"
                      className="font-outfit pointer-events-none"
                    >
                      {getShortLabel(room.label, room.width)}
                    </text>
                  )}
                  {isGarden && (
                    <text
                      x={rx + rw / 2}
                      y={ry + rh / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#4f743c"
                      fontSize={10}
                      fontWeight="bold"
                      className="font-outfit pointer-events-none italic"
                    >
                      🌿 {room.label}
                    </text>
                  )}

                  {/* Room Dimensions */}
                  {showDimensions && (
                    <text
                      x={rx + rw / 2}
                      y={ry + rh / 2 + 9}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#4c566a"
                      fontSize={8.5}
                      className="font-mono pointer-events-none select-none"
                    >
                      {formatNum(room.width)}' x {formatNum(room.height)}'
                    </text>
                  )}
                </g>
              );
            })}

            {/* 5. Render Doors */}
            {doors.map((door, idx) => {
              const room = rooms.find((r) => r.id === door.room);
              if (!room) return null;
              return renderDoor(door, room, idx);
            })}

            {/* 6. Render Windows */}
            {windows.map((win, idx) => {
              const room = rooms.find((r) => r.id === win.room);
              if (!room) return null;
              return renderWindow(win, room, idx);
            })}

            {/* 7. Plot Entry Arrow & Main House Door Entry Arrow */}
            {(() => {
              const parkingRoom = rooms.find(r => r.id === "parking");
              const livingRoom = rooms.find(r => r.id === "living");
              const mainDoor = doors.find(d => d.room === "living");

              const elements = [];

              // A. Plot Entry Gate (pointing from road to plot boundary)
              if (roadFacing) {
                let gateX = 0;
                let gateY = 0;
                let arrowX1 = 0, arrowY1 = 0, arrowX2 = 0, arrowY2 = 0;
                let textX = 0, textY = 0;

                if (roadFacing === "North") {
                  gateX = parkingRoom ? (parkingRoom.x + parkingRoom.width / 2) : (livingRoom ? (livingRoom.x + 3) : (plotLength / 2));
                  arrowX1 = gateX * scale;
                  arrowY1 = -20;
                  arrowX2 = gateX * scale;
                  arrowY2 = 4;
                  textX = gateX * scale;
                  textY = -25;
                } else if (roadFacing === "South") {
                  gateX = parkingRoom ? (parkingRoom.x + parkingRoom.width / 2) : (livingRoom ? (livingRoom.x + 3) : (plotLength / 2));
                  arrowX1 = gateX * scale;
                  arrowY1 = svgH + 20;
                  arrowX2 = gateX * scale;
                  arrowY2 = svgH - 4;
                  textX = gateX * scale;
                  textY = svgH + 28;
                } else if (roadFacing === "West") {
                  gateY = parkingRoom ? (parkingRoom.y + parkingRoom.height / 2) : (livingRoom ? (livingRoom.y + 3) : (plotBreadth / 2));
                  arrowX1 = -20;
                  arrowY1 = gateY * scale;
                  arrowX2 = 4;
                  arrowY2 = gateY * scale;
                  textX = -25;
                  textY = gateY * scale - 6;
                } else if (roadFacing === "East") {
                  gateY = parkingRoom ? (parkingRoom.y + parkingRoom.height / 2) : (livingRoom ? (livingRoom.y + 3) : (plotBreadth / 2));
                  arrowX1 = svgW + 20;
                  arrowY1 = gateY * scale;
                  arrowX2 = svgW - 4;
                  arrowY2 = gateY * scale;
                  textX = svgW + 25;
                  textY = gateY * scale - 6;
                }

                elements.push(
                  <g key="plot-entry" className="opacity-90">
                    {/* Plot Entry Arrow */}
                    <line
                      x1={arrowX1}
                      y1={arrowY1}
                      x2={arrowX2}
                      y2={arrowY2}
                      stroke="#10b981"
                      strokeWidth={2}
                      markerEnd="url(#entry-arrow)"
                    />
                    {/* Plot Entry Text */}
                    <text
                      x={textX}
                      y={textY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#10b981"
                      fontSize={8}
                      fontWeight="bold"
                      className="font-sans tracking-wide"
                    >
                      PLOT ENTRY
                    </text>
                  </g>
                );
              }

              // B. Main House Entrance Door Arrow
              if (livingRoom && mainDoor) {
                const rx = livingRoom.x * scale;
                const ry = livingRoom.y * scale;
                const rw = livingRoom.width * scale;
                const rh = livingRoom.height * scale;
                const pos = mainDoor.position * scale;
                const dw = mainDoor.width * scale;

                let arrowX1 = 0, arrowY1 = 0, arrowX2 = 0, arrowY2 = 0;
                let textX = 0, textY = 0;
                let textAnchor: "start" | "end" | "middle" = "middle";

                if (mainDoor.wall === "top") {
                  arrowX1 = rx + pos + dw / 2;
                  arrowY1 = ry - 14;
                  arrowX2 = rx + pos + dw / 2;
                  arrowY2 = ry - 2;
                  textX = rx + pos + dw / 2;
                  textY = ry - 18;
                } else if (mainDoor.wall === "bottom") {
                  arrowX1 = rx + pos + dw / 2;
                  arrowY1 = ry + rh + 14;
                  arrowX2 = rx + pos + dw / 2;
                  arrowY2 = ry + rh + 2;
                  textX = rx + pos + dw / 2;
                  textY = ry + rh + 18;
                } else if (mainDoor.wall === "left") {
                  arrowX1 = rx - 14;
                  arrowY1 = ry + pos + dw / 2;
                  arrowX2 = rx - 2;
                  arrowY2 = ry + pos + dw / 2;
                  textX = rx - 18;
                  textY = ry + pos + dw / 2;
                  textAnchor = "end";
                } else if (mainDoor.wall === "right") {
                  arrowX1 = rx + rw + 14;
                  arrowY1 = ry + pos + dw / 2;
                  arrowX2 = rx + rw + 2;
                  arrowY2 = ry + pos + dw / 2;
                  textX = rx + rw + 18;
                  textY = ry + pos + dw / 2;
                  textAnchor = "start";
                }

                elements.push(
                  <g key="house-entry" className="opacity-90">
                    {/* Main House Entry Arrow */}
                    <line
                      x1={arrowX1}
                      y1={arrowY1}
                      x2={arrowX2}
                      y2={arrowY2}
                      stroke="#0f4c81"
                      strokeWidth={1.5}
                      markerEnd="url(#house-entry-arrow)"
                    />
                    {/* Main House Entry Label */}
                    <text
                      x={textX}
                      y={textY}
                      textAnchor={textAnchor}
                      dominantBaseline="middle"
                      fill="#0f4c81"
                      fontSize={7.5}
                      fontWeight="bold"
                      className="font-outfit"
                    >
                      MAIN DOOR
                    </text>
                  </g>
                );
              }

              return elements;
            })()}
          </g>

          {/* 7. Plot Compass Rose (drawn outside the plot in padding space) */}
          <g transform={`translate(${viewWidth - 40}, 40)`} className="pointer-events-none">
            <circle cx={0} cy={0} r={18} fill="#fdfbf7" stroke="#e0dbcd" strokeWidth={1} />
            {/* North pointing arrow */}
            {(() => {
              let angle = 0;
              switch (orientation) {
                case "North": angle = 0; break;
                case "East": angle = 90; break;
                case "South": angle = 180; break;
                case "West": angle = 270; break;
                case "Northeast": angle = 45; break;
                case "Southeast": angle = 135; break;
                case "Southwest": angle = 225; break;
                case "Northwest": angle = 315; break;
              }
              return (
                <g transform={`rotate(${angle})`}>
                  {/* Arrowhead */}
                  <path d="M 0 -14 L -4 -2 L 0 -5 L 4 -2 Z" fill="#bf616a" />
                  {/* Arrow stem */}
                  <line x1={0} y1={-5} x2={0} y2={12} stroke="#2c3539" strokeWidth={1.5} />
                  <text x={0} y={-17} textAnchor="middle" fill="#bf616a" fontSize={7} fontWeight="bold" className="font-sans">
                    N
                  </text>
                </g>
              );
            })()}
          </g>

          {/* 8. Front Road Indicator */}
          {roadFacing && (() => {
            let rx = 0, ry = 0, rw = 0, rh = 0;
            let textX = 0, textY = 0, textRot = 0;

            const roadSize = 25;

            switch (roadFacing) {
              case "North":
                rx = padding;
                ry = padding - roadSize - 5;
                rw = svgW;
                rh = roadSize;
                textX = padding + svgW / 2;
                textY = padding - roadSize / 2 - 5;
                break;
              case "South":
                rx = padding;
                ry = padding + svgH + 5;
                rw = svgW;
                rh = roadSize;
                textX = padding + svgW / 2;
                textY = padding + svgH + roadSize / 2 + 5;
                break;
              case "West":
                rx = padding - roadSize - 5;
                ry = padding;
                rw = roadSize;
                rh = svgH;
                textX = padding - roadSize / 2 - 5;
                textY = padding + svgH / 2;
                textRot = -90;
                break;
              case "East":
                rx = padding + svgW + 5;
                ry = padding;
                rw = roadSize;
                rh = svgH;
                textX = padding + svgW + roadSize / 2 + 5;
                textY = padding + svgH / 2;
                textRot = 90;
                break;
            }

            return (
              <g>
                {/* Road block */}
                <rect x={rx} y={ry} width={rw} height={rh} fill="#4c566a" rx={3} opacity={0.15} />
                {/* Center dashes */}
                {roadFacing === "North" || roadFacing === "South" ? (
                  <line x1={rx + 10} y1={ry + rh / 2} x2={rx + rw - 10} y2={ry + rh / 2} stroke="#4c566a" strokeWidth={1} strokeDasharray="6,6" opacity={0.4} />
                ) : (
                  <line x1={rx + rw / 2} y1={ry + 10} x2={rx + rw / 2} y2={ry + rh - 10} stroke="#4c566a" strokeWidth={1} strokeDasharray="6,6" opacity={0.4} />
                )}
                {/* Road Text */}
                <text
                  x={textX}
                  y={textY}
                  transform={textRot !== 0 ? `rotate(${textRot}, ${textX}, ${textY})` : undefined}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#4c566a"
                  fontSize={8}
                  fontWeight="bold"
                  className="font-sans tracking-widest uppercase opacity-75"
                >
                  🚘 FRONT ROAD
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* AI Design Explanation */}
      <div className="mt-5 p-4 bg-white border border-[#eeeada] rounded-xl">
        <h3 className="text-xs font-semibold text-[#8892b0] uppercase tracking-wider mb-1">Architect's Explanation</h3>
        <p className="text-sm text-[#2c3539] leading-relaxed italic">{explanation}</p>
      </div>
    </div>
  );
}
