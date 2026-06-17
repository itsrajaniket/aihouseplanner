# 🏠 AI house map planner

![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue)
![Next.js](https://img.shields.io/badge/Framework-Next.js%2016-black)
![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS%204-teal)
![Gemini API](https://img.shields.io/badge/AI-Google%20Gemini%202.5-orange)
![License](https://img.shields.io/badge/License-Private-red)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

Proportional residential 2D floor plan generation with structural staircase vertical locking and Vastu Shastra orientation rules

---

## Table of contents

- [Project overview](#project-overview)
- [Live demo and visuals](#live-demo-and-visuals)
- [Tech stack and choices](#tech-stack-and-choices)
- [Core features](#core-features)
- [Architecture and project structure](#architecture-and-project-structure)
- [State management and data flow](#state-management-and-data-flow)
- [API reference](#api-reference)
- [Local installation and setup](#local-installation-and-setup)
- [Configuration and customization](#configuration-and-customization)
- [Known limitations and troubleshooting](#known-limitations-and-troubleshooting)
- [Security and privacy notes](#security-and-privacy-notes)
- [Future roadmap](#future-roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Project overview

AI house map planner is a web-based layout drafting tool designed for individual plot owners to visualize proportional residential floor plans. The application maps custom plot widths and depths in feet alongside orientation directions, producing architectural drawings with door placements, window apertures, and scale indicators. It addresses the cost overhead and design friction of early-stage home building by enabling users to iterate on draft layouts that conform to traditional Vastu Shastra guidelines before hiring drafting professionals.

***This application serves as an instant structural plan visualizer that accelerates early layout validation for homebuilders, mitigating architectural design iterations and overhead costs.***

---

## Live demo and visuals

This application runs locally. The following graphics represent the dashboard panels and canvas interface of the editor:

![Main dashboard workspace](./screenshots/dashboard_layout.png)
*Figure 1: Main layout generator screen showing dimensions configuration, engine switches, and coordinate canvas.*

![Multi-floor editor canvas](./screenshots/multi_floor_editor.png)
*Figure 2: Multi-floor draft view displaying the first-floor layout with locked staircase coordinates.*

> [!NOTE]
> Developers: Replace the placeholder references in the `./screenshots/` directory with actual screenshots of your running application once you have completed the local installation.

To run and see the application locally, execute the development command:
```bash
npm run dev
```
Then navigate to `http://localhost:3000` in your web browser.

---

## Tech stack and choices

| Technology | Version | Category | Why Chosen |
| :--- | :--- | :--- | :--- |
| Next.js | 16.2.9 | Core | Executes API endpoints server-side to prevent exposing the Google Generative AI credentials to the client browser. |
| React | 19.2.4 | Core | Performs differential DOM rendering to sync the interactive canvas coordinate state shifts efficiently. |
| TypeScript | 5.x | Core | Imposes static type safety over layout shapes, coordinate arrays, and user options to eliminate runtime reference errors. |
| Tailwind CSS | 4.x | Styling | Compiles a minimized single CSS bundle containing styling utility classes, reducing the total document weight. |
| Google Generative AI | 0.24.1 | Storage & APIs | Provides the official SDK to connect Next.js routes to the Gemini API, supporting structured JSON schema responses. |
| SVG | latest | Data Viz | Renders top-down orthogonal lines, doors, and furniture symbols natively in the browser without resolution loss during canvas scaling. |
| Lucide React | 1.18.0 | Styling | Imports lightweight SVG icon elements dynamically, facilitating layout indicators and action buttons. |
| ESLint | 9.x | Dev Tools | Enforces code standards and formatting conventions during pre-commit checks, catching unused imports and variables. |

---

## Core features

### Multi-floor layout generation ⭐
- **What it does**: Generates vertically-aligned multi-story blueprints (up to 3 levels) locking the staircase footprint.
- **User experience**: Users choose the number of stories via the settings panel, design the ground level, and swap tabs to lazily construct subsequent stories with locked staircase boundaries.
  - Staircase coordinates are shared and remain fixed across all floors to maintain structural vertical alignment.
  - Floor transitions dynamically swap ground-level zones like parking and main kitchens for balconies and lounges on upper levels.

### High-resolution SVG/PNG exporter ⭐
- **What it does**: Compiles client-side vector files and super-samples graphics onto a canvas context for PNG downloads.
- **User experience**: Users click the download toolbar buttons to retrieve scalable vector or high-resolution raster plan files.
  - SVG export packages the canvas node into a standalone XML vector file containing styles.
  - PNG export draws elements onto an offscreen canvas at a 4x resolution scale factor, outputting sharp raster graphics.

### Vastu Shastra layout alignment ⭐
- **What it does**: Applies traditional orientation guidelines to quadrant calculations for room and door offsets.
- **User experience**: Users enable the guidelines switch to prioritize positioning master bedrooms in the southwest and kitchens in the southeast, with a toggleable 3x3 overlay grid for verification.
  - Vastu orientation coordinates align according to the cardinal direction facing the main access road.
  - Built-in grid overlay allows structural inspection of quadrant alignments in real time.

### Adaptive room sizing & dropping ⭐
- **What it does**: Adjusts room footprint calculations dynamically based on plot dimensions. If total minimum required area exceeds 90% of usable plot area, it recursively drops rooms by priority (pooja → servant quarters → extra bathroom → bedroom 3 → parking → bedroom 2 → garden) *before* partitioning the layout tree.
- **User experience**: Standard dimension sliders automatically adapt, preventing invalid overlapping layout configurations on tight plots.

### Proportional CAD rendering & dynamic labels ⭐
- **What it does**: Uses area-based scaling factor parameters (<80, <120, <180 sq ft) and a position clamp helper (`clampedRect`) to prevent furniture symbols from overlapping walls. Adapts text size dynamically and abbrevates labels (e.g. `"MB"`, `"WC"`, `"K"`) in narrow room cells.
- **User experience**: Blueprint drawings look highly professional, clear, and clean on any monitor size or screen resolution.

### Door & window geometry constraints
- **What it does**: Automatically computes door/window apertures. Places bedroom doors in the middle third only (avoiding headboards), kitchen doors away from counters, and bathroom doors on corridor/bedroom walls only.
- **User experience**: Door swing arcs automatically orient to rest flat against adjacent corners, and use SVG `<clipPath>` masks to avoid wall collisions. Tight layouts automatically fallback to dashed sliding indicators with `"↔"` text markers.

### Strict validation pipeline
- **What it does**: Evaluates layout plans against a strict flat `0.3` ft sizing tolerance. Verifies Ground Floor corridor existence for plots > 600 sqft and returns validation failures if a bathroom door shares a wall directly with a kitchen or dining room.

---

## Architecture and project structure

The application is structured as a client-server single-page Next.js web application. The React client captures plot parameters and forwards them via POST requests to the API route handler, which determines if layout generation should run locally via procedural math rule files or server-side via Gemini API calls, validating all coordinates before returning the payload.

```
.
├── .env.local                  # Local environment variables including Gemini API key
├── AGENTS.md                   # Instructions and rules for assistant engines
├── CLAUDE.md                   # Reference commands list
├── eslint.config.mjs           # Code linter rules configuration
├── next-env.d.ts               # Next.js TypeScript declarations
├── next.config.ts              # Next.js compilation settings
├── package.json                # Project dependencies and runner scripts
├── postcss.config.mjs          # CSS post-processing rules
├── README.md                   # Technical documentation and project walkthrough guide
├── tsconfig.json               # TypeScript compiler config
├── app/                        # Next.js App Router root directory
│   ├── favicon.ico             # Browser tab icon asset
│   ├── globals.css             # Base CSS styles and theme variables
│   ├── layout.tsx              # Root HTML layout container
│   ├── page.tsx                # Main application dashboard controller managing reactive floor states 🌟
│   └── api/                    # API route handlers
│       └── generate/           # Sizing route
│           └── route.ts        # Next.js POST handler calling Gemini or local generators and validating plans
├── components/                 # React user interface components
│   ├── FloorPlanCanvas.tsx     # Canvas rendering vector elements, Vastu grid lines, and download actions
│   └── InputForm.tsx           # Settings panel containing plot configuration sliders and presets
├── lib/                        # Math libraries and verification utilities
│   ├── generator.ts            # Procedural math layouts for ground and upper levels with staircase locks
│   ├── types.ts                # Shared TypeScript structures for PlotInputs, Room, Door, and FloorPlan
│   └── validator.ts            # Geometric room overlap and plot boundary constraint evaluator
└── public/                     # Static assets directory
    ├── file.svg                # File logo indicator
    ├── globe.svg               # Web globe icon
    ├── next.svg                # Next.js logo
    ├── vercel.svg              # Vercel deployment logo
    └── window.svg              # Window logo indicator
```

---

## State management and data flow

### State management

State is centralized in the parent component [app/page.tsx](file:///c:/Users/ANIKET/Desktop/Aihouseplan/app/page.tsx) using React hooks. The application state stores inputs, floor plans, the current floor tab, loading states, and the locked engine type. This guarantees that coordinate updates immediately propagate to the canvas drawing interface.

- `floors`: An array containing up to three [FloorPlan](file:///c:/Users/ANIKET/Desktop/Aihouseplan/lib/types.ts) objects or `null` representing ground, first, and second floors.
- `activeFloor`: An integer index tracking the active layout level rendered on the canvas view.
- `lockedEngine`: A state lock storing `"ai"` or `"procedural"` once generation starts, preventing mismatching layout rules.

### Data flow walkthrough — generating layout plans

1. The user selects plot dimensions and orientation inputs in [components/InputForm.tsx](file:///c:/Users/ANIKET/Desktop/Aihouseplan/components/InputForm.tsx) and clicks the generation action button, calling [handleSubmit](file:///c:/Users/ANIKET/Desktop/Aihouseplan/components/InputForm.tsx).
2. [handleSubmit](file:///c:/Users/ANIKET/Desktop/Aihouseplan/components/InputForm.tsx) triggers the callback prop `onSubmit`, forwarding a [PlotInputs](file:///c:/Users/ANIKET/Desktop/Aihouseplan/lib/types.ts) object to [handleGenerate](file:///c:/Users/ANIKET/Desktop/Aihouseplan/app/page.tsx) in [app/page.tsx](file:///c:/Users/ANIKET/Desktop/Aihouseplan/app/page.tsx).
3. [handleGenerate](file:///c:/Users/ANIKET/Desktop/Aihouseplan/app/page.tsx) updates the `isLoading` state to true, clears the `floors` state array to `[null, null, null]`, resets `activeFloor` to `0`, and triggers a POST request to the server route `/api/generate` with the parameters and `floor: 0`.
4. The handler inside [app/api/generate/route.ts](file:///c:/Users/ANIKET/Desktop/Aihouseplan/app/api/generate/route.ts) parses the JSON payload.
5. If the request calls for the procedural engine or lacks a `GEMINI_API_KEY` environment variable, the handler invokes [generateLocalLayout](file:///c:/Users/ANIKET/Desktop/Aihouseplan/lib/generator.ts) inside [lib/generator.ts](file:///c:/Users/ANIKET/Desktop/Aihouseplan/lib/generator.ts).
6. If the request calls for the AI engine, the handler initializes `GoogleGenerativeAI`, connects to the `gemini-2.5-flash` model, passes the system prompt configurations enforcing the schema, and extracts the generated JSON coordinates.
7. The coordinates are parsed and evaluated by [validateFloorPlan](file:///c:/Users/ANIKET/Desktop/Aihouseplan/lib/validator.ts) in [lib/validator.ts](file:///c:/Users/ANIKET/Desktop/Aihouseplan/lib/validator.ts).
8. If validation fails, the handler falls back to procedural rules by calling [generateLocalLayout](file:///c:/Users/ANIKET/Desktop/Aihouseplan/lib/generator.ts). If it passes, it returns the generated JSON array.
9. [handleGenerate](file:///c:/Users/ANIKET/Desktop/Aihouseplan/app/page.tsx) updates the `floors` state array with the new floor coordinates, locks the generator engine state, and resets `isLoading` to false.
10. The updated `floors` state triggers a canvas redraw inside [components/FloorPlanCanvas.tsx](file:///c:/Users/ANIKET/Desktop/Aihouseplan/components/FloorPlanCanvas.tsx).

---

## API reference

### Generate layout plan

Generates coordinates for rooms, doors, and windows based on plot size, orientation, and engine requirements.

- **Method**: `POST`
- **Endpoint**: `/api/generate`
- **Request headers**: `Content-Type: application/json`
- **Request body**:
```json
{
  "lengthFt": 30,
  "breadthFt": 40,
  "orientation": "North",
  "roadFacing": "North",
  "bedrooms": 2,
  "bathrooms": 2,
  "parking": true,
  "garden": false,
  "poojaRoom": true,
  "vastu": true,
  "style": "modern",
  "engine": "ai",
  "floors": 2,
  "familyType": "nuclear",
  "kitchenType": "closed",
  "servantQuarters": false,
  "floor": 0,
  "staircase": null
}
```
- **Response body (200 OK)**:
```json
{
  "success": true,
  "layout": {
    "floor": 0,
    "plotLength": 30,
    "plotBreadth": 40,
    "rooms": [
      { "id": "living", "label": "Living Room", "x": 1.5, "y": 1.5, "width": 14, "height": 16 },
      { "id": "kitchen", "label": "Kitchen", "x": 16, "y": 1.5, "width": 10, "height": 10 },
      { "id": "bedroom-master", "label": "Master Bedroom", "x": 1.5, "y": 18, "width": 12, "height": 12 },
      { "id": "staircase", "label": "Staircase", "x": 26, "y": 1.5, "width": 4, "height": 9 }
    ],
    "doors": [
      { "room": "living", "wall": "bottom", "position": 6, "width": 3 }
    ],
    "windows": [],
    "staircase": { "x": 26, "y": 1.5, "width": 4, "height": 9 },
    "explanation": "Modern open-style layouts with the kitchen in the Southeast corner."
  },
  "mode": "ai"
}
```

---

## Local installation and setup

### Prerequisites

- Node.js version 18.0.0 or higher
- npm version 9.0.0 or higher

### Setup steps

1. Clone the project files:
   ```bash
   git clone https://github.com/itsrajaniket/aihouseplanner.git
   ```

2. Navigate to the project root directory:
   ```bash
   cd aihouseplanner
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create a `.env.local` file inside the root folder:
   ```bash
   echo GEMINI_API_KEY=your_gemini_api_key_here > .env.local
   ```

### Environment variables

For connection to the AI engine model endpoints, you must save your developer credentials:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### Running in development

To execute the project in development mode:
```bash
npm run dev
```

### Running in production

To build and run the optimized application bundle:
```bash
npm run build
```
```bash
npm run start
```

### Verification

Open `http://localhost:3000` in your web browser. You should see the user settings panel and canvas, showing the initial layout blueprint rendered.

---

## Configuration and customization

### Usable margin adjustments

To modify the outer setback margin surrounding the rooms, open [lib/generator.ts](file:///c:/Users/ANIKET/Desktop/Aihouseplan/lib/generator.ts) and edit the setback `S` defined inside `checkGeometry` and `generateLocalLayout` (default is `0.5` ft for narrow plots <= 22 ft and `1.5` ft for wide plots):
```typescript
const S = W <= 22 ? 0.5 : 1.5;
```

### Minimum size bounds for rooms

To adjust baseline room sizing dimensions, edit the minimum width and height values in the `getMinArea` function inside [lib/generator.ts](file:///c:/Users/ANIKET/Desktop/Aihouseplan/lib/generator.ts) and their validation counterparts inside `validateFloorPlan` in [lib/validator.ts](file:///c:/Users/ANIKET/Desktop/Aihouseplan/lib/validator.ts) (e.g. Master Bedroom: 11x12 ft, Kitchen: 7x9 ft, Bathroom: 4x6 ft, Staircase: 3.5x8 ft).

### SVG scale unit configurations

To alter the SVG canvas scaling factor, edit the constant inside [components/FloorPlanCanvas.tsx](file:///c:/Users/ANIKET/Desktop/Aihouseplan/components/FloorPlanCanvas.tsx):
```typescript
// Change coordinates scale units calculation (default 20 SVG units = 1 foot)
const SC = 20;
```

---

## Known limitations and troubleshooting

### Known limitations

- **Predefined set of rooms**: The generator coordinates layout positions for fixed room identifiers (e.g. `living`, `kitchen`, `bedroom-master`, `staircase`) and does not support arbitrary custom labels.
- **Staircase placement lock**: While upper levels lock staircase coordinates vertically to prevent structure mismatches, the initial staircase placement on the ground level is set dynamically by the algorithm and cannot be dragged manually.
- **Floating point rounding offsets**: Snapping math rounding coordinates to 0.5 ft increments can shift room coordinates by up to 0.1 ft, occasionally triggering boundary validation alerts under AI engine layout models.
- **Orthogonal 2D layout constraints**: Layout outlines are limited to orthogonal 2D dimensions and do not calculate wall thickness, foundation structure beams, plumbing channels, or 3D elevations.

### Common errors and solutions

| Error / Symptom | Likely Cause | Fix |
| :--- | :--- | :--- |
| `API Request Failed` warning in UI dashboard | The Gemini API key is missing or invalid in the environment file. | Create `.env.local` in the project root and add `GEMINI_API_KEY=your_gemini_api_key_here` with a valid key. |
| Upper floor layouts mismatch ground floor staircase positions | Generating subsequent floor levels before the ground floor has completed processing or switching design engine mid-session. | Generate the ground floor first. The UI locks the engine selector option once the design session begins. |
| Rendered room text labels are too small or overlap boundaries | Viewport scaling constraints squeeze SVG text dimensions on small screen sizes. | View the blueprint using the built-in fullscreen modal to expand canvas dimensions. |
| PNG layout exports are blurry or pixelated | Downloading raw screen viewport scaling sizes without canvas resolution rendering. | Use the export PNG button on the canvas toolbar which uses a `4x` scale factor to output high-resolution graphics. |

---

## Security and privacy notes

- **Credential storage**: The `GEMINI_API_KEY` is loaded from a local environment file `.env.local` and processed server-side in Next.js API route handlers. It is never exposed, logged, or sent to the client browser.
- **Data storage & tracking**: No user configuration inputs, plot sizes, or layout calculations are stored in databases. All configurations are handled in-memory and discarded upon closing the tab session. No analytics tracking code is active in the codebase.
- **Third-party transmission**: Generating layout coordinates via the AI engine sends plot boundaries, selected rooms, and style choices directly to Google Gemini API servers.
- **API limits warning**: Under heavy rate-limiting on Gemini developer API keys, the application automatically falls back to local rules-based procedural layouts ([lib/generator.ts](file:///c:/Users/ANIKET/Desktop/Aihouseplan/lib/generator.ts)) to ensure the workspace remains responsive.

---

## Future roadmap

- [x] Integrate multi-floor tabs supporting up to 3 stories with locked staircase coordinates
- [x] Implement client-side high-resolution PNG canvas exporter with super-sampling
- [x] Add visual Vastu grid guide lines overlay toggle in canvas workspace
- [ ] Add interactive drag-and-drop room sizing handlers directly on the canvas SVG element
- [ ] Create structural columns and plumbing stack layout recommendation markers
- [ ] Add a municipal FAR (Floor Area Ratio) compliance checking calculator panel
- [ ] Integrate 3D visualization model views utilizing Three.js or WebGL canvas renderers

---

## Contributing

1. Fork the repository on GitHub.
2. Create your feature branch following the naming convention:
   - For new features: `feature/short-description`
   - For bug fixes: `fix/issue-name`
3. Commit your changes with clear messages.
4. Submit a Pull Request to the main branch.

Contributions enhancing layout coordinate mathematical algorithms or Vastu compliance guidelines are welcome.

---

## License

This project is private and proprietary. Users are permitted to run and modify the source code locally for personal planning and visualization purposes only. Distribution, hosting, or sale of the layout code is prohibited.
