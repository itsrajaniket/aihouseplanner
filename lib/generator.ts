import { PlotInputs, FloorPlan, Room, Door, Window } from "./types";
import { solveLayout, LayoutNode, generateDoorsAndWindows } from "./solver";

// Snap to nearest 0.5 ft
function snap(v: number): number {
  return Math.round(v * 2) / 2;
}

function checkGeometry(
  bedrooms: number,
  hasParking: boolean,
  hasGarden: boolean,
  W: number,
  H: number
): boolean {
  const S = W <= 22 ? 0.5 : 1.5;
  const uW = snap(W - 2 * S);
  const uH = snap(H - 2 * S);

  if (W <= 22) {
    // Narrow plot layout
    if (hasParking && uW - 10.0 < 9.7) {
      return false; // Living room width would be too small
    }

    const minBackH = 18.1;
    const minLeftFrontH = bedrooms >= 2 ? 21.1 : 11.7;
    const minRightFrontH = hasParking ? 18.2 : hasGarden ? 16.2 : 8.2;
    const minFrontH = Math.max(minLeftFrontH, minRightFrontH);

    if (uH - 3.5 < minBackH + minFrontH) {
      return false;
    }
    return true;
  } else {
    // Standard plot
    if (bedrooms === 1) {
      const backH = 12.2;
      const frontH = uH - backH;
      if (frontH < 11.7) return false;
      return true;
    } else {
      const backH = Math.max(12.2, snap(uH * 0.33));
      const middleH = Math.max(10.2, snap(uH * 0.30));
      const frontH = uH - backH - middleH;
      if (frontH < 9.0) return false;
      return true;
    }
  }
}

