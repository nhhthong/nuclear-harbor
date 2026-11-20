#!/usr/bin/env bash
# Spec 32 (recorded sound effects): convert raw CC0 / CC-BY recordings into public/assets/audio/*.ogg.
# Offline and repeatable. Raw downloads are untrusted data and never committed: keep them outside git
# (or in the git-ignored tools/asset-pipeline/input/), one directory per source, laid out as below.
#
# Usage: bash tools/asset-pipeline/audio.sh <raw-dir> [out-dir]
#   out-dir defaults to public/assets/audio (its *.ogg are replaced). Needs ffmpeg with libvorbis;
#   archives are extracted beforehand into <name>_x/ next to each archive (unzip).
#
# Output: Ogg Vorbis q5, 44.1 kHz, mono; one-shots trimmed of leading/trailing silence and
# peak-normalised (-1 dBFS unless noted); loops cut with an equal-power crossfade (or whole files that
# already loop) and normalised lower.
#
# SOURCES (licence read on each source page, 2026-11-20).
# BigSoundBank, Joseph SARDIN, CC0 1.0 (each page shows "License CC0 (public domain)"; site statement
# https://bigsoundbank.com/licenses.html). Raw dir bsbNNNN/ holds NNNN.ogg (or .flac) downloaded from
# https://bigsoundbank.com/UPLOAD/ogg/NNNN.ogg. Page = https://bigsoundbank.com/<slug>.html:
#   2853 rifle-shot-1-s2853, 2854 rifle-shot-2-s2854 -> rifle_shot_1/2
#   2003 empty-firecracker-gun-1-s2003 -> dry_click
#   1988 gun-loading-1-s1988 -> reload_mag_out; 1991 gun-loading-4-s1991 -> reload_mag_in;
#   1990 gun-loading-3-s1990 -> reload_bolt; 1989 gun-loading-2-s1989 -> pickup_ammo
#   1361..1363 bullet-case-5-56mm-on-concrete-1..3-s1361..s1363 -> shell_casing_1..3
#   0530 paintball-tirs-impacts-futs-metalliques-s0530 (slices) -> impact_metal_1..4
#   0514 footsteps-shoe-on-concrete-s0514 (slices) -> step_concrete_1..6
#   1835 jumping-on-concrete-1-s1835 -> jump; 1836 jumping-on-concrete-2-s1836 -> land
#   0486 grunts-s0486 (slices) -> hurt_1..3; 2361 cry-of-pain-s2361 -> death
#   0243 heartbeat-1-s0243 (one beat, whole file) -> heartbeat_loop; 1103 breathless-man-s1103 -> breath_loop
#   1973 robot-1-s1973, 1975 robot-3-s1975 -> enemy_alert_1/2; 0760 electronic-device-beeps-s0760 -> robot_beep
#   2919 servomotor-2-90-1-s2919 -> servo
#   3545 drone-1-s3545 -> drone_buzz
#   0128 sword-through-the-air-s0128 -> sword_swing; 0127 sword-that-cuts-s0127 -> sword_cut
#   0572 whoosh-1-s0572 (slices) -> energy_wave_1/2
#   0227 hiss-of-steam-train-1-s0227 -> steam_hiss
#   2118 neon-or-transformer-1-s2118 -> laser_charge; 3442 electric-strike-1-s3442 -> electric_strike
#   1807 explosion-1-s1807, 1808 explosion-2-s1808, 1023 explosion-far-away-s1023 -> explosion_bang_1..3
#   3411 evacuation-alarm-1-s3411 -> alarm; 2380 aerospace-beep-1-s2380 -> beep
#   0303 grinding-metal-gate-1-s0303 -> gate; 0616 creaking-metallic-door-s0616 -> metal_creak_1/2
#   0146 strong-wind-1-s0146 -> amb_wind_loop; 0266 sea-waves-s0266 -> amb_sea_loop
# OpenGameArt, only where BigSoundBank has no fit:
#   kenney_scifi_x/Audio: "Sci-Fi Sounds", Kenney, CC0, https://opengameart.org/content/sci-fi-sounds
#       laserSmall_000..002 -> enemy_laser_1..3; explosionCrunch_000..002 -> explosion_robot_1..3;
#       lowFrequency_explosion_000 -> boss_defeat
#   kenney_iface_x/Audio: "Interface Sounds", Kenney, CC0, https://opengameart.org/content/interface-sounds
#       confirmation_001 -> pickup_medkit; tick_002 -> hit_marker
#   hits75_x: "75 CC0 breaking / falling / hit sfx", rubberduck, CC0,
#       https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx
#       bfh1_metal_hit_01/04/05 -> hit_armor_1..3; bfh1_rock_hit_01, bfh1_rock_breaking_03/02 -> impact_concrete_1..3
#   bang_x: "25 CC0 bang / firework SFX", rubberduck, CC0, https://opengameart.org/content/25-cc0-bang-firework-sfx
#       cannon_01, cannon_02 -> boss_cannon_1/2
#   footsteps_x/footsteps/metal/0..5: "Footsteps on different surfaces", congusbongus, CC-BY 3.0,
#       https://opengameart.org/content/footsteps-on-different-surfaces (derived from "fboots on aluminum
#       ladder 01" by Eelke, CC-BY 3.0, https://freesound.org/people/Eelke/sounds/462598/) -> step_metal_1..6
#   stomp/stomp.flac: "Mech Stomp / Step Sound", hc, CC0, https://opengameart.org/content/mech-stomp-step-sound -> boss_stomp
#   laserburst/burst.mp3: "Laser weapon burst fire", celestialghost8, CC0,
#       https://opengameart.org/content/laser-weapon-burst-fire -> boss_laser
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

