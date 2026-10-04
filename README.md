# FLUX · Content Production Command Centre

FLUX is a fast, keyboard-first production management platform for social media teams and solo creators. Plan content, manage stage-by-stage pipelines, track daily tasks, brainstorm ideas, log publishing analytics, and generate **100% on-device AI reports powered by local Ollama models**.

Runs entirely offline in your browser with local IndexedDB storage, or syncs across your team with Firebase.

---

## 📺 Product Overview & Demo

[![Watch the FLUX Trailer](https://img.youtube.com/vi/0XSkavVru00/maxresdefault.jpg)](https://youtu.be/0XSkavVru00)

> ▶️ **[Click to Watch the FLUX Trailer on YouTube](https://youtu.be/0XSkavVru00)** — A complete walkthrough of the pipeline board, monthly calendar, task tracker, and local Ollama AI reports.

---

## Key Features

- **Production Pipeline**: Stage-by-stage Kanban board with cycle time alerts, stalled item detection, and custom stage templates (Video, Design, Copywriting, Agency).
- **Monthly Content Calendar**: Visual schedule grid with cross-platform indicators, date filtering, and unscheduled staging area.
- **Daily Task Tracker**: Role-based assignment, priority flags, and automatic overdue calculation.
- **Content Idea Bank**: Funnel ideas from concept to approval, with 1-click promotion directly into the active production pipeline.
- **Publishing & Analytics**: Metric tracking across platforms (Instagram, YouTube, TikTok, LinkedIn, X, Substack) with automated engagement rate calculations.
- **AI Reports & Summaries (Ollama)**: 100% private, local LLM generation. Produces daily standup briefings, monthly retrospectives, and pipeline velocity audits without sending any data to external servers.
- **Desktop Ready (PWA & 1-Click Launchers)**: Run as a standalone desktop window on macOS, Windows, and Linux with full offline support.
- **Command Palette**: Press `⌘K` or `Ctrl+K` anywhere to jump between items, tasks, and settings instantly.

---

## Installation & Quick Start

### 🎥 Step-by-Step Video Guide: How to Install FLUX

[![How to Install FLUX](https://img.youtube.com/vi/gaE3bCCqc-0/maxresdefault.jpg)](https://youtu.be/gaE3bCCqc-0)

> ▶️ **[Click to Watch the Step-by-Step Installation Video on YouTube](https://youtu.be/gaE3bCCqc-0)** — Complete guide on cloning, installing dependencies, and launching FLUX with desktop shortcuts.

---

### Prerequisites
- [Node.js](https://nodejs.org) (v18 or higher — download the recommended LTS installer for your OS)
- [Git](https://git-scm.com) (or download the source ZIP)

---

### Option 1: 1-Click Launchers (Zero Terminal Commands Required)

#### On Windows:
1. Clone or download this repository (extract if downloaded as a `.zip`).
2. Double-click **`Launch-FLUX-Windows.bat`**.
   - Verifies your Node.js installation.
   - Automatically installs dependencies (`npm install`) on first run.
   - Checks if local Ollama is active.
   - Starts the server and opens FLUX in your default browser at `http://localhost:3000`.

#### On macOS:
1. Clone or download this repository.
2. Double-click **`Launch-FLUX-Mac.command`** in Finder.
   - Performs environment checks and auto-installs dependencies.
   - Launches FLUX in your default browser at `http://localhost:3000`.
   *(If macOS shows a security prompt on first launch: right-click `Launch-FLUX-Mac.command` → select **Open** → click **Open**).*

---

### Option 2: Standard Terminal / PowerShell Setup

Works identically on **Windows (PowerShell / Command Prompt)**, **macOS**, and **Linux**:

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

4. Open your browser and go to:
   ```text
   http://localhost:3000
   ```

---

## Installing as a Desktop App

You can run FLUX in an independent app window without browser tabs or address bars:

### On Windows (Microsoft Edge, Google Chrome, or Brave)
1. Open `http://localhost:3000` (or your hosted URL).
2. **In Edge:** Click the **App Available** icon in the address bar (looks like 3 squares and a plus), or click **`...` → Apps → Install FLUX**.
3. **In Chrome / Brave:** Click the **Install** icon on the right side of the address bar, or click **Install App** in the FLUX header.
4. Check the options to **Pin to taskbar** and **Pin to Start Menu**.
5. FLUX now launches like any native Windows desktop program!

### On macOS (Chrome, Brave, or Safari)
1. Open `http://localhost:3000` in Chrome, Brave, or Safari.
2. In Chrome/Brave: Click the **Install** icon in the address bar → **Install**.
3. In Safari (macOS Sonoma / Sequoia): Go to **File → Add to Dock…** → click **Add**.

---

## Setting up Local AI Reports with Ollama

FLUX includes on-device AI reporting that connects to your local Ollama daemon at `http://127.0.0.1:11434`.

### 1. Install Ollama
- **Windows:** Download the installer from [ollama.com/download/windows](https://ollama.com/download/windows) and run the setup.
- **macOS:** Download from [ollama.com/download/mac](https://ollama.com/download/mac) or install via Homebrew (`brew install ollama`).
- **Linux:** Run `curl -fsSL https://ollama.com/install.sh | sh`.

### 2. Download a Model
Open PowerShell, Command Prompt, or Terminal and pull your preferred model:
```bash
ollama pull llama3.2
```
*(FLUX also supports `mistral`, `qwen2.5`, `phi3`, or any model installed in your Ollama library).*

### 3. Start Ollama with Web Permissions (CORS)
Browsers require CORS authorization to communicate with localhost ports:

- **On Windows (1-Click):** Double-click **`Start-Ollama-Windows.bat`**  
  *Or in PowerShell:*
  ```powershell
  $env:OLLAMA_ORIGINS="*"
  ollama serve
  ```
  *Or in Command Prompt:*
  ```cmd
  set OLLAMA_ORIGINS=*
  ollama serve
  ```

- **On macOS (1-Click):** Double-click **`Start-Ollama-Mac.command`**  
  *Or in Terminal:*
  ```bash
  OLLAMA_ORIGINS="*" ollama serve
  ```

### 4. Verify & Use in FLUX
1. In FLUX, navigate to **Settings → Desktop & Ollama**.
2. Confirm the status shows a green **Connected** badge with your available models listed.
3. Open **AI Reports** from the left navigation to generate daily standup briefings, monthly performance retrospectives, and pipeline velocity audits 100% on-device.

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
