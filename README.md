# Fatigue From the NBA Schedule: Team Performance & Injuries

A React + TypeScript web application that visualizes how NBA travel fatigue—driven by schedule density, rest days, travel distance, and time-zone strain—relates to team performance (Net Rating, Offensive/Defensive Rating) and injury burden. 

---

## Software Functionalities

The application provides the following capabilities:

### 1. **Star Player Injury Table**
- Displays **2024–25** star players (20+ PPG from `player_stats.csv`) who had significant injury spells in **2023–24**.
- Shows player name, team, injury start/end dates, days out, PPG, and injury notes.
- Intended to motivate the narrative: the NBA schedule may be contributing to high-profile injuries.

### 2. **NBA Travel Map (Interactive)**
- Renders **travel arcs** between game cities over a full season on a US map.
- **Season selector**: Choose which NBA season to view (e.g., 2023–24).
- **Team selector**: Filter to a single team’s road travel.
- **Game date slider / Play**: Reveal the schedule chronologically; **Reset** returns to the start.
- **Arc encoding**: Color indicates fatigue level (blue = low, yellow = moderate, red = high); line thickness reflects travel distance.
- **Hover tooltips**: Game details (opponent, rest, fatigue index, net rating).
- **Roster toggle**: View top players for the selected team.

### 3. **Fatigue Index by Game Chart**
- Line chart of a team’s **fatigue index** across the season (game 1–82).
- Shaded area under the line is colored by **players out (injured)** for that game: green (below league average), yellow (at average), red (above).
- Red band highlights the **worst 5-game stretch** by average fatigue.
- **Season** and **Team** dropdowns to compare years and teams.
- Table lists **average fatigue index** for all teams in the selected season.

### 4. **Fatigue vs. Performance Scatter Plot**
- Scatter visualization relating **fatigue** (or schedule strain) to **team performance** (e.g., NetRtg, ORtg, DRtg).
- Supports filtering by season and team for exploratory analysis.

### 5. **Narrative & Data Context**
- Hero section and intro text explain the project’s goal: connecting travel fatigue to efficiency metrics (NetRtg, ORtg, DRtg) and to injury/availability.
- All visualizations share a consistent dark theme and typography (IBM Plex Mono).

---

## User Instructions

### Prerequisites
- **Node.js** (v18+ recommended) and **npm** (or yarn/pnpm).

### Install and Run

1. **Clone the repository** (or download the package) and go to the project folder:
   ```bash
   cd ReactVizGeneration
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. Open the URL shown in the terminal (e.g. `http://localhost:5173`) in a browser.

### Build for Production
- **Build:** `npm run build`  
- **Preview build:** `npm run preview`

### How to Use the App

1. **Star Player Injury Table**  
   Scroll to the table below the intro. It lists star players injured in 2023–24; no interaction required.

2. **Travel Map**  
   - Use **Season** and **Team** dropdowns to pick a season and team.  
   - Use the **game date slider** or **▶ Play** to animate the season; **↩ Reset** to go back to the start.  
   - **Hover** over arcs for game details.  
   - Use **👥 Roster** to show/hide top players for the selected team.

3. **Fatigue Index by Game**  
   - Select **Season** and **Team** from the dropdowns.  
   - Read the line (fatigue over games), the shaded injury band, and the red “worst 5-game” band.  
   - Use the table below to compare average fatigue across teams.

4. **Fatigue Scatter Plot**  
   - Use the provided controls (season/team if available) to filter and explore fatigue vs. performance.

---

## Data Files (in `public/data/`)

| File | Purpose |
|------|--------|
| `team_game_master_2015-2025.csv` | Multi-season game master data. |
| `injury_data.csv` | Player injury spells (team, dates, notes). |
| `player_stats.csv` | Player stats (e.g. PPG) for star definition (2024–25). |
| `arena_coords.csv` | Arena city coordinates for the map. |
| `travel_arcs.json` | Precomputed travel arcs for the map. |
| `route.csv` | Route/travel data. |
| `states-10m.json`, `nation-10m.json` | TopoJSON for US map rendering. |

---

## Project Structure

| Path | Role |
|------|------|
| `src/App.tsx` | Root layout, theme, narrative text, and composition of all visualizations. |
| `src/main.tsx` | React app entry point. |
| `src/components/NbaTravelMap_v3.tsx` | Interactive NBA travel map (arcs, slider, roster). |
| `src/components/FatigueIndexInjuryChart.tsx` | Fatigue index line chart with injury shading and team table. |
| `src/components/FatigueScatterPlot.tsx` | Fatigue vs. performance scatter plot. |
| `src/components/StarPlayerInjuryTable.tsx` | Star player injury table (2023–24 injuries, 2024–25 stars). |
| `public/data/*` | CSV/JSON data consumed by the app. |
| `package.json` | Scripts (`dev`, `build`, `preview`) and dependencies. |

---

## Libraries Used

- **React 19** + **TypeScript** + **Vite** for the app and build.
- **D3.js v7** for all visualizations (maps, lines, scatter, axes).
- **TopoJSON** (`topojson-client`, `us-atlas`) for the US map.
- **Material UI (MUI)** for dropdowns, tables, and layout.
- **axios** for HTTP (if used for data loading).
- **lodash** for utilities.
- **usehooks-ts** for hooks (e.g. window size).