rm -f "$out"/*.ogg
# ---- weapon --------------------------------------------------------------------------------------
oneshot rifle_shot_1 bsb2853/2853.flac
oneshot rifle_shot_2 bsb2854/2854.flac
oneshot dry_click bsb2003/2003.ogg 0 0 -3
oneshot reload_mag_out bsb1988/1988.flac 0 0 -3
oneshot reload_mag_in bsb1991/1991.flac 0 0 -2
oneshot reload_bolt bsb1990/1990.flac 0 0 -2
for i in 1 2 3; do oneshot "shell_casing_$i" "bsb136$i/136$i.flac" 0 0.7 -6; done
# ---- impacts -------------------------------------------------------------------------------------
n=1; for t in 1.618 2.141 4.520 6.613; do oneshot "impact_metal_$n" bsb0530/0530.ogg "$t" 0.3 -2; n=$((n + 1)); done
oneshot hit_armor_1 hits75_x/bfh1_metal_hit_01.ogg 0 0 -3
oneshot hit_armor_2 hits75_x/bfh1_metal_hit_04.ogg 0 0 -3
oneshot hit_armor_3 hits75_x/bfh1_metal_hit_05.ogg 0 0 -3
oneshot impact_concrete_1 hits75_x/bfh1_rock_hit_01.ogg 0 0 -2
oneshot impact_concrete_2 hits75_x/bfh1_rock_breaking_03.ogg 0 0.45 -2
oneshot impact_concrete_3 hits75_x/bfh1_rock_breaking_02.ogg 0 0.5 -2
# ---- player --------------------------------------------------------------------------------------
n=1; for t in 0.426 1.099 1.829 2.528 3.223 4.299; do oneshot "step_concrete_$n" bsb0514/0514.ogg "$t" 0.3 -3; n=$((n + 1)); done
for i in 0 1 2 3 4 5; do oneshot "step_metal_$((i + 1))" "footsteps_x/footsteps/metal/$i.ogg" 0 0 -3; done
oneshot jump bsb1835/1835.ogg 0 0 -4
oneshot land bsb1836/1836.ogg 0 0 -2
n=1; for t in 0.07 1.78 5.70; do oneshot "hurt_$n" bsb0486/0486.ogg "$t" 0.55 -2; n=$((n + 1)); done
oneshot death bsb2361/2361.ogg
loop_whole heartbeat_loop bsb0243/0243.ogg -2
loop breath_loop bsb1103/1103.flac 4.0 12.0 0.6 -4
oneshot pickup_ammo bsb1989/1989.flac 0 0 -3
oneshot pickup_medkit kenney_iface_x/Audio/confirmation_001.ogg 0 0 -4
oneshot hit_marker kenney_iface_x/Audio/tick_002.ogg 0 0 -4
# ---- enemies -------------------------------------------------------------------------------------
oneshot enemy_alert_1 bsb1973/1973.ogg 0 0 -2
oneshot enemy_alert_2 bsb1975/1975.ogg 0 0 -2
oneshot robot_beep bsb0760/0760.ogg 0.13 0.6 -3
oneshot servo bsb2919/2919.ogg 0 0 -3
oneshot drone_buzz bsb3545/3545.ogg 4.0 2.5 -3
oneshot sword_swing bsb0128/0128.ogg 0 0 -2
oneshot sword_cut bsb0127/0127.ogg 0 0 -2
oneshot energy_wave_1 bsb0572/0572.ogg 0.11 0.6 -2
oneshot energy_wave_2 bsb0572/0572.ogg 1.17 0.6 -2
oneshot steam_hiss bsb0227/0227.ogg 0 1.6 -3
for i in 0 1 2; do
  oneshot "enemy_laser_$((i + 1))" "kenney_scifi_x/Audio/laserSmall_00$i.ogg" 0 0 -2
  oneshot "explosion_robot_$((i + 1))" "kenney_scifi_x/Audio/explosionCrunch_00$i.ogg"
done
oneshot explosion_bang_1 bsb1807/1807.flac
oneshot explosion_bang_2 bsb1808/1808.flac
oneshot explosion_bang_3 bsb1023/1023.ogg 0 2.2
# ---- boss ----------------------------------------------------------------------------------------
oneshot boss_cannon_1 bang_x/cannon_01.ogg
oneshot boss_cannon_2 bang_x/cannon_02.ogg
oneshot boss_stomp stomp/stomp.flac
oneshot boss_laser laserburst/burst.mp3 0 0 -2
oneshot laser_charge bsb2118/2118.ogg 1.0 1.6 -4
oneshot electric_strike bsb3442/3442.ogg 0 0 -2
oneshot boss_defeat kenney_scifi_x/Audio/lowFrequency_explosion_000.ogg
# ---- world, objectives, UI -----------------------------------------------------------------------
oneshot alarm bsb3411/3411.ogg 0 1.1 -4
oneshot beep bsb2380/2380.ogg 0 0 -4
oneshot gate bsb0303/0303.ogg 0 0 -3
oneshot metal_creak_1 bsb0616/0616.ogg 10.0 2.5 -6
oneshot metal_creak_2 bsb0616/0616.ogg 40.0 2.5 -6
# ---- ambience (mono loops) -----------------------------------------------------------------------
loop amb_wind_loop bsb0146/0146.ogg 3.0 20.0 2.0 -6
loop amb_sea_loop bsb0266/0266.ogg 5.0 20.0 2.0 -6

total=$(du -cb "$out"/*.ogg | tail -1 | cut -f1)
echo "total $(ls "$out"/*.ogg | wc -l) files, $total bytes"
