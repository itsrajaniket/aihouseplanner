import { PlotInputs, FloorPlan, Room, Door, Window } from "./types";

// Snap to nearest 0.5 ft
function snap(v: number): number {
  return Math.round(v * 2) / 2;
}
function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
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
  } = inputs;

  const plotArea = W * H;
  const bedroomsCount = inputBedrooms ?? (plotArea < 800 ? 1 : plotArea < 1400 ? 2 : plotArea < 2000 ? 3 : 4);
  const bathroomsCount = inputBathrooms ?? (plotArea < 1000 ? 1 : plotArea < 1800 ? 2 : 3);

  const rooms: Room[] = [];
  const doors: Door[] = [];
  const windows: Window[] = [];

  // Boundary wall thickness (setback)
  const S = 1.5;
  const uW = snap(W - 2 * S); // usable width
  const uH = snap(H - 2 * S); // usable height

  type Wall = "top" | "bottom" | "left" | "right";

  // Push a room, snapping coordinates cleanly
  function addRoom(id: string, label: string, x: number, y: number, w: number, h: number) {
    const rx = snap(x);
    const ry = snap(y);
    const rw = snap(Math.max(w, 4));
    const rh = snap(Math.max(h, 4));
    rooms.push({ id, label, x: rx, y: ry, width: rw, height: rh });
  }

  const isNS = roadFacing === "North" || roadFacing === "South";
  const fromNorthOrWest = roadFacing === "North" || roadFacing === "West";

  // ─── HORIZONTAL LAYOUT (North / South road) ────────────────────────────────
  if (isNS) {
    // Zone heights — must sum to uH exactly
    let frontH: number, backH: number, middleH: number;
    if (uH < 24) {
      middleH = 0;
      frontH = snap(uH * 0.45);
      backH = snap(uH - frontH);
    } else {
      frontH = snap(clamp(uH * 0.35, 10, 22));
      backH = snap(clamp(uH * 0.38, 10, 20));
      middleH = snap(uH - frontH - backH);
      if (middleH < 6 && middleH > 0) {
        const extra = middleH;
        const extraFront = snap(extra / 2);
        frontH += extraFront;
        backH += snap(extra - extraFront);
        middleH = 0;
      } else if (middleH < 0) {
        frontH = snap(uH * 0.5);
        backH = snap(uH - frontH);
        middleH = 0;
      }
    }

    // Y positions depending on road side
    const frontY  = fromNorthOrWest ? S : snap(S + backH + middleH);
    const middleY = fromNorthOrWest ? snap(S + frontH) : snap(S + backH);
    const backY   = fromNorthOrWest ? snap(S + frontH + middleH) : S;

    // ── FRONT ROW (road-facing): Parking + Living ─────────────────────────
    let parkW = 0;
    const parkX = S;

    if (parking) {
      parkW = snap(clamp(uW * 0.38, 9, 15));
      addRoom("parking", "Car Parking", parkX, frontY, parkW, frontH);
    }

    const livingX = snap(S + parkW);
    const livingW = snap(uW - parkW);
    addRoom("living", "Living Room", livingX, frontY, livingW, frontH);

    // ── BACK ROW: Master Bed + Bathroom + Kitchen (+ Garden) ─────────────
    // Calculate widths so they sum exactly to uW — NO GAPS
    let gardenW = 0;
    if (garden) {
      gardenW = snap(clamp(uW * 0.20, 5, 9));
    }

    const kitchenW = snap(clamp(uW * 0.30, 8, 12));
    let bath1W = (bathroomsCount >= 1) ? 5.0 : 0;
    let mBedW = snap(uW - kitchenW - bath1W - gardenW);

    // If master bedroom is too narrow, skip bath1 and let master fill the rest
    if (mBedW < 8) {
      bath1W = 0;
      mBedW = snap(uW - kitchenW - gardenW);
    }

    // Vastu: Master Bed = SW (left), Kitchen = SE (right)
    let mBedX: number, kitchenX: number, bath1X: number, gardenX: number;
    if (vastu) {
      mBedX    = S;
      bath1X   = snap(S + mBedW);
      kitchenX = snap(S + uW - kitchenW);
      gardenX  = snap(S + uW - kitchenW - gardenW);
      // If garden is requested, place it NW (left side near master)
      if (garden) {
        gardenX = snap(S + mBedW + bath1W);
        kitchenX = snap(S + uW - kitchenW);
      }
    } else {
      kitchenX = S;
      bath1X   = snap(S + kitchenW);
      mBedX    = snap(S + kitchenW + bath1W);
      gardenX  = snap(S + uW - gardenW);
    }

    addRoom("bedroom-master", "Master Bedroom", mBedX, backY, mBedW, backH);
    if (bath1W > 0) {
      addRoom("bathroom-1", "Bathroom", bath1X, backY, bath1W, backH);
    }
    addRoom("kitchen", "Kitchen", kitchenX, backY, kitchenW, backH);
    if (garden && gardenW > 0) {
      addRoom("garden", "Garden / Lawn", gardenX, backY, gardenW, backH);
    }

    // ── MIDDLE ROW (if deep enough) ───────────────────────────────────────
    if (middleH >= 6) {
      // Staircase: placed at back-right corner (NW/SE per Vastu)
      const stairW = snap(clamp(uW * 0.20, 4.5, 6.0));
      const stairX = snap(S + uW - stairW);
      addRoom("staircase", "Staircase", stairX, middleY, stairW, middleH);

      let mxCursor = S;
      let mxLeft = snap(uW - stairW); // width available left of stair

      // Bedroom 2
      if (bedroomsCount >= 2) {
        const bed2W = snap(clamp(mxLeft * 0.52, 9, 14));
        addRoom("bedroom-2", "Bedroom 2", mxCursor, middleY, bed2W, middleH);
        mxCursor = snap(mxCursor + bed2W);
        mxLeft   = snap(mxLeft - bed2W);
      }

      // Bathroom 2
      if (bathroomsCount >= 2 && mxLeft >= 4.5) {
        const bath2W = poojaRoom ? snap(clamp(mxLeft * 0.50, 4.5, 6.0)) : snap(mxLeft);
        addRoom("bathroom-2", "Bathroom 2", mxCursor, middleY, bath2W, middleH);
        mxCursor = snap(mxCursor + bath2W);
        mxLeft   = snap(mxLeft - bath2W);
      }

      // Pooja room — fills whatever is left before staircase
      if (poojaRoom && mxLeft >= 4.0) {
        addRoom("pooja", "Pooja Room", mxCursor, middleY, mxLeft, middleH);
        mxCursor = snap(mxCursor + mxLeft);
        mxLeft = 0;
      }

      // If there's still space and we need bedroom 3
      if (bedroomsCount >= 3 && mxLeft >= 8) {
        addRoom("bedroom-3", "Bedroom 3", mxCursor, middleY, mxLeft, middleH);
      }
    } else {
      // Shallow plot: staircase shares the back row
      const stairW = snap(clamp(uW * 0.20, 4.5, 6.0));
      const stairX = snap(S + uW - stairW);
      addRoom("staircase", "Staircase", stairX, backY, stairW, backH);
    }
  }

  // ─── VERTICAL LAYOUT (East / West road) ────────────────────────────────────
  else {
    let frontW: number, backW: number, middleW: number;
    if (uW < 24) {
      middleW = 0;
      frontW = snap(uW * 0.45);
      backW = snap(uW - frontW);
    } else {
      frontW = snap(clamp(uW * 0.35, 10, 22));
      backW = snap(clamp(uW * 0.38, 10, 20));
      middleW = snap(uW - frontW - backW);
      if (middleW < 6 && middleW > 0) {
        const extra = middleW;
        const extraFront = snap(extra / 2);
        frontW += extraFront;
        backW += snap(extra - extraFront);
        middleW = 0;
      } else if (middleW < 0) {
        frontW = snap(uW * 0.5);
        backW = snap(uW - frontW);
        middleW = 0;
      }
    }

    const frontX  = fromNorthOrWest ? S : snap(S + backW + middleW);
    const middleX = fromNorthOrWest ? snap(S + frontW) : snap(S + backW);
    const backX   = fromNorthOrWest ? snap(S + frontW + middleW) : S;

    // ── FRONT COLUMN (road-facing): Parking + Living ──────────────────────
    let parkH = 0;
    const parkY = S;

    if (parking) {
      parkH = snap(clamp(uH * 0.38, 9, 15));
      addRoom("parking", "Car Parking", frontX, parkY, frontW, parkH);
    }

    const livingY = snap(S + parkH);
    const livingH = snap(uH - parkH);
    addRoom("living", "Living Room", frontX, livingY, frontW, livingH);

    // ── BACK COLUMN: Master Bed + Bathroom + Kitchen (+ Garden) ──────────
    let gardenH = 0;
    if (garden) {
      gardenH = snap(clamp(uH * 0.20, 5, 9));
    }

    const kitchenH = snap(clamp(uH * 0.30, 8, 12));
    let bath1H = (bathroomsCount >= 1) ? 5.0 : 0;
    let mBedH  = snap(uH - kitchenH - bath1H - gardenH);

    if (mBedH < 8) {
      bath1H = 0;
      mBedH = snap(uH - kitchenH - gardenH);
    }

    let mBedY: number, kitchenY: number, bath1Y: number, gardenY: number;
    if (vastu) {
      mBedY    = S;
      bath1Y   = snap(S + mBedH);
      kitchenY = snap(S + uH - kitchenH);
      gardenY  = snap(S + mBedH + bath1H);
    } else {
      kitchenY = S;
      bath1Y   = snap(S + kitchenH);
      mBedY    = snap(S + kitchenH + bath1H);
      gardenY  = snap(S + uH - gardenH);
    }

    addRoom("bedroom-master", "Master Bedroom", backX, mBedY, backW, mBedH);
    if (bath1H > 0) {
      addRoom("bathroom-1", "Bathroom", backX, bath1Y, backW, bath1H);
    }
    addRoom("kitchen", "Kitchen", backX, kitchenY, backW, kitchenH);
    if (garden && gardenH > 0) {
      addRoom("garden", "Garden / Lawn", backX, gardenY, backW, gardenH);
    }

    // ── MIDDLE COLUMN (if wide enough) ────────────────────────────────────
    if (middleW >= 6) {
      const stairH = snap(clamp(uH * 0.20, 4.5, 6.0));
      const stairY = snap(S + uH - stairH);
      addRoom("staircase", "Staircase", middleX, stairY, middleW, stairH);

      let myCursor = S;
      let myLeft   = snap(uH - stairH);

      if (bedroomsCount >= 2) {
        const bed2H = snap(clamp(myLeft * 0.52, 9, 14));
        addRoom("bedroom-2", "Bedroom 2", middleX, myCursor, middleW, bed2H);
        myCursor = snap(myCursor + bed2H);
        myLeft   = snap(myLeft - bed2H);
      }

      if (bathroomsCount >= 2 && myLeft >= 4.5) {
        const bath2H = poojaRoom ? snap(clamp(myLeft * 0.50, 4.5, 6.0)) : snap(myLeft);
        addRoom("bathroom-2", "Bathroom 2", middleX, myCursor, middleW, bath2H);
        myCursor = snap(myCursor + bath2H);
        myLeft   = snap(myLeft - bath2H);
      }

      if (poojaRoom && myLeft >= 4.0) {
        addRoom("pooja", "Pooja Room", middleX, myCursor, middleW, myLeft);
        myLeft = 0;
      }

      if (bedroomsCount >= 3 && myLeft >= 8) {
        addRoom("bedroom-3", "Bedroom 3", middleX, myCursor, middleW, myLeft);
      }
    } else {
      const stairH = snap(clamp(uH * 0.20, 4.5, 6.0));
      addRoom("staircase", "Staircase", backX, snap(S + uH - stairH), backW, stairH);
    }
  }

  // ─── DOORS & WINDOWS ───────────────────────────────────────────────────────
  rooms.forEach((room) => {
    if (room.id === "staircase" || room.id === "garden") return;

    const isLiving  = room.id === "living";
    const isKitchen = room.id === "kitchen";
    const isBath    = room.id.startsWith("bathroom");
    const isPooja   = room.id === "pooja";
    const isParking = room.id === "parking";

    const dw = isLiving ? 3.5 : isBath ? 2.5 : isPooja ? 2.0 : isParking ? 9.0 : 3.0;

    if (isParking) {
      // No door symbol for parking — it has the gate opening
      return;
    }

    if (isLiving) {
      // Main door faces the road
      let wall: Wall = "top";
      if (roadFacing === "South") wall = "bottom";
      else if (roadFacing === "West") wall = "left";
      else if (roadFacing === "East") wall = "right";

      const span = (wall === "top" || wall === "bottom") ? room.width : room.height;
      const pos  = snap(clamp(span / 2 - dw / 2, 1.0, span - dw - 0.5));
      doors.push({ room: room.id, wall, position: pos, width: dw });

      // Window opposite wall
      const oWall: Wall = wall === "top" ? "bottom" : wall === "bottom" ? "top" : wall === "left" ? "right" : "left";
      const oSpan = (oWall === "top" || oWall === "bottom") ? room.width : room.height;
      windows.push({ room: room.id, wall: oWall, position: snap(oSpan / 2 - 2), width: 4.0 });

    } else if (isBath) {
      // Bathroom door on the shared interior wall
      const wall = (isNS ? "left" : "top") as Wall;
      const span = (wall === "top" || wall === "bottom") ? room.width : room.height;
      doors.push({ room: room.id, wall, position: snap(clamp(1.0, 0.5, span - dw - 0.5)), width: dw });
      // Vent window on opposite wall
      const oWall = (wall === "left" ? "right" : "bottom") as Wall;
      const oSpan = (oWall === "top" || oWall === "bottom") ? room.width : room.height;
      windows.push({ room: room.id, wall: oWall, position: snap(oSpan / 2 - 1.0), width: 2.0 });

    } else if (isKitchen) {
      // Kitchen door on interior wall
      const wall: Wall = isNS ? "top" : "left";
      doors.push({ room: room.id, wall, position: 1.0, width: dw });
      // Kitchen window on exterior wall
      const oWall = (wall === "top" ? "bottom" : "right") as Wall;
      const oSpan = (oWall === "top" || oWall === "bottom") ? room.width : room.height;
      windows.push({ room: room.id, wall: oWall, position: snap(oSpan / 2 - 1.5), width: 3.0 });

    } else if (isPooja) {
      const wall: Wall = (isNS ? "bottom" : "right") as Wall;
      const span = (wall === "top" || wall === "bottom") ? room.width : room.height;
      doors.push({ room: room.id, wall, position: snap(clamp(span / 2 - dw / 2, 0.5, span - dw - 0.5)), width: dw });

    } else {
      // Bedrooms — door opens toward interior/corridor
      const wall: Wall = isNS
        ? (roadFacing === "North" ? "bottom" : "top")
        : (roadFacing === "West" ? "right" : "left");
      const span = (wall === "top" || wall === "bottom") ? room.width : room.height;
      const pos  = snap(clamp(span / 2 - dw / 2, 1.0, span - dw - 0.5));
      doors.push({ room: room.id, wall, position: pos, width: dw });

      // Window on exterior wall
      const extWall: Wall = isNS
        ? (roadFacing === "North" ? "top" : "bottom")
        : (roadFacing === "West" ? "left" : "right");
      const eSpan = (extWall === "top" || extWall === "bottom") ? room.width : room.height;
      windows.push({ room: room.id, wall: extWall, position: snap(eSpan / 2 - 2), width: 4.0 });
    }
  });

  // ─── EXPLANATION ──────────────────────────────────────────────────────────
  let explanation = `${W} × ${H} ft plot (${W * H} sq ft). Road access from ${roadFacing}.`;
  if (vastu) explanation += " Vastu compliant: Kitchen SE, Master Bedroom SW, Pooja NE.";
  if (parking) explanation += " Car parking at gate entry.";
  explanation += " Green dashed line shows entry path from gate to main door.";

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
}

