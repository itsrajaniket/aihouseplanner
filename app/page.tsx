"use client";

import React, { useState, useEffect } from "react";
import InputForm from "@/components/InputForm";
import FloorPlanCanvas from "@/components/FloorPlanCanvas";
import { PlotInputs, FloorPlan } from "@/lib/types";
import { generateLocalLayout } from "@/lib/generator";
import { Sparkles, HelpCircle, HardHat, Compass } from "lucide-react";

export default function Home() {
  const [floors, setFloors] = useState<(FloorPlan | null)[]>([null, null, null]);
  const [activeFloor, setActiveFloor] = useState<number>(0);
  const [lockedEngine, setLockedEngine] = useState<"ai" | "procedural" | null>(null);

  const [inputs, setInputs] = useState<PlotInputs>({
    lengthFt: 30,
    breadthFt: 40,
    orientation: "North",
    roadFacing: "North",
    bedrooms: 2,
    bathrooms: 2,
    parking: true,
    garden: false,
    poojaRoom: true,
    vastu: true,
    style: "modern",
    engine: "procedural",
    floors: 1,
    familyType: "nuclear",
    kitchenType: "closed",
    servantQuarters: false,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [generationInfo, setGenerationInfo] = useState<string>("");

  // Load a default layout on mount so the user has something visual immediately
  useEffect(() => {
    const defaultLayout = generateLocalLayout(inputs);
    setFloors([defaultLayout, null, null]);
    setGenerationInfo("Initialized with local instant layout rules.");
  }, []);

  const handleGenerate = async (newInputs: PlotInputs) => {
    setIsLoading(true);
    setInputs(newInputs);
    setActiveFloor(0);
    setLockedEngine(null);
    setFloors([null, null, null]);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newInputs, floor: 0 }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate layout");
      }

      const data = await response.json();
      if (data.success && data.layout) {
        const genEngine = data.mode === "ai" ? "ai" : "procedural";
        setLockedEngine(genEngine);
        setFloors([data.layout, null, null]);
        
        // Custom message based on how it was generated
        if (data.mode === "ai") {
          setGenerationInfo("Layout designed by Gemini 1.5 Flash API.");
        } else if (data.mode === "fallback-no-key") {
          setGenerationInfo("API key missing. Rendered using local architectural rules.");
        } else if (data.mode === "fallback-validation") {
          setGenerationInfo("Gemini response was invalid. Rendered clean local layout instead.");
        } else if (data.mode === "fallback-error") {
          setGenerationInfo("Gemini API error. Rendered clean local layout instead.");
        } else {
          setGenerationInfo("Rendered using local instant layout rules.");
        }
      } else {
        throw new Error(data.error || "Unknown error occurred");
      }
    } catch (error) {
      console.error("Error generating design plan:", error);
      // Fallback locally instantly on error
      const fallbackLayout = generateLocalLayout(newInputs);
      setLockedEngine("procedural");
      setFloors([fallbackLayout, null, null]);
      setGenerationInfo("API request failed. Rendered local layout instead.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFloorTabChange = async (floorNum: number) => {
    if (floors[floorNum] !== null) {
      setActiveFloor(floorNum);
      return;
    }

    setIsLoading(true);
    try {
      const groundFloor = floors[0];
      if (!groundFloor) {
        throw new Error("Ground floor must be generated first.");
      }
      
      const staircase = groundFloor.staircase && groundFloor.staircase.width > 0
        ? groundFloor.staircase
        : groundFloor.rooms.find(r => r.id === "staircase");

      if (!staircase) {
        throw new Error("Could not detect staircase position from Ground Floor.");
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...inputs,
          engine: lockedEngine || inputs.engine,
          floor: floorNum,
          staircase: {
            x: staircase.x,
            y: staircase.y,
            width: staircase.width,
            height: staircase.height
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate floor ${floorNum}`);
      }

      const data = await response.json();
      if (data.success && data.layout) {
        setFloors(prev => {
          const updated = [...prev];
          updated[floorNum] = data.layout;
          return updated;
        });
        setActiveFloor(floorNum);
        
        if (data.mode === "ai") {
          setGenerationInfo(`Floor ${floorNum} designed by Gemini 1.5 Flash API.`);
        } else {
          setGenerationInfo(`Floor ${floorNum} rendered using local layout rules.`);
        }
      } else {
        throw new Error(data.error || "Unknown error occurred");
      }
    } catch (error) {
      console.error(`Error generating floor ${floorNum}:`, error);
      
      // Procedural fallback
      const groundFloor = floors[0];
      if (groundFloor) {
        const staircase = groundFloor.staircase && groundFloor.staircase.width > 0
          ? groundFloor.staircase
          : groundFloor.rooms.find(r => r.id === "staircase") || { x: 24, y: 15, width: 4, height: 9 };
          
        const { generateLocalUpperFloorLayout } = await import("@/lib/generator");
        const fallbackLayout = generateLocalUpperFloorLayout(
          { ...inputs, engine: "procedural" },
          floorNum,
          staircase
        );
        
        setFloors(prev => {
          const updated = [...prev];
          updated[floorNum] = fallbackLayout;
          return updated;
        });
        setActiveFloor(floorNum);
        setGenerationInfo(`API request failed. Rendered local layout for Floor ${floorNum} instead.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const layout = floors[activeFloor];

  return (
    <div className="flex-1 lg:h-screen bg-[#fcfbf7] text-[#2c3539] flex flex-col font-sans lg:overflow-hidden">
      {/* Top Banner Navigation */}
      <header className="border-b border-[#e0dbcd] bg-white shadow-xs z-20">
        <div className="max-w-[1440px] mx-auto w-full py-1.5 px-6 md:px-12 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-[#2c3539] p-1 rounded-md text-[#fdfbf7]">
              <HardHat className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm md:text-base font-outfit tracking-tight text-[#2c3539] flex items-center gap-1.5">
                AI House Map Planner
                <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wider shadow-sm">V1</span>
              </h1>
              <p className="text-[9px] md:text-[10px] text-[#8892b0] font-medium leading-none mt-0.5">Instant Architectural Blueprint Visualizer</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-xs font-semibold text-[#8892b0] hidden sm:flex">
            <span className="flex items-center gap-1.5 bg-[#fcfbf7] px-2.5 py-1 rounded-md border border-[#eeeada]">
              <Compass className="w-3.5 h-3.5 text-[#2c3539]" /> Proportional Drafts
            </span>
            <span className="flex items-center gap-1.5 bg-[#fcfbf7] px-2.5 py-1 rounded-md border border-[#eeeada]">
              <span className="text-[#2c3539]">🌿</span> Vastu Compliant Options
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 relative lg:min-h-0 lg:overflow-hidden flex justify-center w-full">
        <main className="lg:absolute lg:inset-0 flex flex-col lg:flex-row gap-6 p-4 md:p-6 lg:p-6 max-w-[1440px] mx-auto w-full">
          {/* Left Side: Form */}
        <section className="w-full lg:w-[380px] xl:w-[420px] shrink-0 lg:overflow-y-auto lg:pr-2 pb-4 lg:pb-0 custom-scrollbar lg:min-h-0">
          <InputForm onSubmit={handleGenerate} isLoading={isLoading} lockedEngine={lockedEngine} />
        </section>

        {/* Right Side: Visual SVG & Metadata */}
        <section className="flex-1 flex flex-col gap-4 lg:min-h-0 lg:overflow-hidden">
          {layout ? (
            <>
              {/* Generation Indicator Badge */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 px-4 py-2.5 bg-white border border-[#e0dbcd] rounded-xl text-xs font-semibold text-[#4c566a]">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                  Engine: <strong className="text-[#2c3539]">{generationInfo}</strong>
                </span>
                <span className="text-stone-400 font-mono">
                  Plot: {layout.plotLength}' x {layout.plotBreadth}' ({layout.plotLength * layout.plotBreadth} sqft)
                </span>
              </div>

              {/* Floor Switcher Tabs (Rendered only if inputs.floors > 1) */}
              {inputs.floors && inputs.floors > 1 && (
                <div className="flex bg-[#f2efe6] p-1 rounded-xl gap-1 border border-[#e0dbcd] self-start">
                  {Array.from({ length: inputs.floors }).map((_, idx) => (
                    <button
                      key={idx}
                      disabled={isLoading}
                      onClick={() => handleFloorTabChange(idx)}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-250 flex items-center gap-1.5 cursor-pointer ${
                        activeFloor === idx
                          ? "bg-[#2c3539] text-[#fdfbf7] shadow-sm"
                          : "text-[#8892b0] hover:text-[#2c3539]"
                      }`}
                    >
                      {idx === 0 ? "🏢 Ground Floor" : idx === 1 ? "🏢 First Floor" : "🏢 Second Floor"}
                      {floors[idx] === null && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Not generated yet" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Main SVG Floor Plan */}
              <FloorPlanCanvas
                layout={layout}
                orientation={inputs.orientation}
                roadFacing={inputs.roadFacing}
                activeFloor={activeFloor}
              />
            </>
          ) : (
            <div 
              className="flex-1 flex flex-col items-center justify-center bg-[#fdfbf7] border border-[#e0dbcd] rounded-2xl p-12 text-center overflow-hidden relative shadow-inner"
              style={{
                backgroundImage: 'radial-gradient(#d5d1c3 1px, transparent 1px)',
                backgroundSize: '24px 24px'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
              <div className="bg-white/90 p-6 rounded-2xl backdrop-blur-sm border border-[#e0dbcd] shadow-sm flex flex-col items-center relative z-10">
                <svg className="animate-spin h-8 w-8 text-[#2c3539] mb-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <h3 className="font-bold text-[#2c3539] font-outfit text-lg">Preparing Canvas</h3>
                <p className="text-xs text-[#8892b0] mt-1 max-w-[200px]">Sizing grid paper and configuring layouts...</p>
              </div>
            </div>
          )}
        </section>
        </main>
      </div>
    </div>
  );
}