export function generateLocalLayout(inputs: PlotInputs): FloorPlan {
  const {
    lengthFt: W,
    breadthFt: H,
    bedrooms: inputBedrooms,
    bathrooms: inputBathrooms,
    parking = false,
    garden = false,
    poojaRoom = false,
    vastu = false,
    roadFacing = "North",
    servantQuarters = false,
  } = inputs;

  const plotArea = W * H;
  let bedroomsCount = inputBedrooms ?? (plotArea < 800 ? 1 : plotArea < 1400 ? 2 : plotArea < 2000 ? 3 : 4);
  let bathroomsCount = inputBathrooms ?? (plotArea < 1000 ? 1 : plotArea < 1800 ? 2 : 3);

  // Boundary wall thickness (setback)
  const S = W <= 22 ? 0.5 : 1.5;
  const uW = snap(W - 2 * S); // usable width
  const uH = snap(H - 2 * S); // usable height
  const usableArea = uW * uH;

  // ─── SECOND-LEVEL EMERGENCY FALLBACK DEFINITION ───
  const runEmergencyFallback = (err: any): FloorPlan => {
    console.warn("Emergency fallback triggered in generateLocalLayout:", err);
    try {
      const rooms: Room[] = [];
      const doors: Door[] = [];

      const x0 = S;
      const y0 = S;

      // Safe grid dimensions
      const w_left = snap(uW * 0.40);
      const w_right = snap(uW - w_left);
      const h_top = snap(uH * 0.50);
      const h_bottom = snap(uH - h_top);
      const h_kitchen = snap(h_bottom * 0.60);
      const h_bathroom = snap(h_bottom - h_kitchen);

      // 1. Living Room (Top-Left)
      rooms.push({
        id: "living",
        label: "Living Room",
        x: x0,
        y: y0,
        width: Math.max(4.0, w_left),
        height: Math.max(4.0, h_top),
      });

      // 2. Master Bedroom (Top-Right)
      rooms.push({
        id: "bedroom-master",
        label: "Master Bedroom",
        x: x0 + w_left,
        y: y0,
        width: Math.max(4.0, w_right),
        height: Math.max(4.0, h_top),
      });

      // 3. Kitchen (Bottom-Left)
      rooms.push({
        id: "kitchen",
        label: "Kitchen",
        x: x0,
        y: y0 + h_top,
        width: Math.max(4.0, w_left),
        height: Math.max(4.0, h_kitchen),
      });

      // 4. Bathroom (Bottom-Left, below Kitchen)
      rooms.push({
        id: "bathroom-1",
        label: "Bathroom",
        x: x0,
        y: y0 + h_top + h_kitchen,
        width: Math.max(4.0, w_left),
        height: Math.max(4.0, h_bathroom),
      });

      // 5. Bedroom 2 (Bottom-Right, if space allows)
      const hasBed2 = (W * H >= 500) && (w_right >= 4.0) && (h_bottom >= 4.0);
      if (hasBed2) {
        rooms.push({
          id: "bedroom-2",
          label: "Bedroom 2",
          x: x0 + w_left,
          y: y0 + h_top,
          width: w_right,
          height: h_bottom,
        });
      }

      // Safe Door Helper
      const getDoor = (roomId: string, wall: "top" | "bottom" | "left" | "right", roomDim: number, width: number = 3.0) => {
        const dWidth = Math.min(width, Math.max(1.5, roomDim - 1.0));
        const position = Math.max(0.5, snap((roomDim - dWidth) / 2));
        return { room: roomId, wall, position, width: dWidth };
      };

      // Living room door (top wall - entrance)
      doors.push(getDoor("living", "top", w_left, 3.0));

      // Master Bedroom door (left wall shared with living)
      doors.push(getDoor("bedroom-master", "left", h_top, 3.0));

      // Kitchen door (top wall shared with living)
      doors.push(getDoor("kitchen", "top", w_left, 3.0));

      // Bathroom door (right wall shared with bedroom 2 or external/passage)
      doors.push(getDoor("bathroom-1", "right", h_bathroom, 2.5));

      // Bedroom 2 door (top wall shared with Master Bedroom)
      if (hasBed2) {
        doors.push(getDoor("bedroom-2", "top", w_right, 3.0));
      }

      return {
        floor: 0,
        plotLength: W,
        plotBreadth: H,
        rooms,
        doors,
        windows: [],
        staircase: { x: 0, y: 0, width: 0, height: 0 },
        explanation: "Basic layout generated. Plot size is very small or unusual — showing simplified arrangement.",
      };
    } catch (innerErr) {
      console.error("Critical fallback failed, returning absolute placeholder:", innerErr);
      return {
        floor: 0,
        plotLength: W,
        plotBreadth: H,
        rooms: [
          {
            id: "placeholder",
            label: "Plot too small",
            x: 0,
            y: 0,
            width: W,
            height: H,
          },
        ],
        doors: [
          {
            room: "placeholder",
            wall: "top",
            position: Math.max(0.5, snap(W / 2 - 1.5)),
            width: Math.min(3.0, W - 1.0),
          },
        ],
        windows: [],
        staircase: { x: 0, y: 0, width: 0, height: 0 },
        explanation: "Plot size is too small to generate a valid layout.",
      };
    }
  };

  try {
    // ─── DYNAMIC ROOM COUNT REDUCTION FOR SMALL PLOTS (Section 10) ───
    let activeBedrooms = bedroomsCount;
    let activeBathrooms = bathroomsCount;
    let activePooja = poojaRoom;
    let activeServantQuarters = servantQuarters;
    let activeParking = parking;
    let activeGarden = garden;

    const removedRooms: string[] = [];

    // Minimum dimensions helper
    const getMinArea = (
      bedrooms: number,
      bathrooms: number,
      hasParking: boolean,
      hasPooja: boolean,
      hasServant: boolean,
      hasGarden: boolean
    ) => {
      let area = 0;
      // master bedroom: 11 * 12
      area += 11 * 12;
      // living: 10 * 12
      area += 10 * 12;
      // kitchen: 7 * 9
      area += 7 * 9;
      // staircase: 3.5 * 8
      area += 3.5 * 8;
      // first bathroom (core)
      area += 4 * 6;

      // Additional bedrooms (each 9 * 10)
      if (bedrooms > 1) {
        area += (bedrooms - 1) * (9 * 10);
      }
      // Additional bathrooms (each 4 * 6)
      if (bathrooms > 1) {
        area += (bathrooms - 1) * (4 * 6);
      }
      if (hasParking) {
        area += 10 * 18;
      }
      if (hasPooja) {
        area += 4 * 5;
      }
      if (hasServant) {
        area += 8 * 8; // Servant quarters min area
      }
      if (hasGarden) {
        area += 8 * 10; // Garden min area
      }
      return area;
    };

    // Drop rooms until total minimum area fits within 90% of usable area AND geometry is valid
    while (
      getMinArea(activeBedrooms, activeBathrooms, activeParking, activePooja, activeServantQuarters, activeGarden) > usableArea * 0.90 ||
      !checkGeometry(activeBedrooms, activeParking, activeGarden, W, H)
    ) {
      if (activePooja) {
        activePooja = false;
        removedRooms.push("Pooja Room");
      } else if (activeServantQuarters) {
        activeServantQuarters = false;
        removedRooms.push("Servant Quarters");
      } else if (activeBathrooms > 1) {
        removedRooms.push("Extra Bathroom");
        activeBathrooms -= 1;
      } else if (activeBedrooms >= 3) {
        removedRooms.push(`Bedroom ${activeBedrooms}`);
        activeBedrooms -= 1;
      } else if (activeParking) {
        activeParking = false;
        removedRooms.push("Car Parking");
      } else if (activeBedrooms >= 2) {
        removedRooms.push("Bedroom 2");
        activeBedrooms -= 1;
      } else if (activeGarden) {
        activeGarden = false;
        removedRooms.push("Garden");
      } else {
        break; // Core rooms cannot be removed
      }
    }

    let rootNode: LayoutNode;

    // ─── BUILD SLICING TREE DYNAMICALLY ───
    if (W <= 22 && H >= 35) {
      // ─── NARROW PLOT LAYOUT (e.g. 20x40 vertical layout) ───
      const minBackH = 18.1;
      const minLeftFrontH = activeBedrooms >= 2 ? 21.1 : 11.7;
      const minRightFrontH = activeParking ? 18.2 : activeGarden ? 16.2 : 8.2;
      const minFrontH = Math.max(minLeftFrontH, minRightFrontH);

      const minHeightExcludingCorridor = minBackH + minFrontH;
      const remainingHeight = (uH - 3.5) - minHeightExcludingCorridor;

      let backH = minBackH;
      let frontH = minFrontH;

      if (remainingHeight > 0) {
        const backProp = minBackH / minHeightExcludingCorridor;
        backH = snap(minBackH + remainingHeight * backProp);
        frontH = snap(uH - 3.5 - backH);
      }

      // 1. Back Zone: Master Bed + Bathrooms (left) and Kitchen/Bed 3 (right)
      let bathroomsNode: LayoutNode;
      if (activeBathrooms >= 2) {
        bathroomsNode = {
          type: "split",
          direction: "horizontal",
          ratio: 0.5,
          children: [
            { type: "room", id: "bathroom-1", label: "Bathroom 1" },
            { type: "room", id: "bathroom-2", label: "Bathroom 2" },
          ],
        };
      } else {
        bathroomsNode = { type: "room", id: "bathroom-1", label: "Bathroom" };
      }

      const leftColumnBack: LayoutNode = {
        type: "split",
        direction: "vertical",
        ratio: Math.max(0.1, Math.min(0.9, (backH - 6.4) / backH)),
        children: [
          { type: "room", id: "bedroom-master", label: "Master Bedroom" },
          bathroomsNode,
        ],
      };

      let rightColumnBack: LayoutNode;
      if (activeBedrooms >= 3) {
        rightColumnBack = {
          type: "split",
          direction: "vertical",
          ratio: Math.max(0.1, Math.min(0.9, 9.4 / backH)),
          children: [
            { type: "room", id: "bedroom-3", label: "Bedroom 3" },
            { type: "room", id: "kitchen", label: "Kitchen" },
          ],
        };
      } else {
        rightColumnBack = { type: "room", id: "kitchen", label: "Kitchen" };
      }

      const backZone: LayoutNode = {
        type: "split",
        direction: "horizontal",
        ratio: Math.max(0.1, Math.min(0.9, 11.5 / uW)),
        children: [leftColumnBack, rightColumnBack],
      };

      // 2. Corridor Zone: 3.5ft horizontal strip full width
      const corridorRoom: LayoutNode = {
        type: "room",
        id: "corridor",
        label: "Passage",
      };

      // 3. Front Zone: Living Room + Bedroom 2 (left) and Staircase + Parking/Garden (right)
      let leftColumnFront: LayoutNode;
      if (activeBedrooms >= 2) {
        leftColumnFront = {
          type: "split",
          direction: "vertical",
          ratio: Math.max(0.1, Math.min(0.9, 9.4 / frontH)),
          children: [
            { type: "room", id: "bedroom-2", label: "Bedroom 2" },
            { type: "room", id: "living", label: "Drawing / Living" },
          ],
        };
      } else {
        leftColumnFront = { type: "room", id: "living", label: "Drawing / Living" };
      }

      let rightColumnFront: LayoutNode;
      if (activeParking) {
        rightColumnFront = {
          type: "split",
          direction: "vertical",
          ratio: Math.max(0.1, Math.min(0.9, 8.2 / frontH)),
          children: [
            { type: "room", id: "staircase", label: "Staircase" },
            { type: "room", id: "parking", label: "Car Parking" },
          ],
        };
      } else if (activeGarden) {
        rightColumnFront = {
          type: "split",
          direction: "vertical",
          ratio: 8.2 / 18.2,
          children: [
            { type: "room", id: "staircase", label: "Staircase" },
            { type: "room", id: "garden", label: "Garden / Lawn" },
          ],
        };
      } else {
        rightColumnFront = { type: "room", id: "staircase", label: "Staircase" };
      }

      const rightColWidth = activeParking ? 10.0 : 4.5;
      const frontZone: LayoutNode = {
        type: "split",
        direction: "horizontal",
        ratio: Math.max(0.1, Math.min(0.9, (uW - rightColWidth) / uW)),
        children: [leftColumnFront, rightColumnFront],
      };

      // 4. Root Slicing Node
      rootNode = {
        type: "split",
        direction: "vertical",
        ratio: backH / uH,
        children: [
          backZone,
          {
            type: "split",
            direction: "vertical",
            ratio: 3.5 / (uH - backH),
            children: [corridorRoom, frontZone],
          },
        ],
      };
    } else {
      // ─── STANDARD PLOT LAYOUT ───
      if (activeBedrooms === 1) {
        // 2-Row Layout: Back Row and Front Row
        let backRowLeft: LayoutNode;
        if (activeBathrooms >= 2) {
          backRowLeft = {
            type: "split",
            direction: "horizontal",
            ratio: 0.75,
            children: [
              { type: "room", id: "bedroom-master", label: "Master Bedroom" },
              { type: "room", id: "bathroom-1", label: "Bathroom 1" },
            ],
          };
        } else {
          backRowLeft = { type: "room", id: "bedroom-master", label: "Master Bedroom" };
        }

        const backRow: LayoutNode = {
          type: "split",
          direction: "horizontal",
          ratio: 0.65,
          children: [backRowLeft, { type: "room", id: "kitchen", label: "Kitchen" }],
        };

        const backH = 12.2;
        const frontH = uH - backH;

        let frontRowRight: LayoutNode;
        if (activeParking) {
          const staircaseH = Math.min(9.0, Math.max(8.0, frontH * 0.38));
          frontRowRight = {
            type: "split",
            direction: "vertical",
            ratio: staircaseH / frontH, // Staircase height = 8.0 ft
            children: [
              { type: "room", id: "staircase", label: "Staircase" },
              { type: "room", id: "parking", label: "Car Parking" },
            ],
          };
        } else if (activeGarden) {
          const staircaseH = Math.min(9.0, Math.max(8.0, frontH * 0.38));
          frontRowRight = {
            type: "split",
            direction: "vertical",
            ratio: staircaseH / frontH,
            children: [
              { type: "room", id: "staircase", label: "Staircase" },
              { type: "room", id: "garden", label: "Garden / Lawn" },
            ],
          };
        } else {
          frontRowRight = { type: "room", id: "staircase", label: "Staircase" };
        }

        const staircaseColW = Math.min(6.0, Math.max(4.5, uW * 0.20));
        const frontRow: LayoutNode = {
          type: "split",
          direction: "horizontal",
          ratio: (uW - staircaseColW) / uW, // Staircase column width
          children: [{ type: "room", id: "living", label: "Living Room" }, frontRowRight],
        };

        rootNode = {
          type: "split",
          direction: "vertical",
          ratio: backH / uH,
          children: [backRow, frontRow],
        };
      } else {
        // 3-Row Layout: Back Row, Middle Row, Front Row
        const backH = Math.max(12.2, snap(uH * 0.33));
        const middleH = Math.max(10.2, snap(uH * 0.30));
        const frontH = uH - backH - middleH;
        if (frontH < 9.0) throw new Error("Plot too shallow for 3-row layout");

        let backRowLeft: LayoutNode;
        if (activeBathrooms >= 2) {
          backRowLeft = {
            type: "split",
            direction: "horizontal",
            ratio: 0.75,
            children: [
              { type: "room", id: "bedroom-master", label: "Master Bedroom" },
              { type: "room", id: "bathroom-1", label: "Bathroom 1" },
            ],
          };
        } else {
          backRowLeft = { type: "room", id: "bedroom-master", label: "Master Bedroom" };
        }

        const backRow: LayoutNode = {
          type: "split",
          direction: "horizontal",
          ratio: 0.65,
          children: [backRowLeft, { type: "room", id: "kitchen", label: "Kitchen" }],
        };

        let middleRowLeft: LayoutNode;
        if (activeBedrooms >= 3) {
          middleRowLeft = {
            type: "split",
            direction: "horizontal",
            ratio: 0.5,
            children: [
              { type: "room", id: "bedroom-2", label: "Bedroom 2" },
              { type: "room", id: "bedroom-3", label: "Bedroom 3" },
            ],
          };
        } else {
          middleRowLeft = { type: "room", id: "bedroom-2", label: "Bedroom 2" };
        }

        let middleRowRight: LayoutNode;
        const commonBathId = activeBathrooms >= 2 ? "bathroom-2" : "bathroom-1";
        if (activePooja) {
          middleRowRight = {
            type: "split",
            direction: "horizontal",
            ratio: 0.5,
            children: [
              { type: "room", id: commonBathId, label: "Bathroom" },
              { type: "room", id: "pooja", label: "Pooja Room" },
          ],
        };
      } else {
        middleRowRight = { type: "room", id: commonBathId, label: "Bathroom" };
      }

      const middleRow: LayoutNode = {
        type: "split",
        direction: "horizontal",
        ratio: 0.75,
        children: [middleRowLeft, middleRowRight],
      };

      let frontRowRight: LayoutNode = { type: "room", id: "staircase", label: "Staircase" };
      if (activeParking) {
        const staircaseH = Math.min(9.0, Math.max(8.0, frontH * 0.38));
        frontRowRight = {
          type: "split",
          direction: "vertical",
          ratio: staircaseH / frontH,
          children: [
            { type: "room", id: "staircase", label: "Staircase" },
            { type: "room", id: "parking", label: "Car Parking" },
          ],
        };
      } else if (activeGarden) {
        const staircaseH = Math.min(9.0, Math.max(8.0, frontH * 0.38));
        frontRowRight = {
          type: "split",
          direction: "vertical",
          ratio: staircaseH / frontH,
          children: [
            { type: "room", id: "staircase", label: "Staircase" },
            { type: "room", id: "garden", label: "Garden / Lawn" },
          ],
        };
      }

      const staircaseColW = Math.min(6.0, Math.max(4.5, uW * 0.20));
      const frontRow: LayoutNode = {
        type: "split",
        direction: "horizontal",
        ratio: (uW - staircaseColW) / uW, // Right column
        children: [{ type: "room", id: "living", label: "Living Room" }, frontRowRight],
      };

      rootNode = {
        type: "split",
        direction: "vertical",
        ratio: backH / uH,
        children: [
          backRow,
          {
            type: "split",
            direction: "vertical",
            ratio: middleH / (uH - backH),
            children: [middleRow, frontRow],
          },
        ],
      };
    }
  }

  // ─── SOLVE COORDINATES ───
  const rooms = solveLayout(rootNode, S, S, uW, uH, 0.4);

  // Determine if we need to flip the layout to match road facing direction
  // The BSP tree always puts front zone at bottom (high Y) and back at top (low Y)
  // "Front" should face the road.
  const shouldFlipVertically = (roadFacing as string) === "North" || (roadFacing as string) === "Northeast" || (roadFacing as string) === "Northwest";
  const shouldFlipHorizontally = roadFacing === "East";

  if (shouldFlipVertically) {
    // Mirror all room Y coordinates: newY = (S + uH) - (room.y - S) - room.height
    // Which simplifies to: newY = S + uH + S - room.y - room.height
    //                            = (2*S + uH) - room.y - room.height
    const totalH = 2 * S + uH;
    rooms.forEach(room => {
      room.y = totalH - room.y - room.height;
    });
  }

  if (shouldFlipHorizontally) {
    const totalW = 2 * S + uW;
    rooms.forEach(room => {
      room.x = totalW - room.x - room.width;
    });
  }

  // West facing: flip horizontally in opposite direction
  if (roadFacing === "West") {
    // Living room column (right side of BSP) should become left side
    const totalW = 2 * S + uW;
    rooms.forEach(room => {
      room.x = totalW - room.x - room.width;
    });
  }

  // Sanity Check: Ensure no main room width or height is less than 4 ft
  const hasTinyRoom = rooms.some(
    (r) =>
      (r.id.startsWith("bedroom") ||
        r.id === "kitchen" ||
        r.id === "living" ||
        r.id === "family") &&
      (r.width < 4 || r.height < 4)
  );
  if (hasTinyRoom) {
    throw new Error("Layout contains rooms smaller than 4x4 ft");
  }

  // ─── GEOMETRIC DOORS & WINDOWS ───
  const openings = generateDoorsAndWindows(rooms, W, H, roadFacing, vastu);
  const doors = openings.doors;
  const windows = openings.windows;

  // ─── EXPLANATION ───
  let explanation = `Procedural layout solver for ${W} × ${H} ft plot (${W * H} sq ft). Road facing ${roadFacing}.`;
  if (vastu) explanation += " Vastu aligned layout.";
  if (removedRooms.length > 0) {
    explanation += ` Removed due to plot size limits: ${removedRooms.join(", ")}.`;
  }

  const stairRoom = rooms.find((r) => r.id === "staircase");
  const staircaseCoords = stairRoom
    ? { x: stairRoom.x, y: stairRoom.y, width: stairRoom.width, height: stairRoom.height }
    : { x: 0, y: 0, width: 0, height: 0 };

  return {
    floor: 0,
    plotLength: W,
    plotBreadth: H,
    rooms,
    doors,
    windows,
    staircase: staircaseCoords,
    explanation,
  };
  } catch (error: any) {
    return runEmergencyFallback(error);
  }
}

