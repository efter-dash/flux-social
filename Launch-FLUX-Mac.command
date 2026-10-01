#!/bin/bash
# ==============================================================================
# FLUX Content Command - macOS 1-Click Desktop Launcher
# ==============================================================================

# Move to the script's directory (inside the unzipped flux folder)
cd "$(dirname "$0")"

echo "--------------------------------------------------------"
echo "  🚀 Launching FLUX Content Command on Mac"
echo "--------------------------------------------------------"

# 1. Check for Node.js
if ! command -v node &> /dev/null; then
  echo ""
  echo "❌ Node.js is not detected on your Mac."
  echo "👉 Please download and install Node.js (LTS version) from:"
  echo "   https://nodejs.org"
  echo ""
  read -p "Press [Enter] to exit..."
  exit 1
fi

echo "✅ Node.js detected: $(node -v)"

# 2. Check for dependencies
if [ ! -d "node_modules" ]; then
  echo ""
  echo "📦 First time setup: Installing dependencies (this takes ~30 seconds)..."
  npm install
  echo "✅ Dependencies installed!"
fi

# 3. Check if Ollama is running
echo ""
echo "🔍 Checking Local Ollama daemon on http://127.0.0.1:11434..."
if curl -s http://127.0.0.1:11434/api/tags > /dev/null 2>&1; then
  echo "✅ Ollama is running! Local AI Reports will work seamlessly."
else
  echo "ℹ️  Ollama is not running right now."
  echo "   (If you want AI Reports, run 'Start-Ollama-Mac.command' or 'ollama serve')"
fi

echo ""
echo "🌐 Starting FLUX local server on http://localhost:3000..."
echo "⚡ Opening FLUX in your default browser..."

# Open browser after a brief pause
(sleep 2 && open http://localhost:3000) &

# Run Vite dev server
npm run dev
