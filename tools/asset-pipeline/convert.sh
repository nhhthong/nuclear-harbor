#!/usr/bin/env bash
# Convert the GoldSrc G36C view model to GLB, offline and repeatable.
# Usage: bash tools/asset-pipeline/convert.sh [source.mdl] [output.glb]
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
src="${1:-$root/assets-src/weapons/g36c/v_g36c.mdl}"
dst="${2:-$root/public/assets/weapons/g36c/g36c.glb}"
python3 -I "$here/convert.py" "$src" "$dst" "$here/report.json"
if command -v blender >/dev/null 2>&1; then
  blender --background --python "$here/validate_blender.py" -- "$dst" 2>&1 | grep BLENDER_VALIDATE
else
  echo "blender not found: skipping import validation"
fi
echo "wrote $dst"
