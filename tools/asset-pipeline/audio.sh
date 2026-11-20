#!/usr/bin/env bash
# Spec 32 (recorded sound effects): convert raw CC0 / CC-BY recordings into public/assets/audio/*.ogg.
# Offline and repeatable. Raw downloads are untrusted data and never committed: keep them outside git
# (or in the git-ignored tools/asset-pipeline/input/), one directory per source, laid out as below.
#
# Usage: bash tools/asset-pipeline/audio.sh <raw-dir> [out-dir]
#   out-dir defaults to public/assets/audio. Needs ffmpeg with libvorbis (and unzip for the archives,
#   extracted beforehand into <name>_x/ next to each archive).
#
# Output: Ogg Vorbis, 44.1 kHz, mono (all sources used here are mono or folded to mono), one-shots trimmed
# of leading/trailing silence and peak-normalised to -1 dBFS; loops are cut with an equal-power crossfade
# so the end flows into the start, and peak-normalised lower (-3 to -6 dBFS).
#
# SOURCES (licence read on each source page, 2026-11-20). <raw-dir>/<dir>: file -> output
#  bsb2853, bsb2854: "Rifle: Shot #1/#2", Joseph Sardin, BigSoundBank, CC0,
#      https://bigsoundbank.com/rifle-shot-1-s2853.html, .../rifle-shot-2-s2854.html -> rifle_shot_1/2
#  tabasco_x/sounds/sks.wav: "Gunshot Sounds", Tabasco (Vincent Sevedge), OpenGameArt; page says CC0, the
#      archive's creativecommons.txt says CC-BY 3.0, so it is credited as CC-BY 3.0,
#      https://opengameart.org/content/gunshot-sounds -> rifle_shot_3/4
#  jackmenhorn/gun_outofammo_01.wav: "FPS Placeholder Sounds", Jack Menhorn, CC-BY 3.0,
#      https://opengameart.org/content/fps-placeholder-sounds -> dry_click
#  bsb1988, bsb1990, bsb1991, bsb1989: "Gun, loading #1..#4", Joseph Sardin, CC0,
#      https://bigsoundbank.com/gun-loading-1-s1988.html (and s1989..s1991) -> reload_mag_out, reload_bolt,
#      reload_mag_in, pickup_ammo
#  bsb1361..bsb1363: "Cartridge case 5.56mm on concrete #1..#3", Joseph Sardin, CC0,
#      https://bigsoundbank.com/bullet-case-5-56mm-on-concrete-1-s1361.html (s1362, s1363) -> shell_casing_1..3
#  kenney_scifi_x/Audio: "Sci-Fi Sounds", Kenney, CC0, https://opengameart.org/content/sci-fi-sounds
#      impactMetal_000..003 -> impact_metal_1..4; laserSmall_000..002 -> enemy_laser_1..3;
#      explosionCrunch_000..002 -> explosion_robot_1..3; lowFrequency_explosion_000 -> boss_defeat
#  kenney_iface_x/Audio: "Interface Sounds", Kenney, CC0, https://opengameart.org/content/interface-sounds
#      confirmation_001 -> pickup_medkit; tick_002 -> hit_marker
#  hits75_x: "75 CC0 breaking / falling / hit sfx", rubberduck, CC0,
#      https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx
#      bfh1_metal_hit_01/04/05 -> hit_armor_1..3; bfh1_rock_hit_01, bfh1_rock_breaking_03/02 -> impact_concrete_1..3
#  footsteps_x/footsteps: "Footsteps on different surfaces", congusbongus, CC-BY 3.0,
#      https://opengameart.org/content/footsteps-on-different-surfaces
#      boots/0..5 (derived from "footstep-concrete.wav" by swuing, CC-BY 3.0) -> step_concrete_1..6;
#      metal/0..5 (derived from "fboots on aluminum ladder 01" by Eelke, CC-BY 3.0) -> step_metal_1..6
#  heartbeat/heartbeat_slow.wav: "Heartbeat sounds", bart, CC0,
#      https://opengameart.org/content/heartbeat-sounds -> heartbeat_loop
#  bsb1103: "Breathless Man", Joseph Sardin, CC0, https://bigsoundbank.com/breathless-man-s1103.html -> breath_loop
#  bang_x: "25 CC0 bang / firework SFX", rubberduck, CC0, https://opengameart.org/content/25-cc0-bang-firework-sfx
#      bang_01..03 -> explosion_bang_1..3; cannon_01, cannon_02 -> boss_cannon_1/2
#  stomp/stomp.flac: "Mech Stomp / Step Sound", hc, CC0, https://opengameart.org/content/mech-stomp-step-sound -> boss_stomp
#  laserburst/burst.mp3: "Laser weapon burst fire", celestialghost8, CC0,
#      https://opengameart.org/content/laser-weapon-burst-fire -> boss_laser
#  bsb0146: "Strong Wind #1", Joseph Sardin, CC0, https://bigsoundbank.com/strong-wind-1-s0146.html -> amb_wind_loop
#  bsb0266: "Sea: Waves", Joseph Sardin, CC0, https://bigsoundbank.com/sea-waves-s0266.html -> amb_sea_loop
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
raw="${1:?usage: audio.sh <raw-dir> [out-dir]}"
out="${2:-$root/public/assets/audio}"
FF="${FFMPEG:-ffmpeg}"
mkdir -p "$out"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

