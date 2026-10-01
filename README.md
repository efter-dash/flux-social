# FLUX · Content Production Command Centre

FLUX is a fast, keyboard-first production management platform for social media teams and solo creators. Plan content, manage stage-by-stage pipelines, track daily tasks, brainstorm ideas, log publishing analytics, and generate **100% on-device AI reports powered by local Ollama models**.

Runs entirely offline in your browser with local IndexedDB storage, or syncs across your team with Firebase.

---

## Key Features

- **Production Pipeline**: Stage-by-stage Kanban board with cycle time alerts, stalled item detection, and custom stage templates (Video, Design, Copywriting, Agency).
- **Monthly Content Calendar**: Visual schedule grid with cross-platform indicators, date filtering, and unscheduled staging area.
- **Daily Task Tracker**: Role-based assignment, priority flags, and automatic overdue calculation.
- **Content Idea Bank**: Funnel ideas from concept to approval, with 1-click promotion directly into the active production pipeline.
- **Publishing & Analytics**: Metric tracking across platforms (Instagram, YouTube, TikTok, LinkedIn, X, Substack) with automated engagement rate calculations.
- **AI Reports & Summaries (Ollama)**: 100% private, local LLM generation. Produces daily standup briefings, monthly retrospectives, and pipeline velocity audits without sending any data to external servers.
- **Desktop Ready (PWA & 1-Click Launcher)**: Install directly to your Mac Dock or run as a standalone desktop window with offline support.
- **Command Palette**: Press `⌘K` or `Ctrl+K` anywhere to jump between items, tasks, and settings instantly.

---

## Installation & Quick Start

### Prerequisites
- [Node.js](https://nodejs.org) (v18 or higher)
- [Git](https://git-scm.com) (or download the source ZIP)

---

### Option 1: 1-Click Launch on macOS (Recommended)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/efter-dash/flux-social.git
   cd flux-social
   ```
2. Double-click **`Launch-FLUX-Mac.command`** in Finder.
   - Automatically checks your environment.
   - Installs dependencies on first run.
   - Checks if your local Ollama daemon is active.
   - Launches FLUX in your default browser at `http://localhost:3000`.

*(If macOS shows a security warning on the first run, right-click `Launch-FLUX-Mac.command` → select **Open** → click **Open**).*

---

### Option 2: Standard Terminal Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/efter-dash/flux-social.git
   cd flux-social
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the local development server:**
   ```bash
   npm run dev
   ```

4. Open your browser at **`http://localhost:3000`**.

---

## Installing as a Desktop App on Mac

You can pin FLUX to your Mac Dock and run it in an independent app window without browser tabs:

### Via Google Chrome or Brave
1. Open `http://localhost:3000` (or your hosted URL).
2. Click the **Install** icon in the address bar (or click **Install App** in the FLUX header).
3. Click **Install**. FLUX is now placed in your `/Applications` folder and your Mac Dock.

### Via Safari (macOS Sonoma / Sequoia)
1. Open `http://localhost:3000` in Safari.
2. In the macOS menu bar at the top, select **File → Add to Dock…**
3. Click **Add**.

---

## Setting up Local AI Reports with Ollama

FLUX includes on-device AI reporting that connects to your local Ollama daemon at `http://127.0.0.1:11434`.

1. **Install Ollama:**
   - Download from [ollama.com/download/mac](https://ollama.com/download/mac) or install via Homebrew:
     ```bash
     brew install ollama
     ```

2. **Download a model:**
   ```bash
   ollama pull llama3.2
   ```
   *(FLUX also supports `mistral`, `qwen2.5`, `phi3`, or any model installed in Ollama).*

3. **Start Ollama with web permissions:**
   - Double-click **`Start-Ollama-Mac.command`**  
   - *Or run via Terminal:*
     ```bash
     OLLAMA_ORIGINS="*" ollama serve
     ```

4. **Verify in FLUX:**
   - Open FLUX and navigate to **Settings → Desktop & Ollama**.
   - Check that the status shows **Connected**.
   - Head to **AI Reports** in the sidebar to generate standup briefings, monthly recaps, and pipeline diagnostics.

---

## Storage & Privacy

- **Local Storage (Default)**: All workspace data, tasks, ideas, and metrics are stored locally in your browser's IndexedDB. Zero cloud accounts required, 100% private, and works offline.
- **Firebase Sync (Optional for Teams)**: If your team requires multi-user live synchronization and Google Sign-In, configure `.env` with your Firebase project credentials (`VITE_DATA_BACKEND=firestore`). See `.env.example` for details.

---

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts Vite development server on `http://localhost:3000` |
| `npm run build` | Typechecks and compiles an optimized production build into `dist/` |
| `npm run preview` | Previews the compiled production build locally |
| `npm run typecheck` | Runs TypeScript compiler checks without emitting files |
| `npm run lint` | Runs TypeScript validation |

---

## License

MIT © 2026. Free and open source for individuals and teams.
