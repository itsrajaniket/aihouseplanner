import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { PlotInputs, FloorPlan } from "@/lib/types";
import { generateLocalLayout } from "@/lib/generator";
import { validateFloorPlan } from "@/lib/validator";

export async function POST(req: NextRequest) {
  try {
    const inputs: PlotInputs = await req.json();
    const {
      lengthFt,
      breadthFt,
      orientation = "North",
      roadFacing = "North",
      bedrooms = 2,
      bathrooms = 2,
      parking = false,
      garden = false,
      poojaRoom = false,
      vastu = false,
      style = "modern",
      engine = "procedural"
    } = inputs;

    // Check if we want to run procedurally or if API key is missing
    const apiKey = process.env.GEMINI_API_KEY;
    if (engine === "procedural" || !apiKey) {
      console.log("Running local procedural generator (Engine mode or missing API key).");
      const fallbackLayout = generateLocalLayout(inputs);
      return NextResponse.json({
        success: true,
        layout: fallbackLayout,
        mode: !apiKey ? "fallback-no-key" : "procedural"
      });
    }

    // Initialize Gemini API
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            plotLength: { type: SchemaType.NUMBER },
            plotBreadth: { type: SchemaType.NUMBER },
            rooms: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  id: { type: SchemaType.STRING },
                  label: { type: SchemaType.STRING },
                  x: { type: SchemaType.NUMBER },
                  y: { type: SchemaType.NUMBER },
                  width: { type: SchemaType.NUMBER },
                  height: { type: SchemaType.NUMBER }
                },
                required: ["id", "label", "x", "y", "width", "height"]
              }
            },
            doors: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  room: { type: SchemaType.STRING },
                  wall: { type: SchemaType.STRING },
                  position: { type: SchemaType.NUMBER },
                  width: { type: SchemaType.NUMBER }
                },
                required: ["room", "wall", "position", "width"]
              }
            },
            windows: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  room: { type: SchemaType.STRING },
                  wall: { type: SchemaType.STRING },
                  position: { type: SchemaType.NUMBER },
                  width: { type: SchemaType.NUMBER }
                },
                required: ["room", "wall", "position", "width"]
              }
            },
            staircase: {
              type: SchemaType.OBJECT,
              properties: {
                x: { type: SchemaType.NUMBER },
                y: { type: SchemaType.NUMBER },
                width: { type: SchemaType.NUMBER },
                height: { type: SchemaType.NUMBER }
              },
              required: ["x", "y", "width", "height"]
            },
            explanation: { type: SchemaType.STRING }
          },
          required: [
            "plotLength",
            "plotBreadth",
            "rooms",
            "doors",
            "windows",
            "staircase",
            "explanation"
          ]
        }
      }
    });

    const systemPrompt = `You are an expert Indian residential architect and Vastu Shastra consultant.
Your job is to arrange rooms on a residential plot and return the layout in a strict JSON schema.

Given a plot of size: ${lengthFt} ft (length, X-axis) by ${breadthFt} ft (breadth, Y-axis).
Orientation: ${orientation} (the top edge of the plot points in this direction).
Front Road Side: ${roadFacing} (road runs along this edge).

Configure the layout based on these constraints:
- Usable space: Apply a 1.5 ft margin around the entire boundary for ventilation/access. All rooms must fit inside this.
- Bedrooms: ${bedrooms}
- Bathrooms: ${bathrooms}
- Parking: ${parking}
- Garden: ${garden}
- Pooja Room: ${poojaRoom}
- Vastu Rules: ${vastu}
  If Vastu is true, prioritize:
  * Pooja room in the North-East corner.
  * Kitchen in the South-East corner.
  * Master Bedroom in the South-West corner.
  * Main entrance in the North, East, or North-East.
  * Staircase in the South or West (avoiding the center / Brahmastan).

Output Rules:
1. All coordinates (x, y) and dimensions (width, height) must be in FEET.
2. Rooms must NOT overlap. Every room must have a unique position.
3. The sum of room widths and heights along any row/column must not exceed the plot dimensions.
4. Provide door positions: a door is a gap placed along a specific room wall ('top', 'bottom', 'left', 'right') at a 'position' (feet from the room's start coordinate).
5. Provide a fixed staircase block of size 4 ft x 9 ft.
6. Provide a short 3-sentence architectural explanation detailing why the rooms are arranged this way in style '${style}'.

Return ONLY the JSON matching the schema.`;

    const userPrompt = `Generate the ground floor plan for plot size: ${lengthFt}x${breadthFt} ft.`;

    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
      ]
    });

    const responseText = result.response.text();
    const parsedLayout: FloorPlan = JSON.parse(responseText);

    // Validate the layout before responding
    if (validateFloorPlan(parsedLayout)) {
      return NextResponse.json({
        success: true,
        layout: parsedLayout,
        mode: "ai"
      });
    } else {
      console.warn("Gemini layout failed validation. Falling back to local engine.");
      const fallbackLayout = generateLocalLayout(inputs);
      return NextResponse.json({
        success: true,
        layout: {
          ...fallbackLayout,
          explanation: `[AI generated plan had overlapping rooms, showing fallback layout] ${fallbackLayout.explanation}`
        },
        mode: "fallback-validation"
      });
    }
  } catch (error: any) {
    console.error("Error generating floor plan via Gemini API:", error);
    
    // In case of error (e.g. timeout, invalid key, rate limit), return fallback layout so user is never stuck
    try {
      const inputs: PlotInputs = await req.json();
      const fallbackLayout = generateLocalLayout(inputs);
      return NextResponse.json({
        success: true,
        layout: {
          ...fallbackLayout,
          explanation: `[API Error, showing fallback layout] ${fallbackLayout.explanation}`
        },
        mode: "fallback-error"
      });
    } catch (innerError) {
      return NextResponse.json(
        { success: false, error: "Critical error in backend layout engine." },
        { status: 500 }
      );
    }
  }
}