ENC=(-ar 44100 -ac 1 -c:a libvorbis -q:a 5 -map_metadata -1)

# peak of a file in dBFS (volumedetect max_volume)
peak() { "$FF" -hide_banner -nostats -i "$1" -af volumedetect -f null - 2>&1 | sed -n 's/.*max_volume: \(-\?[0-9.]*\) dB.*/\1/p'; }

# oneshot <out-name> <input> [start] [duration] [target-peak-dB]
oneshot() {
  local name="$1" src="$raw/$2" ss="${3:-0}" dur="${4:-0}" target="${5:--1}"
  local cut=(-ss "$ss"); [ "$dur" != "0" ] && cut+=(-t "$dur")
  # trim leading and trailing silence (-50 dB), 8 ms fade-in guard, 30 ms fade-out
  "$FF" -v error -y "${cut[@]}" -i "$src" -ac 1 -ar 44100 -af \
    "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.004,areverse,silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.02,afade=t=in:d=0.03,areverse,afade=t=in:d=0.002" \
    -c:a pcm_f32le "$tmp/a.wav"
  local p; p="$(peak "$tmp/a.wav")"
  "$FF" -v error -y -i "$tmp/a.wav" -af "volume=$(awk "BEGIN{print $target - ($p)}")dB" "${ENC[@]}" "$out/$name.ogg"
  echo "$name.ogg $(stat -c%s "$out/$name.ogg") B"
}

# loop <out-name> <input> <start> <length> <crossfade> <target-peak-dB>
loop() {
  local name="$1" s0="$3" L="$4" X="$5" target="$6"
  # decode the needed span first (some Ogg sources fail mid-file when filtered directly)
  "$FF" -v error -y -ss "$s0" -t "$(awk "BEGIN{print $L+$X+0.05}")" -i "$raw/$2" -ac 1 -ar 44100 -c:a pcm_f32le "$tmp/src.wav"
  # A = S[X, L+X] crossfaded (equal power) into B = S[0, X]: the end of the result is S[X], where it starts
  "$FF" -v error -y -i "$tmp/src.wav" -i "$tmp/src.wav" -filter_complex \
    "[0]atrim=start=$X:end=$(awk "BEGIN{print $L+$X}"),asetpts=PTS-STARTPTS[a];\
     [1]atrim=start=0:end=$X,asetpts=PTS-STARTPTS[b];\
     [a][b]acrossfade=d=$X:c1=qsin:c2=qsin[o]" -map "[o]" -c:a pcm_f32le "$tmp/l.wav"
  local p; p="$(peak "$tmp/l.wav")"
  "$FF" -v error -y -i "$tmp/l.wav" -af "volume=$(awk "BEGIN{print $target - ($p)}")dB" "${ENC[@]}" "$out/$name.ogg"
  echo "$name.ogg $(stat -c%s "$out/$name.ogg") B (loop ${L}s)"
}

