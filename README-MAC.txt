========================================================================
  FLUX Content Command - Local Mac Quick Start Guide
========================================================================

HOW TO RUN:
1. Double-click "Launch-FLUX-Mac.command".
   It will check your setup, install packages if needed, and automatically
   launch FLUX in your browser at http://localhost:3000.

   (If macOS shows a security warning the first time:
    Right-click "Launch-FLUX-Mac.command" -> choose "Open" -> click "Open").

HOW TO USE WITH LOCAL OLLAMA (AI Reports & Summaries):
1. Install Ollama from https://ollama.com/download/mac (or 'brew install ollama').
2. In Terminal, pull your preferred model:
   ollama pull llama3.2
   (or: ollama pull mistral, or: ollama pull qwen2.5)
3. Double-click "Start-Ollama-Mac.command" (or run: OLLAMA_ORIGINS="*" ollama serve).
4. In FLUX, visit Settings -> Desktop & Ollama.
   You will see the green "Connected" status indicator!
5. Navigate to "AI Reports" in the left sidebar to generate real-time briefings,
   pipeline health diagnostics, and weekly reviews.

REQUIREMENTS:
- Node.js (v18+) from https://nodejs.org
- Any modern browser (Safari, Chrome, Brave, Arc, Edge)
- Ollama (optional, for on-device AI) from https://ollama.com

100% PRIVATE & OFFLINE:
All workspace data is stored inside your browser's local IndexedDB.
Nothing is sent to any external server.
========================================================================
