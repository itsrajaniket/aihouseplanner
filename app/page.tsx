"use client";

import React, { useState, useEffect } from "react";
import InputForm from "@/components/InputForm";
import FloorPlanCanvas from "@/components/FloorPlanCanvas";
import { PlotInputs, FloorPlan } from "@/lib/types";
import { generateLocalLayout } from "@/lib/generator";
import { Sparkles, HelpCircle, HardHat, Compass } from "lucide-react";

export default function Home() {
  const [layout, setLayout] = useState<FloorPlan | null>(null);
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
  });
  const [isLoading, setIsLoading] = useState(false);
  const [generationInfo, setGenerationInfo] = useState<string>("");

  // Load a default layout on mount so the user has something visual immediately
  useEffect(() => {
    const defaultLayout = generateLocalLayout(inputs);
    setLayout(defaultLayout);
    setGenerationInfo("Initialized with local instant layout rules.");
  }, []);

  const handleGenerate = async (newInputs: PlotInputs) => {
    setIsLoading(true);
    setInputs(newInputs);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newInputs),
      });

      if (!response.ok) {
        throw new Error("Failed to generate layout");
      }

      const data = await response.json();
      if (data.success && data.layout) {
        setLayout(data.layout);
        
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
      setLayout(fallbackLayout);
      setGenerationInfo("API request failed. Rendered local layout instead.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-[#fcfbf7] text-[#2c3539] flex flex-col font-sans">
      {/* Top Banner Navigation */}
      <header className="border-b border-[#e0dbcd] bg-white py-4 px-6 md:px-12 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3">
          <div className="bg-[#2c3539] p-2 rounded-xl text-[#fdfbf7]">
            <HardHat className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg md:text-xl font-outfit tracking-tight text-[#2c3539] flex items-center gap-1.5">
              AI House Map Planner
              <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-bold">V1</span>
            </h1>
            <p className="text-[10px] md:text-xs text-[#8892b0]">Instant Architectural Blueprint Visualizer</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-xs font-semibold text-[#8892b0] hidden sm:flex">
          <span className="flex items-center gap-1">
            <Compass className="w-3.5 h-3.5" /> Proportional Drafts
          </span>
          <span className="flex items-center gap-1">
            🌿 Vastu Compliant Options
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 md:p-8 lg:p-12 max-w-7xl mx-auto w-full">
        {/* Left Side: Form (4 cols on large screens) */}
        <section className="lg:col-span-4 h-fit">
          <InputForm onSubmit={handleGenerate} isLoading={isLoading} />
        </section>

        {/* Right Side: Visual SVG & Metadata (8 cols on large screens) */}
        <section className="lg:col-span-8 flex flex-col gap-4 h-full">
          {layout ? (
            <>
              {/* Generation Indicator Badge */}
              <div className="flex justify-between items-center px-4 py-2.5 bg-white border border-[#e0dbcd] rounded-xl text-xs font-semibold text-[#4c566a]">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                  Engine: <strong className="text-[#2c3539]">{generationInfo}</strong>
                </span>
                <span className="text-stone-400 font-mono">
                  Plot: {layout.plotLength}' x {layout.plotBreadth}' ({layout.plotLength * layout.plotBreadth} sqft)
                </span>
              </div>

              {/* Main SVG Floor Plan */}
              <div className="flex-1">
                <FloorPlanCanvas
                  layout={layout}
                  orientation={inputs.orientation}
                  roadFacing={inputs.roadFacing}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-white border border-dashed border-[#e0dbcd] rounded-2xl p-12 text-center">
              <svg className="animate-spin h-8 w-8 text-[#2c3539] mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <h3 className="font-bold text-[#2c3539] font-outfit">Preparing Canvas</h3>
              <p className="text-xs text-[#8892b0] mt-1">Sizing grid paper and configuring layouts...</p>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e0dbcd] bg-white py-6 px-6 text-center text-xs text-[#8892b0]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© {new Date().getFullYear()} AI House Map Planner. Built for Indian individual plot owners.</p>
          <p className="flex items-center gap-1 justify-center">
            <HelpCircle className="w-3.5 h-3.5" /> Purely for visualization. Not for immediate structural construction.
          </p>
        </div>
      </footer>
    </div>
  );
}
