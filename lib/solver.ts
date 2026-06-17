import { Room, Door, Window } from "./types";

export type LayoutNode =
  | {
      type: "split";
      direction: "horizontal" | "vertical";
      ratio: number; // value between 0.1 and 0.9
      children: [LayoutNode, LayoutNode];
    }
  | {
      type: "room";
      id: string;
      label: string;
    };

/**
 * Recursively solves the slicing tree to compute exact (x, y, width, height) coordinates for all rooms.
 * @param node The current node in the layout tree.
 * @param x The starting X coordinate in feet.
 * @param y The starting Y coordinate in feet.
 * @param w The width in feet.
 * @param h The height in feet.
 * @param wallThickness Spacing in feet between split tiles to represent wall thickness.
 */
export function solveLayout(
  node: LayoutNode,
  x: number,
  y: number,
  w: number,
  h: number,
  wallThickness: number = 0.4
): Room[] {
  // Base case: we reached a room node
  if (node.type === "room") {
    // Snap to 0.1 ft for clean numbers
    const rx = Math.round(x * 10) / 10;
    const ry = Math.round(y * 10) / 10;
    const rw = Math.round(w * 10) / 10;
    const rh = Math.round(h * 10) / 10;

    return [
      {
        id: node.id,
        label: node.label,
        x: rx,
        y: ry,
        width: rw,
        height: rh,
      },
    ];
  }

  // Recursive case: split node
  const rooms: Room[] = [];
  const [child1, child2] = node.children;
  const ratio = Math.max(0.05, Math.min(0.95, node.ratio));

  if (node.direction === "horizontal") {
    // Split along the X-axis (left and right)
    const targetW1 = w * ratio;
    
    // Subtract wall thickness from the boundaries
    const w1 = Math.max(1.0, targetW1 - wallThickness / 2);
    const w2 = Math.max(1.0, w - w1 - wallThickness);
    
    const x2 = x + w1 + wallThickness;

    rooms.push(...solveLayout(child1, x, y, w1, h, wallThickness));
    rooms.push(...solveLayout(child2, x2, y, w2, h, wallThickness));
  } else {
    // Split along the Y-axis (top and bottom)
    const targetH1 = h * ratio;

    // Subtract wall thickness from the boundaries
    const h1 = Math.max(1.0, targetH1 - wallThickness / 2);
    const h2 = Math.max(1.0, h - h1 - wallThickness);

    const y2 = y + h1 + wallThickness;

    rooms.push(...solveLayout(child1, x, y, w, h1, wallThickness));
    rooms.push(...solveLayout(child2, x, y2, w, h2, wallThickness));
  }

  return rooms;
}

function hasNodeId(node: LayoutNode, id: string): boolean {
  if (node.type === "room") {
    return node.id === id;
  }
  return hasNodeId(node.children[0], id) || hasNodeId(node.children[1], id);
}

/**
 * Recursively adjusts ratios in the layout tree to align a target room ID
 * with target coordinates (tx, ty, tw, th) within a parent bounding box (x, y, w, h).
 */
