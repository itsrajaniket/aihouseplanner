import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { PlotInputs, FloorPlan } from "@/lib/types";
import { generateLocalLayout, generateLocalUpperFloorLayout } from "@/lib/generator";
import { validateFloorPlan } from "@/lib/validator";

export async function POST(req: NextRequest) {
  let inputs: PlotInputs | null = null;
  try {
    inputs = await req.json();
    if (!inputs) {
      return NextResponse.json({ success: false, error: "Missing inputs" }, { status: 400 });
    }
    console.log("BACKEND POST /api/generate - RECEIVED INPUTS:", inputs);
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
      engine = "procedural",
      
      // Multi-floor options
      floors = 1,
      familyType = "nuclear",
      kitchenType = "closed",
      servantQuarters = false,

      // Upper floor specific options
      floor = 0,
      staircase
    } = inputs as any;

    // Check if we want to run procedurally or if API key is missing
    const apiKey = process.env.GEMINI_API_KEY;
    if (engine === "procedural" || !apiKey) {
      console.log("Running local procedural generator (Engine mode or missing API key).");
      const fallbackLayout = floor === 0
        ? generateLocalLayout(inputs)
        : generateLocalUpperFloorLayout(inputs, floor, staircase);
      return NextResponse.json({
        success: true,
        layout: fallbackLayout,
        mode: !apiKey ? "fallback-no-key" : "procedural"
      });
    }

    // Initialize Gemini API
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            floor: { type: SchemaType.NUMBER },
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
            "floor",
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

    let systemPrompt = "";
    let userPrompt = "";

    if (floor === 0) {
      systemPrompt = `You are an expert Indian residential architect and Vastu Shastra consultant.
Your job is to arrange rooms on a residential plot and return the layout in a strict JSON schema.

Given a plot of size: ${lengthFt} ft (length, X-axis) by ${breadthFt} ft (breadth, Y-axis).
Orientation: ${orientation} (the top edge of the plot points in this direction).
Front Road Side: ${roadFacing} (road runs along this edge).

- Usable space: Apply a 1.5 ft margin around the entire boundary for ventilation/access. All rooms must fit inside this. Exception: If the plot width (X-axis length) is 22 ft or less, apply a 0.5 ft margin instead of 1.5 ft to allow realistic room sizes.
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

- Narrow Plot Guidelines (width <= 22 ft):
  * Do NOT split the width into 3 columns, as it makes rooms too narrow. Instead, arrange rooms in rows along the length (Y-axis), and split each row horizontally into 2 columns (left and right) if needed.
  * Recommended layout pattern for a 2-bedroom vertical plot (like 20x40):
    - Back row (top): Master Bedroom on the left (SW) and Kitchen on the right (SE).
    - Middle row: Bathrooms/WCs aligned along the left wall, and a spacious Drawing/Living Room in the center/right.
    - Lower row: Bedroom 2 on the left, and entrance/parking lobby on the right.
    - Bottom row: Staircase on the bottom-left corner and Car Parking on the bottom-right corner.

- Road Facing & Plot Entrance Alignment (CRITICAL):
  * The front road is on the ${roadFacing} side.
  * You MUST place the Parking/Porch (if active) and the Living Room directly adjacent to the road side (the ${roadFacing} edge).
  * You MUST place the Main Door (entrance to the Living Room) on the wall of the Living Room that directly faces the road:
    - If roadFacing is "North", the Main Door must be on the 'top' wall.
    - If roadFacing is "South", the Main Door must be on the 'bottom' wall.
    - If roadFacing is "East", the Main Door must be on the 'right' wall.
    - If roadFacing is "West", the Main Door must be on the 'left' wall.
  * Place bedrooms and other private zones towards the back of the house (opposite the road facing side) for noise isolation and privacy.

Output Rules:
1. All coordinates (x, y) and dimensions (width, height) must be in FEET.
2. Rooms must NOT overlap. Every room must have a unique position.
3. The sum of room widths and heights along any row/column must not exceed the plot dimensions.
4. Provide door positions: a door is a gap placed along a specific room wall ('top', 'bottom', 'left', 'right') at a 'position' (feet from the room's start coordinate).
5. Provide a fixed staircase block of size 4 ft x 9 ft.
6. Provide a short 3-sentence architectural explanation detailing why the rooms are arranged this way in style '${style}'.

Return ONLY the JSON matching the schema.`;

      userPrompt = `Generate the ground floor plan (floor: 0) for plot size: ${lengthFt}x${breadthFt} ft.`;
    } else {
      const stairStr = staircase
        ? `x: ${staircase.x}, y: ${staircase.y}, width: ${staircase.width}, height: ${staircase.height}`
        : "x: 24, y: 15, width: 4, height: 9";

      systemPrompt = `You are an expert Indian residential architect and Vastu Shastra consultant.
Your job is to arrange rooms on the UPPER FLOOR (Floor ${floor}) of a residential building and return the layout in a strict JSON schema.

Given a plot of size: ${lengthFt} ft (length, X-axis) by ${breadthFt} ft (breadth, Y-axis).
Orientation: ${orientation}.
Front Road Side: ${roadFacing}.

The staircase position is FIXED and cannot move because it must align with the ground floor:
* Staircase Coordinates: ${stairStr}
* You MUST place the staircase room at EXACTLY these coordinates: x = ${staircase?.x ?? 24}, y = ${staircase?.y ?? 15}, width = ${staircase?.width ?? 4}, height = ${staircase?.height ?? 9}. Its ID must be "staircase" and its label must be "Staircase".

Configure the upper floor layout based on these constraints:
- Usable space: Apply a 1.5 ft margin around the entire boundary. Exception: If the plot width is 22 ft or less, apply a 0.5 ft margin instead.
- Bedrooms: Up to ${bedrooms} bedrooms on this floor (e.g. Master Bedroom, Bedroom 2, Guest Bedroom).
- Bathrooms: Up to ${bathrooms} bathrooms on this floor.
- No ground-floor parking or kitchen on this upper floor. Instead, allocate open space for an Open Terrace or Balcony, especially overlooking the road facing side.
- Include a Family Lounge or lobby near the top of the staircase.
- Vastu Rules: ${vastu}
  If Vastu is true, prioritize:
  * Master Bedroom in the South-West corner.
  * Bathrooms in the West or North-West.
  * Balcony / Terrace on the North or East sides.

- Narrow Plot Guidelines (width <= 22 ft):
  * For upper floors on a narrow plot, maintain the same structural rows. Do not shift the staircase.
  * Map the ground floor parking to an Open Terrace or Balcony, and ground floor kitchen/living spaces to Guest Bedrooms, Study, or Family Lounge.

Output Rules:
1. All coordinates (x, y) and dimensions (width, height) must be in FEET.
2. Rooms must NOT overlap.
3. Provide door and window positions.
4. Keep the staircase coordinates EXACTLY as specified. Do not shift it by even 0.1 ft.
5. Provide a short 3-sentence architectural explanation detailing why the upper floor rooms are arranged this way in style '${style}'.

Return ONLY the JSON matching the schema.`;

      userPrompt = `Generate the Floor ${floor} plan for plot size: ${lengthFt}x${breadthFt} ft with staircase fixed at ${stairStr}.`;
    }

    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
      ]
    });

    const responseText = result.response.text();
    const parsedLayout: FloorPlan = JSON.parse(responseText);
    parsedLayout.floor = floor; // Ensure floor number matches requested

    // Safeguard: Ensure staircase is in rooms list for rendering if it was only output as staircase object
    if (parsedLayout.staircase && parsedLayout.staircase.width > 0 && parsedLayout.staircase.height > 0) {
      if (!parsedLayout.rooms) {
        parsedLayout.rooms = [];
      }
      if (!parsedLayout.rooms.some(r => r.id === "staircase")) {
        parsedLayout.rooms.push({
          id: "staircase",
          label: "Staircase",
          x: parsedLayout.staircase.x,
          y: parsedLayout.staircase.y,
          width: parsedLayout.staircase.width,
          height: parsedLayout.staircase.height
        });
      }
    }

    // Safeguard: Ensure doors and windows are defined as arrays
    if (!parsedLayout.doors) parsedLayout.doors = [];
    if (!parsedLayout.windows) parsedLayout.windows = [];

    // Validate the layout before responding
    if (validateFloorPlan(parsedLayout)) {
      return NextResponse.json({
        success: true,
        layout: parsedLayout,
        mode: "ai"
      });
    } else {
      console.warn("Gemini layout failed validation. Falling back to local engine.");
      const fallbackLayout = floor === 0
        ? generateLocalLayout(inputs!)
        : generateLocalUpperFloorLayout(inputs!, floor, staircase);
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
      const safeInputs: PlotInputs = inputs || {
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
        engine: "procedural"
      };
      
      const reqFloor = inputs ? (inputs as any).floor : 0;
      const reqStaircase = inputs ? (inputs as any).staircase : undefined;

      const fallbackLayout = reqFloor === 0
        ? generateLocalLayout(safeInputs)
        : generateLocalUpperFloorLayout(safeInputs, reqFloor, reqStaircase);
        
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

