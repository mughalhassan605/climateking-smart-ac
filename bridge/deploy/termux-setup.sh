#!/data/data/com.termux/files/usr/bin/bash
# Turns a spare Android phone into the Home Bridge. Run inside Termux (from F-Droid):
#   bash deploy/termux-setup.sh
# Keep the phone plugged in and on the home Wi-Fi. In Android settings, turn off battery
# optimisation for Termux so the bridge is not stopped at night.
set -e
pkg update -y
pkg install -y python git rust binutils termux-api
cd "$(dirname "$0")/.."
python -m venv .venv
. .venv/bin/activate
pip install --upgrade pip
pip install -e ".[haier]"
[ -f bridge.env ] || cp bridge.env.example bridge.env
echo
echo "Edit bridge.env (nano bridge.env), then start the bridge with:"
echo "  termux-wake-lock && . .venv/bin/activate && climateking-bridge run"