export function adjustTreeForFixedNode(
  node: LayoutNode,
  x: number,
  y: number,
  w: number,
  h: number,
  targetId: string,
  tx: number,
  ty: number,
  tw: number,
  th: number,
  wallThickness: number = 0.4
): LayoutNode {
  if (node.type === "room") {
    return node;
  }

  const [child1, child2] = node.children;
  const child1HasTarget = hasNodeId(child1, targetId);
  const child2HasTarget = hasNodeId(child2, targetId);

  let newRatio = node.ratio;

  if (child1HasTarget || child2HasTarget) {
    if (node.direction === "horizontal") {
      if (child1HasTarget) {
        // Target is in child1 (left). We want right boundary of child1 to match target's right edge.
        newRatio = (tx + tw - x + wallThickness / 2) / w;
      } else {
        // Target is in child2 (right). We want left boundary of child2 to match target's left edge.
        newRatio = (tx - x - wallThickness / 2) / w;
      }
    } else {
      if (child1HasTarget) {
        // Target is in child1 (top). We want bottom boundary of child1 to match target's bottom edge.
        newRatio = (ty + th - y + wallThickness / 2) / h;
      } else {
        // Target is in child2 (bottom). We want top boundary of child2 to match target's top edge.
        newRatio = (ty - y - wallThickness / 2) / h;
      }
    }
  }

  // Clamp ratio to acceptable bounds
  newRatio = Math.max(0.05, Math.min(0.95, newRatio));

  // Compute solved sizes to pass to child recursion
  let w1 = w;
  let w2 = w;
  let h1 = h;
  let h2 = h;
  let x2 = x;
  let y2 = y;

  if (node.direction === "horizontal") {
    const targetW1 = w * newRatio;
    w1 = Math.max(1.0, targetW1 - wallThickness / 2);
    w2 = Math.max(1.0, w - w1 - wallThickness);
    x2 = x + w1 + wallThickness;
  } else {
    const targetH1 = h * newRatio;
    h1 = Math.max(1.0, targetH1 - wallThickness / 2);
    h2 = Math.max(1.0, h - h1 - wallThickness);
    y2 = y + h1 + wallThickness;
  }

  const adjChild1 = adjustTreeForFixedNode(
    child1,
    x,
    y,
    node.direction === "horizontal" ? w1 : w,
    node.direction === "vertical" ? h1 : h,
    targetId,
    tx,
    ty,
    tw,
    th,
    wallThickness
  );

  const adjChild2 = adjustTreeForFixedNode(
    child2,
    node.direction === "horizontal" ? x2 : x,
    node.direction === "vertical" ? y2 : y,
    node.direction === "horizontal" ? w2 : w,
    node.direction === "vertical" ? h2 : h,
    targetId,
    tx,
    ty,
    tw,
    th,
    wallThickness
  );

  return {
    type: "split",
    direction: node.direction,
    ratio: newRatio,
    children: [adjChild1, adjChild2],
  };
}

interface SharedWall {
  wall: "top" | "bottom" | "left" | "right";
  other: Room;
  overlapStart: number;
  overlapEnd: number;
  length: number;
}

/**
 * Geometrically places doors and windows for a list of solved rooms,
 * satisfying architectural ventilation, size, and room privacy guidelines.
 */
