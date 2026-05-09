#!/usr/bin/env bash
# Generate the curated 12-PNG Daybreak splash set into icons/splash/.
# Device list lives in sizes.json. Run from repo root.
#
# Adds new devices: edit sizes.json, re-run, hand-add the matching <link>
# tags to index.html, bump versions per CLAUDE.md rule 7.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
node --experimental-vm-modules "$HERE/generate.mjs"

echo ""
echo "Next:"
echo "  1. Verify pixel dims:  file icons/splash/*.png | sort"
echo "  2. Hand-add any new <link rel=\"apple-touch-startup-image\"> tags to index.html"
echo "  3. Bump version (<title>, settings panel, ?v= cache-bust) + sw.js CACHE"
echo "  4. Commit + deploy"
