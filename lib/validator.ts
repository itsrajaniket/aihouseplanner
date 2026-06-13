import { FloorPlan } from "./types";

/**
 * Validates a generated floor plan to ensure no rooms overlap and all rooms fit within bounds.
 * Returns true if valid, false otherwise.
 */
export function validateFloorPlan(plan: FloorPlan): boolean {
  const { plotLength, plotBreadth, rooms } = plan;

  if (!rooms || rooms.length === 0) return false;

  // Setback margin check: allow small tolerance (0.1ft)
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

      // Skip overlap check for garden/parking, as they can sometimes share edges or sit in setback margins
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

  return true;
}