export function generateDoorsAndWindows(
  rooms: Room[],
  plotLength: number,
  plotBreadth: number,
  roadFacing: "North" | "South" | "East" | "West",
  vastu: boolean
): { doors: Door[]; windows: Window[] } {
  const doors: Door[] = [];
  const windows: Window[] = [];

  const xCoords = rooms.map((r) => r.x);
  const yCoords = rooms.map((r) => r.y);
  const xMaxCoords = rooms.map((r) => r.x + r.width);
  const yMaxCoords = rooms.map((r) => r.y + r.height);
  const houseLeft = rooms.length > 0 ? Math.min(...xCoords) : 1.5;
  const houseRight = rooms.length > 0 ? Math.max(...xMaxCoords) : plotLength - 1.5;
  const houseTop = rooms.length > 0 ? Math.min(...yCoords) : 1.5;
  const houseBottom = rooms.length > 0 ? Math.max(...yMaxCoords) : plotBreadth - 1.5;

  const getSharedWalls = (r1: Room): SharedWall[] => {
    const shared: SharedWall[] = [];
    rooms.forEach((r2) => {
      if (r1.id === r2.id) return;

      // Check vertical boundary: r1 is left of r2
      if (Math.abs(r1.x + r1.width - r2.x) < 0.25) {
        const overlapStart = Math.max(r1.y, r2.y);
        const overlapEnd = Math.min(r1.y + r1.height, r2.y + r2.height);
        const length = overlapEnd - overlapStart;
        if (length > 1.5) {
          shared.push({ wall: "right", other: r2, overlapStart, overlapEnd, length });
        }
      }
      // Check vertical boundary: r1 is right of r2
      if (Math.abs(r1.x - (r2.x + r2.width)) < 0.25) {
        const overlapStart = Math.max(r1.y, r2.y);
        const overlapEnd = Math.min(r1.y + r1.height, r2.y + r2.height);
        const length = overlapEnd - overlapStart;
        if (length > 1.5) {
          shared.push({ wall: "left", other: r2, overlapStart, overlapEnd, length });
        }
      }
      // Check horizontal boundary: r1 is top of r2
      if (Math.abs(r1.y + r1.height - r2.y) < 0.25) {
        const overlapStart = Math.max(r1.x, r2.x);
        const overlapEnd = Math.min(r1.x + r1.width, r2.x + r2.width);
        const length = overlapEnd - overlapStart;
        if (length > 1.5) {
          shared.push({ wall: "bottom", other: r2, overlapStart, overlapEnd, length });
        }
      }
      // Check horizontal boundary: r1 is bottom of r2
      if (Math.abs(r1.y - (r2.y + r2.height)) < 0.25) {
        const overlapStart = Math.max(r1.x, r2.x);
        const overlapEnd = Math.min(r1.x + r1.width, r2.x + r2.width);
        const length = overlapEnd - overlapStart;
        if (length > 1.5) {
          shared.push({ wall: "top", other: r2, overlapStart, overlapEnd, length });
        }
      }
    });
    return shared;
  };

  const isWallExternal = (
    room: Room,
    wall: "top" | "bottom" | "left" | "right",
    shared: SharedWall[]
  ): boolean => {
    const wallsOnSide = shared.filter((s) => s.wall === wall);
    if (wallsOnSide.length === 0) return true;

    const totalOverlap = wallsOnSide.reduce((sum, s) => sum + s.length, 0);
    const wallLength = wall === "top" || wall === "bottom" ? room.width : room.height;
    return totalOverlap < wallLength * 0.8;
  };

  rooms.forEach((room) => {
    if (room.id === "staircase" || room.id === "garden" || room.id === "parking") return;

    const isLiving = room.id === "living" || room.id === "family";
    const isKitchen = room.id === "kitchen";
    const isBath = room.id.startsWith("bathroom");
    const isPooja = room.id === "pooja" || room.id === "study";

    const shared = getSharedWalls(room);

    // ─── WINDOW PLACEMENT ───
    const extWalls: ("top" | "bottom" | "left" | "right")[] = [];
    (["top", "bottom", "left", "right"] as const).forEach((w) => {
      if (isWallExternal(room, w, shared)) {
        extWalls.push(w);
      }
    });

    if (extWalls.length > 0) {
      let chosenWall = extWalls[0];
      if (isLiving) {
        let roadWallName: "top" | "bottom" | "left" | "right" = "top";
        if (roadFacing === "South") roadWallName = "bottom";
        else if (roadFacing === "East") roadWallName = "right";
        else if (roadFacing === "West") roadWallName = "left";

        if (extWalls.includes(roadWallName)) {
          chosenWall = roadWallName;
        }
      }

      const winWidth = isBath ? 2.0 : isPooja ? 2.0 : 4.0;
      const span = chosenWall === "top" || chosenWall === "bottom" ? room.width : room.height;
      const position = Math.max(0.5, Math.round(((span - winWidth) / 2) * 10) / 10);
      windows.push({ room: room.id, wall: chosenWall, position, width: winWidth });
    } else {
      const wall = "top";
      const winWidth = 3.0;
      windows.push({
        room: room.id,
        wall,
        position: Math.round(((room.width - winWidth) / 2) * 10) / 10,
        width: winWidth,
      });
    }

    // ─── DOOR PLACEMENT ───
    if (isLiving) {
      // 1. Main door facing road
      let mainWall: "top" | "bottom" | "left" | "right" = "top";
      if (roadFacing === "South") mainWall = "bottom";
      else if (roadFacing === "East") mainWall = "right";
      else if (roadFacing === "West") mainWall = "left";

      const mainDoorWidth = 3.5;
      const span = mainWall === "top" || mainWall === "bottom" ? room.width : room.height;
      
      // Rule 4: Center third, biased slightly toward staircase side
      const minCenter = span / 3;
      const maxCenter = (2 * span) / 3 - mainDoorWidth;
      const midPos = (span - mainDoorWidth) / 2;

      let mainPos = midPos;
      const staircase = rooms.find((r) => r.id === "staircase");
      if (staircase) {
        if (mainWall === "top" || mainWall === "bottom") {
          const stairCenterX = staircase.x + staircase.width / 2;
          const roomCenterX = room.x + room.width / 2;
          if (stairCenterX < roomCenterX) {
            mainPos = minCenter;
          } else {
            mainPos = maxCenter;
          }
        } else {
          const stairCenterY = staircase.y + staircase.height / 2;
          const roomCenterY = room.y + room.height / 2;
          if (stairCenterY < roomCenterY) {
            mainPos = minCenter;
          } else {
            mainPos = maxCenter;
          }
        }
      }

      // Rule 5: 2ft clearance from room corner
      mainPos = Math.max(2.0, Math.min(span - mainDoorWidth - 2.0, mainPos));
      doors.push({ room: room.id, wall: mainWall, position: Math.round(mainPos * 10) / 10, width: mainDoorWidth });

      // 2. Internal connection door
      const internalWalls = shared.filter((s) => s.other.id !== "parking" && s.other.id !== "garden");
      if (internalWalls.length > 0) {
        const prefWall =
          internalWalls.find(
            (s) =>
              s.other.id.startsWith("bedroom") ||
              s.other.id === "staircase" ||
              s.other.id === "dining" ||
              s.other.id.startsWith("bathroom")
          ) || internalWalls[0];
        const doorWidth = 3.0;
        const wallSpan = prefWall.wall === "top" || prefWall.wall === "bottom" ? room.width : room.height;
        const localStart =
          prefWall.wall === "top" || prefWall.wall === "bottom"
            ? prefWall.overlapStart - room.x
            : prefWall.overlapStart - room.y;
        const localEnd =
          prefWall.wall === "top" || prefWall.wall === "bottom"
            ? prefWall.overlapEnd - room.x
            : prefWall.overlapEnd - room.y;

        const localPos = localStart + (localEnd - localStart - doorWidth) / 2;
        
        // Rule 5: 2ft clearance
        let minPos = Math.max(localStart, 2.0);
        let maxPos = Math.min(localEnd - doorWidth, wallSpan - doorWidth - 2.0);
        
        let clampedPos = localPos;
        if (minPos <= maxPos) {
          clampedPos = Math.max(minPos, Math.min(maxPos, localPos));
        } else {
          const safeMin = Math.min(2.0, (wallSpan - doorWidth) / 2);
          const safeMax = Math.max(wallSpan - doorWidth - 2.0, (wallSpan - doorWidth) / 2);
          clampedPos = Math.max(safeMin, Math.min(safeMax, localPos));
        }

        doors.push({
          room: room.id,
          wall: prefWall.wall,
          position: Math.round(clampedPos * 10) / 10,
          width: doorWidth,
        });
      }
    } else {
      const doorWidth = isBath ? 2.5 : isPooja ? 2.0 : 3.0;

      // Rule 3: For bathrooms, place on wall shared with bedroom or corridor only
      let validShared = shared.filter((s) => {
        if (isBath) {
          const isBedroom = s.other.id.startsWith("bedroom");
          const isCorridor =
            s.other.id.includes("corridor") ||
            s.other.id.includes("passage") ||
            s.other.id.includes("lobby") ||
            s.other.id === "living" ||
            s.other.id === "family";
          return isBedroom || isCorridor;
        }
        if (isPooja && s.other.id.startsWith("bathroom")) {
          return false;
        }
        return s.other.id !== "parking" && s.other.id !== "garden";
      });

      if (isBath) {
        // Rule 3: Prefer corridor wall if both exist
        const corridorWalls = validShared.filter(
          (s) =>
            s.other.id.includes("corridor") ||
            s.other.id.includes("passage") ||
            s.other.id.includes("lobby") ||
            s.other.id === "living" ||
            s.other.id === "family"
        );
        if (corridorWalls.length > 0) {
          validShared = corridorWalls;
        } else {
          const bedroomWalls = validShared.filter((s) => s.other.id.startsWith("bedroom"));
          if (bedroomWalls.length > 0) {
            validShared = bedroomWalls;
          }
        }
      }

      if (validShared.length === 0) {
        validShared = shared;
      }

      if (validShared.length > 0) {
        let chosen = validShared.find(
          (s) =>
            s.other.id === "living" ||
            s.other.id === "family" ||
            s.other.id === "dining" ||
            s.other.id.includes("lobby") ||
            s.other.id.includes("corridor") ||
            s.other.id.includes("passage")
        );

        if (!chosen) {
          chosen = isBath
            ? validShared.find((s) => s.other.id.startsWith("bedroom")) || validShared[0]
            : validShared.find((s) => !s.other.id.startsWith("bathroom")) || validShared[0];
        }

        const wallSpan = chosen.wall === "top" || chosen.wall === "bottom" ? room.width : room.height;
        const localStart =
          chosen.wall === "top" || chosen.wall === "bottom"
            ? chosen.overlapStart - room.x
            : chosen.overlapStart - room.y;
        const localEnd =
          chosen.wall === "top" || chosen.wall === "bottom"
            ? chosen.overlapEnd - room.x
            : chosen.overlapEnd - room.y;

        let localPos = localStart + (localEnd - localStart - doorWidth) / 2;

        let minPos = localStart;
        let maxPos = localEnd - doorWidth;

        // Rule 1: Bedrooms middle third, avoiding first/last 3ft
        if (room.id.startsWith("bedroom")) {
          minPos = Math.max(minPos, wallSpan / 3, 3.0);
          maxPos = Math.min(maxPos, (2 * wallSpan) / 3 - doorWidth, wallSpan - 3.0 - doorWidth);
        }

        // Rule 2: Kitchens 2ft corner clearance, closest to dining/living
        if (room.id === "kitchen") {
          minPos = Math.max(minPos, 2.0);
          maxPos = Math.min(maxPos, wallSpan - 2.0 - doorWidth);
          if (chosen.wall === "top" || chosen.wall === "bottom") {
            if (chosen.other.x + chosen.other.width / 2 < room.x + room.width / 2) {
              localPos = minPos;
            } else {
              localPos = maxPos;
            }
          } else {
            if (chosen.other.y + chosen.other.height / 2 < room.y + room.height / 2) {
              localPos = minPos;
            } else {
              localPos = maxPos;
            }
          }
        }

        // Rule 5: 2ft corner clearance
        minPos = Math.max(minPos, 2.0);
        maxPos = Math.min(maxPos, wallSpan - 2.0 - doorWidth);

        let clampedPos = localPos;
        if (minPos <= maxPos) {
          clampedPos = Math.max(minPos, Math.min(maxPos, localPos));
        } else {
          const safeMin = Math.min(2.0, (wallSpan - doorWidth) / 2);
          const safeMax = Math.max(wallSpan - doorWidth - 2.0, (wallSpan - doorWidth) / 2);
          clampedPos = Math.max(safeMin, Math.min(safeMax, localPos));
        }

        doors.push({
          room: room.id,
          wall: chosen.wall,
          position: Math.round(clampedPos * 10) / 10,
          width: doorWidth,
        });
      } else {
        const wallSpan = room.width;
        let mainPos = (wallSpan - doorWidth) / 2;
        mainPos = Math.max(2.0, Math.min(wallSpan - doorWidth - 2.0, mainPos));
        doors.push({
          room: room.id,
          wall: "bottom",
          position: Math.round(mainPos * 10) / 10,
          width: doorWidth,
        });
      }
    }
  });

  return { doors, windows };
}

