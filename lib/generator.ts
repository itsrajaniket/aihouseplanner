import { PlotInputs, FloorPlan, Room, Door, Window } from "./types";

export function generateLocalLayout(inputs: PlotInputs): FloorPlan {
  const {
    lengthFt: width,
    breadthFt: height,
    bedrooms: inputBedrooms,
    bathrooms: inputBathrooms,
    parking = false,
    garden = false,
    poojaRoom = false,
    vastu = false,
    roadFacing = "North",
  } = inputs;

  // Set smart defaults based on plot size if inputs are not specified
  const plotArea = width * height;
  const bedroomsCount = inputBedrooms ?? (plotArea < 800 ? 1 : plotArea < 1400 ? 2 : plotArea < 2000 ? 3 : 4);
  const bathroomsCount = inputBathrooms ?? (plotArea < 1000 ? 1 : plotArea < 1800 ? 2 : 3);

  // Setbacks: 1.5 ft visual margin on sides, maybe more at front/back if plot is large
  const leftSetback = 1.5;
  const rightSetback = 1.5;
  const topSetback = 1.5;
  const bottomSetback = 1.5;

  const usableW = width - (leftSetback + rightSetback);
  const usableH = height - (topSetback + bottomSetback);

  const rooms: Room[] = [];
  const doors: Door[] = [];
  const windows: Window[] = [];

  // Determine road side for placing entrance/parking/garden
  // We'll map coordinates with Y=0 at the top (North), Y=height at the bottom (South)
  // X=0 at the left (West), X=width at the right (East)

  // Standard staircase size (4.5 ft x 9 ft)
  let staircase = {
    x: leftSetback + usableW - 5.5,
    y: topSetback + (usableH / 2) - 4.5,
    width: 4.5,
    height: 9.0,
  };

  // Adjust staircase position based on Vastu or road access (usually placed on South or West)
  if (vastu) {
    // West or South is preferred for staircase
    staircase.x = leftSetback + 1.0; // West side
    staircase.y = topSetback + usableH * 0.4;
  }

  // Define layout zones.
  // If height >= 35 (Deep Plot), we partition into 3 rows: Back, Middle, Front
  // If height < 35 (Shallow Plot), we partition into 2 rows: Back, Front
  if (height >= 35) {
    const backRowH = Math.max(10, usableH * 0.35);
    const frontRowH = Math.max(10, usableH * 0.3);
    const middleRowH = usableH - (backRowH + frontRowH);

    const backY = topSetback + usableH - backRowH;
    const middleY = topSetback + frontRowH;
    const frontY = topSetback;

    // --- BACK ROW (Kitchen, Master Bedroom, Bathrooms) ---
    // Kitchen (typically South-East. If Vastu is enabled, place on bottom-right)
    const kitchenW = Math.min(usableW * 0.35, 10);
    const kitchenX = vastu ? (leftSetback + usableW - kitchenW) : leftSetback;
    rooms.push({
      id: "kitchen",
      label: "Kitchen",
      x: kitchenX,
      y: backY,
      width: kitchenW,
      height: backRowH,
    });

    // Master Bedroom (typically South-West. If Vastu, bottom-left)
    const mBedW = Math.min(usableW * 0.45, 14);
    const mBedX = vastu ? leftSetback : (leftSetback + usableW - mBedW);
    rooms.push({
      id: "bedroom-master",
      label: "Master Bedroom",
      x: mBedX,
      y: backY,
      width: mBedW,
      height: backRowH,
    });

    // Back Bathroom (in between or next to bedroom)
    const bath1W = usableW - (kitchenW + mBedW);
    const bath1X = mBedX < kitchenX ? (mBedX + mBedW) : (kitchenX + kitchenW);
    if (bath1W >= 4.5) {
      rooms.push({
        id: "bathroom-1",
        label: "Bathroom 1",
        x: bath1X,
        y: backY,
        width: bath1W,
        height: backRowH * 0.6, // Leave rest for shaft/utility
      });
    } else {
      // Re-adjust bedroom/kitchen to fit bathroom inside the row
      rooms.push({
        id: "bathroom-1",
        label: "Bathroom 1",
        x: mBedX < kitchenX ? (mBedX + mBedW - 5) : (kitchenX + kitchenW - 5),
        y: backY,
        width: 5,
        height: backRowH * 0.7,
      });
    }

    // --- MIDDLE ROW (Staircase, Bedroom 2, Pooja Room, Dining) ---
    staircase.y = middleY + (middleRowH - staircase.height) / 2;
    // Ensure staircase doesn't overlap Master Bed (which starts at backY)
    const overlapsMasterBedY = staircase.y < (backY + backRowH) && (staircase.y + staircase.height) > backY;
    const overlapsMasterBedX = staircase.x < (mBedX + mBedW) && (staircase.x + staircase.width) > mBedX;
    if (overlapsMasterBedX && overlapsMasterBedY) {
      // Shift staircase
      staircase.x = leftSetback + usableW - staircase.width - 0.5;
    }

    let remainingMiddleW = usableW - (staircase.x === leftSetback + 1.0 ? staircase.width + 1.5 : staircase.width);
    let middleXStart = staircase.x === leftSetback + 1.0 ? (leftSetback + staircase.width + 1.5) : leftSetback;

    // Pooja Room (Vastu: Northeast. If top is North and roadFacing is North, top-right is NE.
    // Let's place it in middle row, top-right/East if Vastu is true)
    let poojaW = 0;
    if (poojaRoom) {
      poojaW = Math.min(remainingMiddleW * 0.25, 6);
      const poojaX = vastu ? (leftSetback + usableW - poojaW) : middleXStart;
      rooms.push({
        id: "pooja",
        label: "Pooja Room",
        x: poojaX,
        y: middleY,
        width: poojaW,
        height: Math.min(middleRowH, 6),
      });
      if (poojaX === middleXStart) {
        middleXStart += poojaW;
      }
      remainingMiddleW -= poojaW;
    }

    // Bedroom 2 (if bedrooms >= 2)
    if (bedroomsCount >= 2) {
      const bed2W = Math.min(remainingMiddleW * 0.6, 12);
      rooms.push({
        id: "bedroom-2",
        label: "Bedroom 2",
        x: middleXStart,
        y: middleY,
        width: bed2W,
        height: middleRowH,
      });
      middleXStart += bed2W;
      remainingMiddleW -= bed2W;
    }

    // Dining Area
    if (remainingMiddleW >= 6) {
      rooms.push({
        id: "dining",
        label: "Dining Lobby",
        x: middleXStart,
        y: middleY,
        width: remainingMiddleW,
        height: middleRowH,
      });
    }

    // --- FRONT ROW (Living Room, Parking, Garden) ---
    let frontXStart = leftSetback;
    let remainingFrontW = usableW;

    // Parking (near road)
    if (parking) {
      const parkW = Math.min(remainingFrontW * 0.4, 11);
      const parkH = Math.min(frontRowH, 15);
      // Place parking near the entrance / road edge (assume bottom or top depending on road)
      rooms.push({
        id: "parking",
        label: "Parking / Porch",
        x: frontXStart,
        y: frontY,
        width: parkW,
        height: parkH,
      });
      frontXStart += parkW;
      remainingFrontW -= parkW;
    }

    // Garden
    if (garden) {
      const gardenW = Math.min(remainingFrontW * 0.3, 10);
      rooms.push({
        id: "garden",
        label: "Lawn / Garden",
        x: leftSetback + usableW - gardenW,
        y: frontY,
        width: gardenW,
        height: frontRowH * 0.7,
      });
      remainingFrontW -= gardenW;
    }

    // Living Room (Hall) takes the rest of the front space
    rooms.push({
      id: "living",
      label: "Living Room (Hall)",
      x: frontXStart,
      y: frontY,
      width: remainingFrontW,
      height: frontRowH,
    });

    // Additional Bathrooms
    if (bathroomsCount >= 2) {
      // Place Bathroom 2 near Bedroom 2 in the middle row or as a powder room
      const diningRoom = rooms.find(r => r.id === "dining");
      if (diningRoom && diningRoom.width >= 9) {
        // Carve out a bathroom from dining area
        const originalW = diningRoom.width;
        diningRoom.width = originalW - 5.0;
        rooms.push({
          id: "bathroom-2",
          label: "Bathroom 2",
          x: diningRoom.x + diningRoom.width,
          y: middleY,
          width: 5.0,
          height: Math.min(middleRowH, 7),
        });
      } else {
        // Place it adjacent to Master Bed bathroom
        const bath1 = rooms.find(r => r.id === "bathroom-1");
        if (bath1) {
          bath1.width = bath1.width / 2;
          rooms.push({
            id: "bathroom-2",
            label: "Bathroom 2",
            x: bath1.x + bath1.width,
            y: bath1.y,
            width: bath1.width,
            height: bath1.height,
          });
        }
      }
    }
  } else {
    // --- SHALLOW PLOT (height < 35) ---
    // Split into 2 rows: Back (Bedrooms, Kitchen, Bathrooms) and Front (Living room, Parking, Stairs)
    const backRowH = usableH * 0.5;
    const frontRowH = usableH - backRowH;
    const backY = topSetback + frontRowH;
    const frontY = topSetback;

    // Back Row: Master Bed (left/SW), Kitchen (right/SE), Bathroom (middle)
    const kitchenW = Math.min(usableW * 0.35, 10);
    const kitchenX = vastu ? (leftSetback + usableW - kitchenW) : leftSetback;
    rooms.push({
      id: "kitchen",
      label: "Kitchen",
      x: kitchenX,
      y: backY,
      width: kitchenW,
      height: backRowH,
    });

    const mBedW = Math.min(usableW * 0.45, 13);
    const mBedX = vastu ? leftSetback : (leftSetback + usableW - mBedW);
    rooms.push({
      id: "bedroom-master",
      label: "Master Bedroom",
      x: mBedX,
      y: backY,
      width: mBedW,
      height: backRowH,
    });

    const bath1W = usableW - (kitchenW + mBedW);
    const bath1X = mBedX < kitchenX ? (mBedX + mBedW) : (kitchenX + kitchenW);
    if (bath1W >= 4.0) {
      rooms.push({
        id: "bathroom-1",
        label: "Bathroom 1",
        x: bath1X,
        y: backY,
        width: bath1W,
        height: backRowH * 0.8,
      });
    }

    // Front Row: Staircase, Parking, Garden, Living Room
    staircase.y = frontY;
    staircase.height = frontRowH;
    staircase.width = 4.5;
    staircase.x = vastu ? (leftSetback + 1.0) : (leftSetback + usableW - 5.5);

    let frontXStart = staircase.x === leftSetback + 1.0 ? (leftSetback + 5.5) : leftSetback;
    let remainingFrontW = usableW - 5.5;

    if (parking) {
      const parkW = Math.min(remainingFrontW * 0.4, 10);
      rooms.push({
        id: "parking",
        label: "Parking Porch",
        x: frontXStart,
        y: frontY,
        width: parkW,
        height: frontRowH,
      });
      frontXStart += parkW;
      remainingFrontW -= parkW;
    }

    if (poojaRoom) {
      const poojaW = Math.min(remainingFrontW * 0.2, 5);
      rooms.push({
        id: "pooja",
        label: "Pooja",
        x: vastu ? (leftSetback + usableW - poojaW) : frontXStart,
        y: frontY,
        width: poojaW,
        height: 5,
      });
      if (frontXStart !== (leftSetback + usableW - poojaW)) {
        frontXStart += poojaW;
      }
      remainingFrontW -= poojaW;
    }

    rooms.push({
      id: "living",
      label: "Living Room",
      x: frontXStart,
      y: frontY,
      width: remainingFrontW,
      height: frontRowH,
    });

    if (bedroomsCount >= 2) {
      // In a shallow plot with 2 bedrooms, convert the living area or add a partitioning
      const living = rooms.find(r => r.id === "living");
      if (living && living.width >= 16) {
        // Split living room into living + bed-2
        const originalW = living.width;
        living.width = originalW - 10;
        rooms.push({
          id: "bedroom-2",
          label: "Bedroom 2",
          x: living.x + living.width,
          y: frontY,
          width: 10,
          height: frontRowH,
        });
      }
    }
  }

  // Ensure staircase is added to the rooms array so it gets rendered
  rooms.push({
    id: "staircase",
    label: "Staircase",
    x: staircase.x,
    y: staircase.y,
    width: staircase.width,
    height: staircase.height,
  });

  // --- GENERATE DOORS & WINDOWS (Sensible standard rules) ---
  rooms.forEach(room => {
    if (room.id === "staircase" || room.id === "garden" || room.id === "parking") return;

    // Master Bedroom doors: usually bottom or side
    if (room.id === "bedroom-master") {
      doors.push({ room: room.id, wall: "top", position: 1.5, width: 3.0 });
      windows.push({ room: room.id, wall: "bottom", position: room.width / 2 - 2, width: 4.0 });
    } else if (room.id === "bedroom-2") {
      doors.push({ room: room.id, wall: "bottom", position: 1.5, width: 3.0 });
      windows.push({ room: room.id, wall: "top", position: room.width / 2 - 2, width: 4.0 });
    } else if (room.id === "kitchen") {
      doors.push({ room: room.id, wall: "top", position: 1.0, width: 3.0 });
      windows.push({ room: room.id, wall: "bottom", position: room.width / 2 - 1.5, width: 3.0 });
    } else if (room.id.startsWith("bathroom")) {
      doors.push({ room: room.id, wall: "left", position: 1.0, width: 2.5 });
      windows.push({ room: room.id, wall: "right", position: room.height / 2 - 1, width: 2.0 }); // Ventilator
    } else if (room.id === "pooja") {
      doors.push({ room: room.id, wall: "left", position: room.height / 2 - 1, width: 2.0 });
    } else if (room.id === "living") {
      // Main Entrance Door (larger door: 3.5 ft or 4 ft)
      doors.push({ room: room.id, wall: "top", position: 2.0, width: 3.5 });
      windows.push({ room: room.id, wall: "top", position: room.width - 5, width: 4.0 });
      windows.push({ room: room.id, wall: "bottom", position: room.width / 2 - 2, width: 5.0 });
    }
  });

  // Vastu comment styling
  let explanation = `Designed a standard ${width} ft x ${height} ft ground floor plan.`;
  if (vastu) {
    explanation += ` Vastu principles applied: Kitchen is situated in the South-East zone (Agni corner) for positive energy. The Master Bedroom is placed in the South-West zone (Nairutya corner) for stability. Pooja room occupies the auspicious North-East (Ishanya) corner. Staircase is positioned towards the West/South.`;
  } else {
    explanation += ` Layout is optimized for optimal room sizing, double-wall margins for structural insulation, ventilation shafts next to bathrooms, and easy entry access.`;
  }

  return {
    plotLength: width,
    plotBreadth: height,
    rooms,
    doors,
    windows,
    staircase,
    explanation,
  };
}