export function generateLocalUpperFloorLayout(
  inputs: PlotInputs,
  floorNumber: number,
  staircase: { x: number; y: number; width: number; height: number }
): FloorPlan {
  // Generate ground floor first to get consistent structural grid
  const plan = generateLocalLayout({ ...inputs, floors: inputs.floors });
  
  plan.floor = floorNumber;

  // Map ground floor rooms to typical upper-floor spaces and fix staircase
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

  // Map doors and remove gate (since gate is only on ground floor)
  plan.doors = plan.doors
    .map((door) => {
      let mappedRoom = door.room;
      if (door.room === "parking") mappedRoom = "balcony";
      else if (door.room === "living") mappedRoom = "family";
      else if (door.room === "kitchen") mappedRoom = "bedroom-guest";
      else if (door.room === "garden") mappedRoom = "terrace";
      else if (door.room === "pooja") mappedRoom = "study";
      return { ...door, room: mappedRoom };
    });

  // Map windows
  plan.windows = plan.windows
    .map((win) => {
      let mappedRoom = win.room;
      if (win.room === "parking") mappedRoom = "balcony";
      else if (win.room === "living") mappedRoom = "family";
      else if (win.room === "kitchen") mappedRoom = "bedroom-guest";
      else if (win.room === "garden") mappedRoom = "terrace";
      else if (win.room === "pooja") mappedRoom = "study";
      return { ...win, room: mappedRoom };
    });

  // Ensure staircase field matches exactly
  plan.staircase = {
    x: staircase.x,
    y: staircase.y,
    width: staircase.width,
    height: staircase.height,
  };

  let explanation = `${inputs.lengthFt} × ${inputs.breadthFt} ft plot. Floor ${floorNumber} layout.`;
  if (inputs.vastu) {
    explanation += " Vastu aligned layout with upper floor bedrooms.";
  }
  explanation += " Staircase position matches ground floor exactly.";
  plan.explanation = explanation;

  return plan;
}

