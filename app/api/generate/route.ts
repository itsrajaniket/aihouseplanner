import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { PlotInputs, FloorPlan, Room } from "@/lib/types";
import { generateLocalLayout, generateLocalUpperFloorLayout } from "@/lib/generator";
import { validateFloorPlan } from "@/lib/validator";
import { solveLayout, LayoutNode, adjustTreeForFixedNode, generateDoorsAndWindows } from "@/lib/solver";

function snap(v: number): number {
  return Math.round(v * 2) / 2;
}

function parseAITree(aiNode: any): LayoutNode {
  if (!aiNode) {
    return { type: "room", id: "placeholder", label: "Open Space" };
  }

  if (aiNode.nodeType === "room") {
    return {
      type: "room",
      id: aiNode.roomId || "room",
      label: aiNode.roomLabel || "Room",
    };
  }

  if (!aiNode.children || !Array.isArray(aiNode.children) || aiNode.children.length === 0) {
    return {
      type: "room",
      id: aiNode.roomId || "room",
      label: aiNode.roomLabel || "Room",
    };
  }

  const direction = aiNode.direction === "horizontal" ? "horizontal" : "vertical";
  const ratio = typeof aiNode.ratio === "number" ? aiNode.ratio : 0.5;

  const child1 = parseAITree(aiNode.children[0]);
  const child2 = aiNode.children.length >= 2 
    ? parseAITree(aiNode.children[1]) 
    : parseAITree(aiNode.children[0]);

  return {
    type: "split",
    direction,
    ratio,
    children: [child1, child2],
  };
}

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
            layoutTree: {
              type: SchemaType.OBJECT,
              properties: {
                nodeType: { type: SchemaType.STRING }, // "split" or "room"
                direction: { type: SchemaType.STRING }, // "horizontal" or "vertical"
                ratio: { type: SchemaType.NUMBER },
                roomId: { type: SchemaType.STRING },
                roomLabel: { type: SchemaType.STRING },
                children: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      nodeType: { type: SchemaType.STRING },
                      direction: { type: SchemaType.STRING },
                      ratio: { type: SchemaType.NUMBER },
                      roomId: { type: SchemaType.STRING },
                      roomLabel: { type: SchemaType.STRING },
                      children: {
                        type: SchemaType.ARRAY,
                        items: {
                          type: SchemaType.OBJECT,
                          properties: {
                            nodeType: { type: SchemaType.STRING },
                            direction: { type: SchemaType.STRING },
                            ratio: { type: SchemaType.NUMBER },
                            roomId: { type: SchemaType.STRING },
                            roomLabel: { type: SchemaType.STRING },
                            children: {
                              type: SchemaType.ARRAY,
                              items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                  nodeType: { type: SchemaType.STRING },
                                  roomId: { type: SchemaType.STRING },
                                  roomLabel: { type: SchemaType.STRING }
                                },
                                required: ["nodeType", "roomId", "roomLabel"]
                              }
                            }
                          },
                          required: ["nodeType"]
                        }
                      }
                    },
                    required: ["nodeType"]
                  }
                }
              },
              required: ["nodeType"]
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
            "layoutTree",
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

    const S = lengthFt <= 22 ? 0.5 : 1.5;

    if (floor === 0) {
      systemPrompt = `You are an expert Indian residential architect and Vastu Shastra consultant.
Your job is to partition a residential plot logically and return the layout using a hierarchical slicing tree structure.

Given a plot of size: ${lengthFt} ft (length, X-axis) by ${breadthFt} ft (breadth, Y-axis).
Orientation: ${orientation} (the top edge of the plot points in this direction).
Front Road Side: ${roadFacing} (road runs along this edge).

Configure the layout based on these constraints:
- Usable space: Apply a setback margin S around the entire boundary:
  * S = ${S} ft (based on plot width).
  All rooms must fit inside the remaining usable space.
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

- STRICT ARCHITECTURAL & PLANNING RULES:
  1. Main entrance: must be on the road-facing side of the plot, roughly in the center third of the road-facing wall. Must open into living, hall, or foyer (never directly into bedroom or kitchen). At least 2-3 ft foyer/buffer between main door and bedroom doors.
  2. Adjacency: Kitchen and dining must be adjacent. Living room directly accessible from entrance without passing through other rooms. No bedroom accessible only by passing through another bedroom. Master bedroom must be private (not adjacent to entrance, not visible from living room entry). Bathroom must be adjacent/attached to a bedroom (no standalone bathroom without crossing public space on larger plots). Parking directly accessible from road.
  3. Light & Ventilation: Every bedroom and kitchen must have at least one external wall for windows. Living room must have external window.
  4. Staircase: Must be against a wall (never floating). Accessible from living room or common corridor (not through bedroom/kitchen). Not opposite main entrance. South or West side preferred, avoid North-East/center.
  5. Parking: Sized min 10x18 ft for a car. Fronts road directly.
  6. Kitchen: Never in North-East corner. Prefer South-East (Vastu). Must not face main entrance.
  7. Bathroom: Never in North-East corner. Must not share wall with pooja room.
  8. Pooja: Must be in North-East corner. No shared wall with bathroom. Accessible from living/corridor, not hidden in bedroom.
  9. Sizing & Ratios: Room length-to-width ratio must be better than 3:1 (e.g. 15x5 is invalid). No room > 35% of total area. Minimum sizes: Bedroom 9x10, Master Bed 11x12, Kitchen 7x9, Bath 4x6, Living 10x12, Staircase 3.5x8. If plot is too small, reduce room count (remove storeroom first, then extra bath, then pooja) and explain why in explanation.
  10. Circulation: If plot > 900 sqft, there must be a corridor (min 3.5 ft wide) connecting bedrooms to living (no direct opening of bedrooms into living room).

- Slicing Tree Partition Rules (CRITICAL):
  * You must NOT generate absolute coordinates for rooms.
  * Instead, divide the plot recursively using a binary slicing tree represented by \`layoutTree\`.
  * Node properties:
    - \`nodeType\`: "split" (for partition cuts) or "room" (for actual rooms).
    - \`direction\`: "vertical" (split top/bottom along Y-axis) or "horizontal" (split left/right along X-axis).
    - \`ratio\`: number between 0.1 and 0.9 (e.g. 0.3 means the first child occupies 30% of the dimension, the second child occupies 70%).
    - \`children\`: exactly 2 children nodes when nodeType is "split".
    - \`roomId\`: ID of the room (e.g. "bedroom-master", "kitchen", "bathroom-1", "bathroom-2", "living", "staircase", "parking", "pooja").
    - \`roomLabel\`: Display name (e.g. "Master Bedroom", "Kitchen").
  
  * Narrow Plot Layout Recommendation (width <= 22 ft):
    - Top row (Back): Split horizontally (ratio ~0.55) into Master Bedroom ("bedroom-master") and Kitchen ("kitchen").
    - Middle row: Split horizontally (ratio ~0.22) into WC/Bath column (left) and Drawing/Living ("living", right). Split WC/Bath column vertically into "bathroom-1" and "bathroom-2".
    - Lower row: Split horizontally (ratio ~0.55) into Bedroom 2 column (left) and Car Parking/Lobby (right). Split Bedroom 2 column vertically into "bedroom-2" and "staircase".
  
  * Standard Plot Layout:
    - Divide vertically into 3 main zones (Back, Middle, Front rows).
    - Divide each row horizontally into rooms.

Return ONLY the JSON matching the schema.`;

      userPrompt = `Generate the ground floor plan slicing tree (floor: 0) for plot size: ${lengthFt}x${breadthFt} ft.`;
    } else {
      const stairStr = staircase
        ? `x: ${staircase.x}, y: ${staircase.y}, width: ${staircase.width}, height: ${staircase.height}`
        : "x: 24, y: 15, width: 4, height: 9";

      systemPrompt = `You are an expert Indian residential architect and Vastu Shastra consultant.
Your job is to partition the UPPER FLOOR (Floor ${floor}) of a residential building using a hierarchical slicing tree structure.

Given a plot of size: ${lengthFt} ft (length, X-axis) by ${breadthFt} ft (breadth, Y-axis).
Orientation: ${orientation}.
Front Road Side: ${roadFacing}.

The staircase position is FIXED and cannot move because it must align with the ground floor:
* Staircase Coordinates: ${stairStr}
* You MUST place the staircase room at EXACTLY these coordinates in the final rendering.

Configure the upper floor layout:
- Usable space: Apply a setback margin S around the entire boundary:
  * S = ${S} ft.
- Bedrooms: Up to ${bedrooms} bedrooms on this floor.
- No ground-floor parking or kitchen on this upper floor. Instead, allocate open space for an Open Terrace or Balcony, especially overlooking the road facing side.
- Include a Family Lounge or lobby near the top of the staircase.
- STRICT ARCHITECTURAL & PLANNING RULES (Section 1-11):
  1. Adjacency: Living/Family room directly accessible from stairs. No bedroom accessible only by passing through another bedroom. Master bedroom must be private. Bathroom must be adjacent/attached to a bedroom.
  2. Light & Ventilation: Every bedroom must have at least one external wall for windows.
  3. Staircase: Must be in the tree, ensuring its size and location correspond to the ground floor setup: ${stairStr}.
  4. Sizing & Ratios: Room length-to-width ratio must be better than 3:1. Minimum sizes: Bedroom 9x10, Master Bed 11x12, Bath 4x6, Family Lounge 10x12.
  5. Circulation: Passages/lobbies must be at least 3.5 ft wide.

- Slicing Tree Partition Rules:
  - Generate the partition tree using \`layoutTree\` with split ratios.
  - Node properties: \`nodeType\`, \`direction\`, \`ratio\`, \`children\`, \`roomId\`, \`roomLabel\`.
  - Place "staircase" in the tree, ensuring its size and location correspond to the ground floor setup.

Return ONLY the JSON matching the schema.`;

      userPrompt = `Generate the Floor ${floor} plan slicing tree for plot size: ${lengthFt}x${breadthFt} ft with staircase fixed at ${stairStr}.`;
    }

    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
      ]
    });

    const responseText = result.response.text();
    const parsedLayout: any = JSON.parse(responseText);
    parsedLayout.floor = floor; // Ensure floor number matches requested

    // ─── SOLVE COORDINATES FROM THE TREE ───
    if (parsedLayout.layoutTree) {
      let parsedTree = parseAITree(parsedLayout.layoutTree);
      const uW = snap(lengthFt - 2 * S);
      const uH = snap(breadthFt - 2 * S);

      // Adjust the layout tree ratios recursively to lock staircase if upper floor
      if (floor > 0 && staircase && staircase.width > 0 && staircase.height > 0) {
        parsedTree = adjustTreeForFixedNode(
          parsedTree,
          S,
          S,
          uW,
          uH,
          "staircase",
          staircase.x,
          staircase.y,
          staircase.width,
          staircase.height,
          0.4
        );
      }

      const solvedRooms = solveLayout(parsedTree, S, S, uW, uH, 0.4);
      parsedLayout.rooms = solvedRooms;

      // Force staircase to match exact ground floor coordinates to eliminate small snapping errors
      if (floor > 0 && staircase && staircase.width > 0 && staircase.height > 0) {
        parsedLayout.rooms = parsedLayout.rooms.map((r: any) => {
          if (r.id === "staircase") {
            return {
              ...r,
              x: staircase.x,
              y: staircase.y,
              width: staircase.width,
              height: staircase.height
            };
          }
          return r;
        });
      }
    }

    // Safeguard: Ensure staircase is in rooms list for rendering if it was only output as staircase object
    if (parsedLayout.staircase && parsedLayout.staircase.width > 0 && parsedLayout.staircase.height > 0) {
      if (!parsedLayout.rooms) {
        parsedLayout.rooms = [];
      }
      if (!parsedLayout.rooms.some((r: any) => r.id === "staircase")) {
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

    // Geometrically place doors and windows to guarantee correctness
    if (parsedLayout.rooms && parsedLayout.rooms.length > 0) {
      const geoOpenings = generateDoorsAndWindows(
        parsedLayout.rooms,
        lengthFt,
        breadthFt,
        roadFacing || "North",
        vastu || false
      );
      parsedLayout.doors = geoOpenings.doors;
      parsedLayout.windows = geoOpenings.windows;
    } else {
      parsedLayout.doors = [];
      parsedLayout.windows = [];
    }

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
