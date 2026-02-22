#!/bin/bash
# Build the extension as an installable .xpi file
set -e

NAME="yt-bilingual-subtitle"
VERSION=$(grep '"version"' manifest.json | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
OUTPUT="${NAME}-v${VERSION}.xpi"

echo "📦 Building ${OUTPUT}..."

# Remove old build
rm -f "$OUTPUT"

# Package (xpi is just a zip)
zip -r "$OUTPUT" \
    manifest.json \
    content.js \
    background.js \
    popup.html \
    popup.js \
    icon.png \
    -x "*.git*" "*.DS_Store" "node_modules/*" "*.sh"

echo "✅ Built: ${OUTPUT} ($(du -h "$OUTPUT" | cut -f1))"
echo ""
echo "Install in Firefox:"
echo "  1. Open about:addons"
echo "  2. ⚙️ → Install Add-on From File"
echo "  3. Select ${OUTPUT}"
