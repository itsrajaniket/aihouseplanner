import { FloorPlan } from "./types";

/**
 * Validates a generated floor plan to ensure no rooms overlap, all rooms fit within bounds,
 * and all rooms satisfy the minimum dimension, aspect ratio, and door existence guidelines.
 * Returns true if valid, false otherwise.
 */
export function validateFloorPlan(plan: FloorPlan): boolean {
  const { plotLength, plotBreadth, rooms } = plan;

  if (!rooms || rooms.length === 0) return false;

  const marginTolerance = 0.1;

  for (let i = 0; i < rooms.length; i++) {
    const r1 = rooms[i];

    // 1. Boundary check: check if room is within plot boundaries
    if (
      r1.x < 0 ||
      r1.y < 0 ||
      r1.x + r1.width > plotLength + marginTolerance ||
      r1.y + r1.height > plotBreadth + marginTolerance
    ) {
      console.warn(`Validation failed: Room "${r1.label}" (${r1.id}) exceeds plot boundaries.`, {
        room: r1,
        plot: { plotLength, plotBreadth }
      });
      return false;
    }

    // 2. Overlap check: check against all other rooms
    for (let j = i + 1; j < rooms.length; j++) {
      const r2 = rooms[j];

      // Skip overlap check for garden/parking
      if (
        r1.id === "garden" || r2.id === "garden" ||
        r1.id === "parking" || r2.id === "parking"
      ) {
        continue;
      }

      const overlapsX = r1.x < r2.x + r2.width - 0.1 && r1.x + r1.width > r2.x + 0.1;
      const overlapsY = r1.y < r2.y + r2.height - 0.1 && r1.y + r1.height > r2.y + 0.1;

      if (overlapsX && overlapsY) {
        console.warn(`Validation failed: Overlap detected between "${r1.label}" and "${r2.label}".`, {
          room1: r1,
          room2: r2
        });
        return false;
      }
    }
  }

  // 3. Minimum Room Sizes Check (Section 10)
  const isNarrow = Math.min(plotLength, plotBreadth) <= 22;
  const tol = isNarrow ? 0.55 : 0.15;

  for (const r of rooms) {
    const minDim = Math.min(r.width, r.height);
    const maxDim = Math.max(r.width, r.height);

    if (r.id.startsWith("bedroom-master")) {
      if (minDim < 11 - tol || maxDim < 12 - tol) {
        console.warn(`Validation failed: Master Bedroom size ${r.width}x${r.height} is below minimum requirement.`);
        return false;
      }
    } else if (r.id.startsWith("bedroom") && r.id !== "bedroom-guest") {
      if (minDim < 9 - tol || maxDim < 10 - tol) {
        console.warn(`Validation failed: Bedroom size ${r.width}x${r.height} is below minimum requirement.`);
        return false;
      }
    } else if (r.id === "bedroom-guest") {
      if (minDim < 7 - tol || maxDim < 9 - tol) {
        console.warn(`Validation failed: Guest Bedroom size ${r.width}x${r.height} is below minimum requirement.`);
        return false;
      }
    } else if (r.id === "kitchen") {
      if (minDim < 7 - tol || maxDim < 9 - tol) {
        console.warn(`Validation failed: Kitchen size ${r.width}x${r.height} is below minimum requirement.`);
        return false;
      }
    } else if (r.id.startsWith("bathroom")) {
      // Small powder room / WC can be down to 3.5x3.5 on narrow plots
      const bathMin = isNarrow ? 3.5 : 4.0;
      if (minDim < bathMin - 0.15 || maxDim < bathMin - 0.15) {
        console.warn(`Validation failed: Bathroom/WC size ${r.width}x${r.height} is below minimum requirement.`);
        return false;
      }
    } else if (r.id === "living" || r.id === "family") {
      if (minDim < 10 - tol || maxDim < 12 - tol) {
        console.warn(`Validation failed: Living Room size ${r.width}x${r.height} is below minimum requirement.`);
        return false;
      }
    } else if (r.id === "staircase") {
      if (minDim < 3.5 - tol || maxDim < 8 - tol) {
        console.warn(`Validation failed: Staircase size ${r.width}x${r.height} is below minimum requirement.`);
        return false;
      }
    }
  }

  // 4. Aspect Ratio Check (Section 10: length-to-width ratio <= 3:1)
  for (const r of rooms) {
    if (r.id === "garden" || r.id === "parking" || r.id === "staircase") continue;
    const ratio = Math.max(r.width / r.height, r.height / r.width);
    if (ratio > 3.05) {
      console.warn(`Validation failed: Room "${r.label}" aspect ratio ${ratio.toFixed(2)}:1 is worse than 3:1.`);
      return false;
    }
  }

  // 5. Door Existence Check (Section 2)
  for (const r of rooms) {
    if (r.id === "staircase" || r.id === "garden" || r.id === "parking") continue;
    const hasDoor = plan.doors && plan.doors.some((d) => d.room === r.id);
    if (!hasDoor) {
      console.warn(`Validation failed: Room "${r.label}" (${r.id}) has no door.`);
      return false;
    }
  }

  return true;
}
