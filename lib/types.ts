export interface PlotInputs {
  lengthFt: number;          // Plot length (feet)
  breadthFt: number;         // Plot breadth (feet)
  orientation?: "North" | "South" | "East" | "West" | "Northeast" | "Northwest" | "Southeast" | "Southwest";
  roadFacing?: "North" | "South" | "East" | "West";
  bedrooms?: number;         // 1 to 5
  bathrooms?: number;        // 1 to 4
  parking?: boolean;
  garden?: boolean;
  poojaRoom?: boolean;
  vastu?: boolean;
  style?: "modern" | "traditional" | "minimalist";
  engine: "ai" | "procedural";
  floors?: number;           // 1 to 3
  familyType?: "nuclear" | "joint";
  kitchenType?: "open" | "closed";
  servantQuarters?: boolean;
}

export interface Room {
  id: string;                // e.g. "bedroom-1", "kitchen", "staircase", "living"
  label: string;             // Display name (e.g. "Master Bedroom")
  x: number;                 // X-coordinate in feet (0 to plotLength)
  y: number;                 // Y-coordinate in feet (0 to plotBreadth)
  width: number;             // Width in feet
  height: number;            // Height in feet
}

export interface Door {
  room: string;              // Room ID
  wall: "top" | "bottom" | "left" | "right";
  position: number;          // Position in feet from the top-left of the room boundary
  width: number;             // Width in feet (default 3)
}

export interface Window {
  room: string;              // Room ID
  wall: "top" | "bottom" | "left" | "right";
  position: number;          // Position in feet from the top-left of the room boundary
  width: number;             // Width in feet (default 3)
}

export interface FloorPlan {
  floor: number;             // 0 = ground, 1 = first, 2 = second
  plotLength: number;
  plotBreadth: number;
  rooms: Room[];
  doors: Door[];
  windows: Window[];
  staircase: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  explanation: string;
  warnings?: string[];
}