export function generateLocalUpperFloorLayout(
  inputs: PlotInputs,
  floorNumber: number,
  staircase: { x: number; y: number; width: number; height: number }
): FloorPlan {
  const plan = generateLocalLayout({ ...inputs, floors: inputs.floors });
  plan.floor = floorNumber;

  if (plan.explanation.includes("Basic layout generated") || plan.explanation.includes("Plot size is too small")) {
    plan.explanation = `Floor ${floorNumber} layout. ` + plan.explanation;
    return plan;
  }

  plan.rooms = plan.rooms.map((room) => {
    if (room.id === "staircase") {
      return {
        ...room,
        x: staircase.x,
        y: staircase.y,
        width: staircase.width,
        height: staircase.height,
      };
    }
    if (room.id === "parking") {
      return { ...room, id: "balcony", label: "Balcony" };
    }
    if (room.id === "living") {
      return { ...room, id: "family", label: "Family Lounge" };
    }
    if (room.id === "kitchen") {
      return { ...room, id: "bedroom-guest", label: "Guest Bedroom" };
    }
    if (room.id === "garden") {
      return { ...room, id: "terrace", label: "Open Terrace" };
    }
    if (room.id === "pooja") {
      return { ...room, id: "study", label: "Study Room" };
    }
    return room;
  });

  // Generate doors and windows geometrically for the upper floor rooms
  const openings = generateDoorsAndWindows(plan.rooms, inputs.lengthFt, inputs.breadthFt, inputs.roadFacing || "North", inputs.vastu || false);
  plan.doors = openings.doors;
  plan.windows = openings.windows;

  plan.staircase = {
    x: staircase.x,
    y: staircase.y,
    width: staircase.width,
    height: staircase.height,
  };

  plan.explanation = `Floor ${floorNumber} layout. Multi-floor staircase alignment matching Ground Floor. Parking mapped to Balcony and Kitchen mapped to Guest Bedroom.`;

  return plan;
}