# loop_whole <out-name> <input> <target-peak-dB>: the file already loops (no trim)
loop_whole() {
  local name="$1" src="$raw/$2" target="$3"
  local p; p="$(peak "$src")"
  "$FF" -v error -y -i "$src" -af "volume=$(awk "BEGIN{print $target - ($p)}")dB" "${ENC[@]}" "$out/$name.ogg"
  echo "$name.ogg $(stat -c%s "$out/$name.ogg") B (whole-file loop)"
}

# ---- weapon --------------------------------------------------------------------------------------
oneshot rifle_shot_1 bsb2853/2853.flac
oneshot rifle_shot_2 bsb2854/2854.flac
oneshot rifle_shot_3 tabasco_x/sounds/sks.wav 0.337 1.4
oneshot rifle_shot_4 tabasco_x/sounds/sks.wav 2.283 1.4
oneshot dry_click jackmenhorn/gun_outofammo_01.wav 0 0 -3
oneshot reload_mag_out bsb1988/1988.flac 0 0 -3
oneshot reload_mag_in bsb1991/1991.flac 0 0 -2
oneshot reload_bolt bsb1990/1990.flac 0 0 -2
for i in 1 2 3; do oneshot "shell_casing_$i" "bsb136$i/136$i.flac" 0 0.7 -6; done
# ---- impacts -------------------------------------------------------------------------------------
for i in 0 1 2 3; do oneshot "impact_metal_$((i + 1))" "kenney_scifi_x/Audio/impactMetal_00$i.ogg" 0 0 -3; done
oneshot hit_armor_1 hits75_x/bfh1_metal_hit_01.ogg 0 0 -3
oneshot hit_armor_2 hits75_x/bfh1_metal_hit_04.ogg 0 0 -3
oneshot hit_armor_3 hits75_x/bfh1_metal_hit_05.ogg 0 0 -3
oneshot impact_concrete_1 hits75_x/bfh1_rock_hit_01.ogg 0 0 -2
oneshot impact_concrete_2 hits75_x/bfh1_rock_breaking_03.ogg 0 0.45 -2
oneshot impact_concrete_3 hits75_x/bfh1_rock_breaking_02.ogg 0 0.5 -2
# ---- player --------------------------------------------------------------------------------------
for i in 0 1 2 3 4 5; do
  oneshot "step_concrete_$((i + 1))" "footsteps_x/footsteps/boots/$i.ogg" 0 0 -3
  oneshot "step_metal_$((i + 1))" "footsteps_x/footsteps/metal/$i.ogg" 0 0 -3
done
loop_whole heartbeat_loop heartbeat/heartbeat_slow.wav -2
loop breath_loop bsb1103/1103.flac 4.0 12.0 0.6 -4
oneshot pickup_ammo bsb1989/1989.flac 0 0 -3
oneshot pickup_medkit kenney_iface_x/Audio/confirmation_001.ogg 0 0 -4
oneshot hit_marker kenney_iface_x/Audio/tick_002.ogg 0 0 -4
# ---- enemies and boss ----------------------------------------------------------------------------
for i in 0 1 2; do
  oneshot "enemy_laser_$((i + 1))" "kenney_scifi_x/Audio/laserSmall_00$i.ogg" 0 0 -2
  oneshot "explosion_robot_$((i + 1))" "kenney_scifi_x/Audio/explosionCrunch_00$i.ogg"
  oneshot "explosion_bang_$((i + 1))" "bang_x/bang_0$((i + 1)).ogg"
done
oneshot boss_cannon_1 bang_x/cannon_01.ogg
oneshot boss_cannon_2 bang_x/cannon_02.ogg
oneshot boss_stomp stomp/stomp.flac
oneshot boss_laser laserburst/burst.mp3 0 0 -2
oneshot boss_defeat kenney_scifi_x/Audio/lowFrequency_explosion_000.ogg
# ---- ambience (mono loops) -----------------------------------------------------------------------
loop amb_wind_loop bsb0146/0146.ogg 3.0 20.0 2.0 -6
loop amb_sea_loop bsb0266/0266.ogg 5.0 20.0 2.0 -6

total=$(du -cb "$out"/*.ogg | tail -1 | cut -f1)
echo "total $(ls "$out"/*.ogg | wc -l) files, $total bytes"
