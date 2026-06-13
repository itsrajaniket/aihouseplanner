# AI Floor Plan Visualizer — Project Specification (V1)

## 1. Project Overview

A web app for Indian plot owners. The user enters basic plot details (length, breadth, optional orientation, road access, room preferences). The app generates a **proportional, visually clean 2D ground-floor layout** showing how a house could fit on that plot — purely for quick visualization/ideation, **not construction-ready**.

**Target audience:** Indian individual plot owners (Tier 2/3 cities especially), thinking in feet, familiar with terms like "30x40 site," "G+1," Vastu, "pooja room," etc.

**Scope for V1:** Ground floor only. Architecture should be designed so multi-floor support (with a locked staircase position carried across floors) can be added later without restructuring.

---

## 2. Tech Stack

- **Framework:** Next.js 14+ (App Router), React, TypeScript
- **Styling:** Tailwind CSS
- **Rendering:** SVG (no canvas, no three.js, no AI image generation for the floor plan itself)
- **Backend:** Next.js API routes (`/api/generate-layout`)
- **LLM:** Gemini API (or Claude API) called server-side from the API route — never expose API keys client-side
- **No database for V1** — fully stateless, one request → one response

---

## 3. User Flow

1. User lands on `/` — fills out a form (required + optional fields, see below)
2. Submit → POST to `/api/generate-layout`
3. Backend runs rule engine → builds room zone list → calls LLM to refine arrangement + apply Vastu/orientation logic → returns structured JSON
4. Frontend (`/result`) renders that JSON as an SVG floor plan with labeled rooms, walls, doors, North arrow (if orientation given), road indicator (if road side given), plus a short text explanation
5. User can click "Regenerate" (re-runs generation, may get a layout variation) or "Download as SVG/PNG"

---

## 4. Input Form Fields

### Required
- **Plot length (ft)** — number input
- **Plot breadth (ft)** — number input

### Optional (in a collapsible "Customize your home" section)
- **Orientation / front-facing direction** — dropdown: N, S, E, W, NE, NW, SE, SW
- **Front road access side** — dropdown: same 8 directions (which edge of the plot faces the road)
- **Number of floors desired** — for V1, lock to "Ground floor only" but keep the field in the UI as disabled/"coming soon" so the UI doesn't need rework later
- **Number of bedrooms** — number input (1-6)
- **Number of bathrooms** — number input (1-4)
- **Parking/garage required** — yes/no toggle
- **Garden/open space preference** — yes/no toggle, optional % of plot
- **Style preference** — dropdown: Modern, Traditional, Minimal (affects only labels/colors/explanation text in V1, not geometry)
- **Vastu preference** — yes/no toggle

