# 🏠 AI House Map Planner

![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue)
![Next.js](https://img.shields.io/badge/Framework-Next.js%2016-black)
![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS%204-teal)
![Gemini API](https://img.shields.io/badge/AI-Google%20Gemini%202.5-orange)
![License](https://img.shields.io/badge/License-Private-red)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

Instant proportional 2D house blueprint drafts with Vastu alignment and custom plot dimensions

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

AI House Map Planner is a web-based drafting tool designed specifically for Indian individual plot owners to visualize residential layouts. The application takes custom plot width and depth inputs in feet, orientation angles, and basic layout desires, producing a proportional 2D structural draft with architectural symbols like doors, window apertures, and scale indicators. It solves the costly gap between initial home ideation and architectural consultation by letting users instantly draft layouts that conform to basic Vastu Shastra orientation principles.

***This application exists to save home builders time and money by enabling rapid visual layout validation before engaging paid professional drafting services.***

---

## Live demo and visuals

The application is run locally. Below are placeholder outlines representing the visual workspace layout:

![Main Dashboard Layout](./screenshots/main_dashboard.png)
*Figure 1: Main layout generator screen showing dimensions configuration, engine switches, and coordinate canvas.*

![Multi-floor tabs navigation](./screenshots/multi_floor_view.png)
*Figure 2: Multi-floor draft view displaying the first-floor layout with locked staircase coordinates.*

> [!NOTE]
> Developers: Please replace the placeholder references in `./screenshots/` with real images of the running client layout after configuring the local setup.

---

## Tech stack and choices

| Technology | Version | Category | Why Chosen |
| :--- | :--- | :--- | :--- |
| Next.js | 16.2.9 | Core | Full-stack server side rendering capabilities permit securing sensitive Google Gemini API credentials in server-only route files. |
| React | 19.2.4 | Core | Component model separation facilitates rebuilding the visual vector canvas viewport based on state updates. |
| TypeScript | 5.x | Core | Strong typings guarantee that coordinates and room objects conform to geometric boundaries prior to execution. |
| Tailwind CSS | 4.x | Styling | Utility class styling speeds up dashboard layout modifications without writing custom external stylesheets. |
| Google Generative AI | 0.24.1 | Storage & APIs | Official SDK provider for Gemini APIs supports structured schema generation configurations natively. |
| SVG | latest | Data Viz | Native web vector graphics prevent canvas pixelation on zoom, allowing users to inspect doors and labels clearly. |
| Lucide React | 1.18.0 | Styling | Icon set containing simple vector outlines for dashboard buttons and toggles. |

---

## Core features

### Multi-floor layout generation ⭐
- **What it does**: Generates multi-level residential layouts (up to 3 floors) locking the staircase footprint from the ground floor layout.
- **User experience**: The user configures their desired number of stories in the options panel, generates the ground floor, and switches tabs to render upper stories which lazily request alignment-locked blueprints.
  - Staircase placement coordinates remain identical across all floors.
  - Upper stories swap ground-floor features like parking or kitchens for spaces like balconies and family lounges.

### High-resolution SVG/PNG exporter ⭐
- **What it does**: Exports client-side vector files and super-samples graphics onto a canvas context for PNG downloads.
- **User experience**: Users click "Export SVG" or "Export PNG" in the canvas toolbar, triggering browser file downloads containing the detailed visual room layouts and dimensions.

### Vastu Shastra layout alignment ⭐
- **What it does**: Arranges rooms according to traditional Indian directional guidelines (e.g. Master Bedroom in South-West, Kitchen in South-East).
- **User experience**: Users toggle the "Apply Vastu" switch in the form options, prompting the layout generators to prioritize placing essential spaces in their traditional quadrants.
  - A 3x3 Red grid line overlay is accessible by clicking the "Vastu Grid" button on the canvas toolbar to verify alignment.

### Adaptive room sizing guidelines
- **What it does**: Sizes room dimensions proportionally to the total plot area when dimensions are modified.
- **User experience**: The user drags range sliders to scale plot dimensions, and the layout engine automatically adjusts target bedroom and living room boundaries to fit usable setbacks.

---

## Architecture and project structure

This application uses a full-stack Next.js single-page application structure. The client frontend communicates directly with Next.js App Router API route handlers, which route coordinate generation requests to the Gemini LLM or the local rules engine, perform boundary verification, and send back layout payloads for SVG canvas rendering.

```
.
├── .env.local                  # Local environment variables including Gemini keys
├── AGENTS.md                   # Instructions and rules for assistant engines
├── CLAUDE.md                   # CLI command reference guide
├── README.md                   # Detailed technical documentation and walkthrough guide
├── eslint.config.mjs           # Code linter rules configuration
├── next.config.ts              # Next.js framework configuration
├── package.json                # Project npm package dependency listing
├── postcss.config.mjs          # Tailwind CSS style processing config
├── tailwind.config.ts          # Styling theme configurations
├── tsconfig.json               # TypeScript path compiler settings
├── app/                        # Next.js App Router container
│   ├── globals.css             # Root styles and global CSS color tokens
│   ├── layout.tsx              # Root HTML wrapper document structure
│   ├── page.tsx                # Main single-page application dashboard state controller 🌟
│   └── api/                    # Server-side API endpoints
│       └── generate/           # Sizing route
│           └── route.ts        # Next.js API handler connecting to Gemini API and validator logic
├── components/                 # React UI elements
│   ├── FloorPlanCanvas.tsx     # Canvas rendering vector elements (walls, furniture) and download actions
│   └── InputForm.tsx           # Plot details input settings panel and layout preset buttons
├── lib/                        # Common business logic modules
│   ├── generator.ts            # Procedural blueprint math rules and room placement algorithms
│   ├── types.ts                # TypeScript interface declarations
│   └── validator.ts            # Geometric layout checker testing room overlaps and plot boundaries
└── public/                     # Static static files
    ├── file.svg                # Vector file icon asset
    ├── globe.svg               # Vector globe layout asset
    ├── next.svg                # Next.js logo graphics
    └── vercel.svg              # Vercel deployment graphics
```

---

## State management and data flow

### State management
State is managed locally within the parent `Home` component in `app/page.tsx` using standard React hooks:
- `floors`: An array containing up to three `FloorPlan` objects or `null` (representing Ground, First, and Second floors).
- `activeFloor`: An integer index tracking which story is currently rendered on the canvas.
- `lockedEngine`: A state lock storing `"ai"` or `"procedural"` once generation starts, preventing mismatching layout rules.

### Data flow walkthrough — generating layout plans
1. The user configures dimension ranges and selects "Gemini AI" inside the `components/InputForm.tsx` panel.
2. Clicking the "Generate Design Plan" button triggers `handleSubmit` inside `components/InputForm.tsx`.
3. `handleSubmit` invokes the parent `onSubmit` callback, passing the form data to `handleGenerate` in `app/page.tsx`.
4. `handleGenerate` resets `floors` state to `[null, null, null]`, resets `activeFloor` to `0`, and requests the ground floor layout.
5. A POST request is fired to `/api/generate` with the body containing options and `floor: 0`.
6. The API handler in `app/api/generate/route.ts` parses the JSON body.
7. Finding a configured `GEMINI_API_KEY`, it calls `gemini-2.5-flash` model, passing the customized Vastu system guidelines and requesting a structured JSON response matching the schema.
8. Upon receiving the layout response, the handler calls `validateFloorPlan` in `lib/validator.ts` to check that no rooms overlap or exceed boundaries.
9. If validation passes, the handler responds to the client with `mode: "ai"`.
10. `handleGenerate` receives the payload, saves it to `floors[0]`, sets `lockedEngine` to `"ai"`, and updates the DOM.
11. The updated state array triggers a rerender of `components/FloorPlanCanvas.tsx`, drawing the room blocks, doors, windows, and furniture details.

---

## API reference

### Generate layout plan

Generates coordinates for rooms, doors, and windows based on plot boundaries and options.

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
- Node.js (version v18.0.0 or higher)
- npm (version v9.0.0 or higher)

### Setup steps

1. Clone the repository to your local machine:
   ```bash
   git clone https://github.com/itsrajaniket/aihouseplanner.git
   ```

2. Navigate into the project directory:
   ```bash
   cd aihouseplanner
   ```

3. Install the required NPM packages:
   ```bash
   npm install
   ```

4. Create a `.env.local` file in the root folder to store your API credentials:
   ```bash
   echo GEMINI_API_KEY=your_gemini_api_key_here > .env.local
   ```
   *(Be sure to replace `your_gemini_api_key_here` with a valid key generated from Google AI Studio)*

5. Start the local Next.js development server:
   ```bash
   npm run dev
   ```

### Verification
Open `http://localhost:3000` in your web browser. You should see the dashboard with settings on the left and a rendered drafting canvas on the right showing the default procedural plot layout.

---

## Configuration and customization

### Usable margin adjustments
To edit the outer Visual Setback Margin surrounding the rooms, open `lib/generator.ts` and modify the variable `S` on line 33:

```typescript
// Modify S value (defaults to 1.5 feet)
const S = 1.5; // Change this value to adjust the outer setback margin
```

### Minimum size bounds for rooms
To adjust the strict room dimension scaling constraints in the rules engine, modify the sizing limits in `lib/generator.ts` under the respective room assignment blocks:

```typescript
// Sizing limits in lib/generator.ts
const kitchenW = snap(clamp(uW * 0.30, 8, 12)); // Change min/max bounds (8, 12) to scale kitchen sizing
```

---

## Known limitations and troubleshooting

### Sizing overlaps under AI engine
- **Description**: The Gemini model may sometimes return coordinates that slightly overlap or exceed boundary margins.
- **Troubleshooting**: The backend automatically validates coordinates using `validateFloorPlan` inside `lib/validator.ts` and falls back to the clean procedural generator layout if overlaps are detected. Toggle the design engine back to "Instant Rules" if you require structured grid alignment.

### Common errors and solutions

| Error / Symptom | Likely Cause | Fix |
| :--- | :--- | :--- |
| `API Request Failed` message in UI | The Gemini API key is missing or invalid in `.env.local`. | Verify your Gemini API key in Google AI Studio and ensure it is saved under `GEMINI_API_KEY` in `.env.local`. |
| Coordinates do not update on slider changes | Browser JavaScript execution is halted or a React state error occurred. | Refresh the page to reset the React active states. |
| Model returns 404 on API calls | The codebase is calling a model version not associated with your API key. | Ensure `model` in `app/api/generate/route.ts` is configured to `gemini-2.5-flash` or another model supported by your key. |

---

## Security and privacy notes

- **Credential storage**: The `GEMINI_API_KEY` is loaded from a local environment file `.env.local` and processed server-side in Next.js API route handlers. It is never exposed, logged, or sent to the client browser.
- **Data tracking**: Plot size dimensions and form configurations are parsed in memory on the server. No databases are used, and no user inputs are permanently logged or sent to third-party endpoints (other than coordinates generation queries sent directly to Google Gemini APIs).

---

## Future roadmap

- [x] Multi-floor layouts locking the staircase coordinate position across floors
- [x] High-resolution SVG/PNG image export options
- [x] Visual 3x3 Vastu grid overlay guides
- [ ] Drag-and-drop room adjustments directly on the interactive SVG canvas
- [ ] FSI/FAR municipal building bye-law compliance validation calculator
- [ ] 3D visualization exporter utilizing WebGL canvas libraries
- [ ] URL-based plan sharing with unique URL generation
- [ ] PDF blueprint documentation compiler with room area legends

---

## Contributing

1. Fork the repository on GitHub.
2. Create a feature branch matching our naming rules:
   - For features: `feature/short-description`
   - For bug fixes: `fix/issue-name`
3. Commit your changes and open a Pull Request.

Contributions enhancing coordinate placement math or Vastu Shastra rules are welcome.

---

## License

This project is private and proprietary. Users are permitted to run and modify the source code locally for personal planning and visualization purposes only. Distribution, hosting, or sale of the layout code is prohibited.
