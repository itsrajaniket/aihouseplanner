"use client";

import React, { useState } from "react";
import { PlotInputs } from "@/lib/types";
import { ChevronDown, ChevronUp, Sparkles, Zap, Sliders, MapPin } from "lucide-react";

interface InputFormProps {
  onSubmit: (inputs: PlotInputs) => void;
  isLoading: boolean;
  lockedEngine: "ai" | "procedural" | null;
}

export default function InputForm({ onSubmit, isLoading, lockedEngine }: InputFormProps) {
  const [lengthFt, setLengthFt] = useState<number>(30);
  const [breadthFt, setBreadthFt] = useState<number>(40);
  const [orientation, setOrientation] = useState<string>("North");
  const [roadFacing, setRoadFacing] = useState<string>("North");
  
  // Customization section toggle
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Customizations
  const [bedrooms, setBedrooms] = useState<number>(2);
  const [bathrooms, setBathrooms] = useState<number>(2);
  const [parking, setParking] = useState(true);
  const [garden, setGarden] = useState(false);
  const [poojaRoom, setPoojaRoom] = useState(true);
  const [vastu, setVastu] = useState(true);
  const [style, setStyle] = useState<"modern" | "traditional" | "minimalist">("modern");
  const [engine, setEngine] = useState<"ai" | "procedural">("procedural");

  // New customizations
  const [floors, setFloors] = useState<number>(1);
  const [familyType, setFamilyType] = useState<"nuclear" | "joint">("nuclear");
  const [kitchenType, setKitchenType] = useState<"open" | "closed">("closed");
  const [servantQuarters, setServantQuarters] = useState(false);

  // Sync engine when session locked
  React.useEffect(() => {
    if (lockedEngine) {
      setEngine(lockedEngine);
    }
  }, [lockedEngine]);

  // Standard Indian Plot presets
  const presets = [
    { label: "20 x 30 (Small)", w: 20, h: 30 },
    { label: "20 x 40 (Narrow)", w: 20, h: 40 },
    { label: "30 x 40 (Standard)", w: 30, h: 40 },
    { label: "30 x 50 (Spacious)", w: 30, h: 50 },
    { label: "40 x 60 (Large)", w: 40, h: 60 },
  ];

  const applyPreset = (w: number, h: number) => {
    setLengthFt(w);
    setBreadthFt(h);
    const area = w * h;
    if (area < 800) setBedrooms(1);
    else if (area < 1400) setBedrooms(2);
    else if (area < 2000) setBedrooms(3);
    else setBedrooms(3);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      lengthFt,
      breadthFt,
      orientation: orientation as any,
      roadFacing: roadFacing as any,
      bedrooms,
      bathrooms,
      parking,
      garden,
      poojaRoom,
      vastu,
      style,
      engine: lockedEngine || engine,
      floors,
      familyType,
      kitchenType,
      servantQuarters,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 bg-white border border-[#e0dbcd] p-6 rounded-2xl shadow-sm h-full">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-[#2c3539] font-outfit">Plot & House Settings</h2>
        <p className="text-xs text-[#8892b0] mt-1">Configure your layout. AI will map the rooms proportionally.</p>
      </div>

      {/* Preset Site Sizes */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-[#2c3539] uppercase tracking-wider">Indian Plot Presets (ft)</label>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((p, idx) => {
            const isActive = p.w === lengthFt && p.h === breadthFt;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => applyPreset(p.w, p.h)}
                className={`px-3 py-2 text-xs border rounded-xl font-medium transition-all ${
                  isActive 
                    ? "bg-[#2c3539] text-white border-[#2c3539]" 
                    : "border-[#e0dbcd] hover:border-[#2c3539] hover:bg-[#fdfbf7] text-[#2c3539]"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Required Dimensions */}
      <div className="flex flex-col gap-4">
        {/* Width Slider / Input */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-[#2c3539]">Plot Width (Feet)</span>
            <input
              type="number"
              min={15}
              max={100}
              value={lengthFt}
              onChange={(e) => setLengthFt(Math.max(15, Math.min(100, Number(e.target.value))))}
              className="w-16 text-right font-mono text-sm font-bold border-b border-[#e0dbcd] focus:border-[#2c3539] outline-none text-[#2c3539]"
            />
          </div>
          <input
            type="range"
            min={15}
            max={80}
            value={lengthFt}
            onChange={(e) => setLengthFt(Number(e.target.value))}
            className="w-full accent-[#2c3539] h-1 bg-[#eeeada] rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Height Slider / Input */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-[#2c3539]">Plot Depth (Feet)</span>
            <input
              type="number"
              min={15}
              max={100}
              value={breadthFt}
              onChange={(e) => setBreadthFt(Math.max(15, Math.min(100, Number(e.target.value))))}
              className="w-16 text-right font-mono text-sm font-bold border-b border-[#e0dbcd] focus:border-[#2c3539] outline-none text-[#2c3539]"
            />
          </div>
          <input
            type="range"
            min={15}
            max={80}
            value={breadthFt}
            onChange={(e) => setBreadthFt(Number(e.target.value))}
            className="w-full accent-[#2c3539] h-1 bg-[#eeeada] rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      {/* Orientation & Road Access Side */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#2c3539] uppercase tracking-wider">Plot Orientation</label>
          <select
            value={orientation}
            onChange={(e) => setOrientation(e.target.value)}
            className="w-full bg-[#fcfbf7] border border-[#e0dbcd] rounded-xl px-3 py-2 text-xs font-medium text-[#2c3539] outline-none focus:border-[#2c3539] cursor-pointer"
          >
            <option value="North">North Facing</option>
            <option value="East">East Facing</option>
            <option value="South">South Facing</option>
            <option value="West">West Facing</option>
            <option value="Northeast">Northeast Facing</option>
            <option value="Southeast">Southeast Facing</option>
            <option value="Southwest">Southwest Facing</option>
            <option value="Northwest">Northwest Facing</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[#2c3539] uppercase tracking-wider">Road Access Side</label>
          <select
            value={roadFacing}
            onChange={(e) => setRoadFacing(e.target.value)}
            className="w-full bg-[#fcfbf7] border border-[#e0dbcd] rounded-xl px-3 py-2 text-xs font-medium text-[#2c3539] outline-none focus:border-[#2c3539] cursor-pointer"
          >
            <option value="North">North Side</option>
            <option value="East">East Side</option>
            <option value="South">South Side</option>
            <option value="West">West Side</option>
          </select>
        </div>
      </div>

      {/* Engine selection (AI vs Procedural) */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-[#2c3539] uppercase tracking-wider">Design Engine</label>
        <div className="grid grid-cols-2 gap-2 bg-[#fcfbf7] p-1 rounded-xl border border-[#e0dbcd]">
          <button
            type="button"
            disabled={lockedEngine !== null}
            onClick={() => setEngine("procedural")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              lockedEngine !== null ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
            } ${
              engine === "procedural"
                ? "bg-white shadow-sm text-[#2c3539] border border-[#e0dbcd]"
                : "text-[#8892b0] hover:text-[#2c3539]"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Instant Rules
          </button>
          <button
            type="button"
            disabled={lockedEngine !== null}
            onClick={() => setEngine("ai")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              lockedEngine !== null ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
            } ${
              engine === "ai"
                ? "bg-white shadow-sm text-[#2c3539] border border-[#e0dbcd]"
                : "text-[#8892b0] hover:text-[#2c3539]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Gemini AI
          </button>
        </div>
        {lockedEngine && (
          <p className="text-[10px] text-stone-500 leading-normal">
            Design engine is locked to <strong>{lockedEngine === "ai" ? "Gemini AI" : "Instant Rules"}</strong> for this multi-floor project.
          </p>
        )}
        {lockedEngine && (
          <p className="text-[10px] text-amber-600 font-medium mt-1">
            ⚠️ Engine locked to {lockedEngine === "ai" ? "Gemini AI" : "Instant Rules"} for this session. Regenerate to change.
          </p>
        )}
        {!lockedEngine && engine === "ai" && (
          <p className="text-[10px] text-amber-600 leading-normal">
            Note: Gemini AI requires a <strong>GEMINI_API_KEY</strong> environment variable. If missing, it will safely auto-fallback to procedural.
          </p>
        )}
      </div>

      {/* Advanced Customizations Panel */}
      <div className="border-t border-[#e0dbcd] pt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex justify-between items-center w-full text-left font-semibold text-sm text-[#2c3539] font-outfit"
        >
          <span className="flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-[#8892b0]" />
            Customize Rooms & Style
          </span>
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAdvanced && (
          <div className="flex flex-col gap-4 mt-4 bg-[#fcfbf7] border border-[#eeeada] p-4 rounded-xl transition-all duration-300">
            {/* Floors count */}
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-[#2c3539]">Number of Floors</span>
              <div className="flex gap-1">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFloors(n)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold border flex items-center justify-center transition-all ${
                      floors === n
                        ? "bg-[#2c3539] border-[#2c3539] text-white"
                        : "border-[#e0dbcd] bg-white text-[#2c3539] hover:bg-[#fcfbf7]"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Bedrooms count */}
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-[#2c3539]">Bedrooms</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setBedrooms(n)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold border flex items-center justify-center transition-all ${
                      bedrooms === n
                        ? "bg-[#2c3539] border-[#2c3539] text-white"
                        : "border-[#e0dbcd] bg-white text-[#2c3539] hover:bg-[#fcfbf7]"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Bathrooms count */}
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-[#2c3539]">Bathrooms</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setBathrooms(n)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold border flex items-center justify-center transition-all ${
                      bathrooms === n
                        ? "bg-[#2c3539] border-[#2c3539] text-white"
                        : "border-[#e0dbcd] bg-white text-[#2c3539] hover:bg-[#fcfbf7]"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Family Type */}
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-[#2c3539]">Family Type</span>
              <div className="flex gap-1 bg-white p-0.5 rounded-lg border border-[#e0dbcd]">
                {(["nuclear", "joint"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFamilyType(type)}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold capitalize transition-all ${
                      familyType === type
                        ? "bg-[#2c3539] text-white"
                        : "text-[#2c3539] hover:bg-[#fcfbf7]"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Kitchen Type */}
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-[#2c3539]">Kitchen Type</span>
              <div className="flex gap-1 bg-white p-0.5 rounded-lg border border-[#e0dbcd]">
                {(["open", "closed"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setKitchenType(type)}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold capitalize transition-all ${
                      kitchenType === type
                        ? "bg-[#2c3539] text-white"
                        : "text-[#2c3539] hover:bg-[#fcfbf7]"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles (Vastu, Parking, Garden, Pooja, Servant) */}
            <div className="grid grid-cols-2 gap-3 border-t border-[#eeeada] pt-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={vastu}
                  onChange={(e) => setVastu(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#2c3539] cursor-pointer"
                />
                <span className="text-xs font-medium text-[#2c3539]">Apply Vastu</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={parking}
                  onChange={(e) => setParking(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#2c3539] cursor-pointer"
                />
                <span className="text-xs font-medium text-[#2c3539]">Car Parking</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={garden}
                  onChange={(e) => setGarden(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#2c3539] cursor-pointer"
                />
                <span className="text-xs font-medium text-[#2c3539]">Garden/Lawn</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={poojaRoom}
                  onChange={(e) => setPoojaRoom(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#2c3539] cursor-pointer"
                />
                <span className="text-xs font-medium text-[#2c3539]">Pooja Room</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none col-span-2">
                <input
                  type="checkbox"
                  checked={servantQuarters}
                  onChange={(e) => setServantQuarters(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#2c3539] cursor-pointer"
                />
                <span className="text-xs font-medium text-[#2c3539]">Servant Quarters</span>
              </label>
            </div>

            {/* Architectural Style */}
            <div className="flex flex-col gap-1.5 border-t border-[#eeeada] pt-3">
              <label className="text-xs font-semibold text-[#2c3539] uppercase tracking-wider">Architectural Style</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as any)}
                className="w-full bg-white border border-[#e0dbcd] rounded-xl px-3 py-1.5 text-xs font-medium text-[#2c3539] outline-none"
              >
                <option value="modern">Modern (Sleek layout)</option>
                <option value="traditional">Traditional (Indian Haveli-inspired)</option>
                <option value="minimalist">Minimalist (Efficient spaces)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full mt-auto py-3 bg-[#2c3539] hover:bg-[#1a2022] text-[#fdfbf7] font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Designing layout...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 text-amber-300" />
            Generate Design Plan 🪄
          </>
        )}
      </button>

      <div className="flex justify-center gap-4 mt-1">
        {[
          { icon: "⚡", label: "Instant" },
          { icon: "📐", label: "Proportional" },
          { icon: "🕉️", label: "Vastu-ready" },
        ].map((badge) => (
          <span key={badge.label} className="flex items-center gap-1 text-[10px] text-[#8892b0] font-medium">
            {badge.icon} {badge.label}
          </span>
        ))}
      </div>
    </form>
  );
}