### Default Behavior When Optional Fields Are Empty
Apply sensible defaults based on plot area (length × breadth):
- Area < 1000 sqft → 2 bedrooms, 1-2 bathrooms
- Area 1000-1800 sqft → 3 bedrooms, 2 bathrooms
- Area > 1800 sqft → 3-4 bedrooms, 2-3 bathrooms
- Parking: default "yes" if breadth ≥ 25 ft (enough room for a driveway), else "no"
- Garden: default "yes" with ~10% of plot if area > 1200 sqft, else "no"
- Vastu: default "no" (don't assume)
- Orientation/road side: if not given, skip North arrow and road indicator in rendering; layout proceeds without directional bias

---

## 5. Backend Logic — Hybrid (Rule Engine + LLM)

### Step 1: Rule Engine (deterministic, written in plain TypeScript, runs first — no AI call)

Given plot length × breadth:

1. Apply a flat visual margin (e.g., 1.5 ft on all sides) — purely cosmetic, **not** a legal setback calculation. Remaining area = "usable area."
2. Determine room list and approximate area per room using these standard Indian residential size ranges:
   - Master bedroom: 140-180 sqft
   - Other bedrooms: 100-140 sqft
   - Living/dining (often combined): 150-250 sqft
   - Kitchen: 80-120 sqft
   - Bathroom: 30-45 sqft
   - Staircase: fixed footprint ~4 ft x 9 ft (~36 sqft)
   - Parking (if applicable): allocate near the road-facing edge, sized based on available frontage (e.g., 10ft x 18ft for one car)
   - Pooja room (if Vastu = yes): small, ~20-30 sqft
3. Sum room areas; scale all room areas proportionally so total fits within usable area (with ~5-10% slack for circulation/corridors)
4. Output a flat list of "zones" — each zone has a name and a target width/height (not yet positioned)

This step guarantees the output is always proportionally valid for the given plot, regardless of what the LLM does next.

### Step 2: LLM Call (arrangement + Vastu + explanation)

Send the rule engine's zone list + user inputs to the LLM with a prompt that asks it to:
- Arrange each zone into an (x, y) position within the plot bounds (top-left origin, x→right, y→down, units in feet)
- Respect plot boundaries — no room may extend outside `0 ≤ x, y` and `x+width ≤ length`, `y+height ≤ breadth`
- If orientation/road side given: place entrance/living room near the road-facing edge
- If Vastu = yes: apply standard directional preferences as soft constraints:
  - Pooja room → North-East
  - Kitchen → South-East
  - Master bedroom → South-West
  - Main entrance → North, East, or North-East depending on plot orientation
  - Staircase → South or West, avoiding the center of the plot
- Place the staircase as a single fixed-footprint zone — its position must be recorded explicitly in the output (for future multi-floor reuse)
- Add door positions for each room (which wall edge, and position along that edge)
- Write a 2-3 sentence explanation of the layout choices (mention Vastu reasoning if applicable)

**Instruct the LLM to return ONLY valid JSON, no markdown formatting, no commentary outside the JSON.**

### Step 3: Output JSON Schema

```json
{
  "plot": { "length": 30, "breadth": 40 },
  "rooms": [
    { "name": "Living Room", "x": 1.5, "y": 1.5, "width": 14, "height": 16 },
    { "name": "Kitchen", "x": 16, "y": 1.5, "width": 10, "height": 10 },
    { "name": "Bedroom 1", "x": 1.5, "y": 18, "width": 12, "height": 12 },
    { "name": "Bathroom 1", "x": 14, "y": 18, "width": 6, "height": 7 }
  ],
  "doors": [
    { "room": "Living Room", "wall": "bottom", "position": 6, "width": 3 }
  ],
  "staircase": { "x": 26, "y": 1.5, "width": 4, "height": 9 },
  "explanation": "Short text explaining the layout and any Vastu reasoning."
}
```

- `wall` is one of `top`, `bottom`, `left`, `right` (relative to the room's own rectangle)
- `position` = distance in feet from the room's top-left corner along that wall, where the door gap begins
- `staircase` is always present in the output (also appears in `rooms` for rendering, but stored separately so V2 can reuse its exact coordinates for upper floors)

### Step 4: Backend Validation (before returning to frontend)
- Check no room rectangle exceeds plot bounds
- Check no two rooms overlap (basic AABB overlap check)
- If the LLM output fails validation, fall back to a simple rule-based grid layout (rows of rooms sized proportionally) so the user always gets *some* valid result — never show an error for a failed layout

---

## 6. Frontend Rendering (SVG Component)

- `viewBox="0 0 {length*10} {breadth*10}"` — 1 ft = 10 SVG units, so the SVG is always proportional to the real plot ratio
- Outer plot boundary: `<rect>` with thick stroke (e.g., `stroke-width: 4`, dark color)
- Each room: `<rect>` with:
  - Light pastel fill, different color per room type (e.g., bedrooms = soft blue, kitchen = soft yellow, living room = soft green, bathroom = light gray, staircase = light brown)
  - Black/dark stroke for walls (`stroke-width: 2`)
- Each room label: `<text>` centered in the rect, two lines — room name, then dimensions (e.g., `Bedroom 1` / `12' x 12'`)
- Doors: draw as a gap in the wall line (don't draw the wall segment at the door's position) plus a quarter-circle `<path>` arc to represent the door swing — standard architectural symbol
- If orientation is provided: draw a North arrow icon in a corner of the SVG (simple arrow + "N" label)
- If road access side is provided: draw a gray rectangular strip just outside the plot boundary on that edge, labeled "Road"
- Below the SVG: display the `explanation` text from the JSON response

---

## 7. Page & File Structure

```
/app
  page.tsx                       → input form (landing page)
  result/page.tsx                → displays generated floor plan + explanation
  api/generate-layout/route.ts   → POST endpoint: rule engine + LLM call + validation

/components
  FloorPlanForm.tsx               → the input form, required + collapsible optional section
  FloorPlanSVG.tsx                → takes layout JSON as prop, renders SVG

/lib
  ruleEngine.ts                   → room sizing/zoning logic (Step 1)
  llmPrompt.ts                    → builds the LLM prompt + parses/validates response (Steps 2-4)
  vastuRules.ts                   → directional placement preference constants
  validateLayout.ts               → bounds/overlap checks + fallback grid layout generator

/types
  layout.ts                       → shared TypeScript types for the JSON schema in Section 5
```

---

## 8. Buttons / Actions on Result Page

- **Regenerate** — re-POST the same form inputs to `/api/generate-layout`; LLM may produce a different valid arrangement (encourage variation in the prompt, e.g., "produce a layout different from a simple grid")
- **Download as SVG** — serialize the rendered SVG element and trigger a file download
- **Download as PNG** — render SVG to canvas client-side, then export as PNG
- **Edit inputs** — link back to `/` with form pre-filled (pass inputs via query params or simple client state)

---

## 9. Explicit Non-Goals for V1 (do not build these now)

- No multi-floor generation (but keep `staircase` as a separate field in the schema so it's reusable later)
- No legal/byelaw setback calculations, FSI/FAR compliance, or structural (load-bearing wall) logic
- No 3D/isometric views
- No user accounts, saved projects, or database
- No AI-generated images (Dzine/Midjourney-style) — SVG only
- No payment/subscription logic

---

## 10. Vastu Placement Reference (for `vastuRules.ts`)

Use as soft constraints only when `vastu = true`:

| Room | Preferred Direction |
|---|---|
| Pooja/prayer room | North-East |
| Kitchen | South-East |
| Master bedroom | South-West |
| Main entrance | North, East, or North-East |
| Staircase | South or West |
| Bathroom | West or North-West (avoid North-East) |
| Living room | North or East |

If a preferred direction conflicts with available space (e.g., plot too small or road access forces entrance elsewhere), the LLM should prioritize fitting all rooms within bounds first, then apply Vastu directions as best-effort, and mention any compromises in the `explanation` text.

---

## 11. Acceptance Criteria for V1

- [ ] Form accepts required (length, breadth) and optional fields, with collapsible "Customize" section
- [ ] Submitting with only length/breadth produces a valid, proportional floor plan using smart defaults
- [ ] Submitting with all optional fields filled customizes room count, parking, garden, Vastu placement, etc.
- [ ] SVG floor plan is always proportional to the real length:breadth ratio
- [ ] All rooms render with labels, dimensions, and door symbols; no rooms overlap or exceed plot bounds
- [ ] North arrow and road indicator appear only when orientation/road side are provided
- [ ] "Regenerate" produces a different (but still valid) layout
- [ ] Download as SVG and PNG both work
- [ ] If LLM call fails or returns invalid JSON, fallback grid layout is shown instead of an error
