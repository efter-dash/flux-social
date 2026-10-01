#!/bin/bash
# ==============================================================================
# FLUX - macOS 1-Click Ollama Starter with CORS enabled
# ==============================================================================

echo "--------------------------------------------------------"
echo "  🦙 Starting Ollama with Web / Local App Permissions"
echo "--------------------------------------------------------"

if ! command -v ollama &> /dev/null; then
  echo ""
  echo "❌ Ollama is not installed yet."
  echo "👉 Download it for Mac from: https://ollama.com/download/mac"
  echo "   or install via Homebrew: brew install ollama"
  echo ""
  read -p "Press [Enter] to exit..."
  exit 1
fi

echo "✅ Ollama detected: $(ollama -v)"

# Check if model is downloaded
echo "Checking available models..."
ollama list

echo ""
echo "🚀 Starting Ollama server with OLLAMA_ORIGINS=\"*\"..."
echo "Keep this window open in the background while using AI Reports in FLUX."
echo ""

OLLAMA_ORIGINS="*" ollama serve
