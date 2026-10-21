@echo off
rem ClimateKing Home Bridge for Windows. First time: install Python 3.11+ from python.org
rem (tick "Add to PATH"), then double-click this file. To start with Windows, put a shortcut to
rem this file in shell:startup and set the PC never to sleep.
cd /d "%~dp0\.."
if not exist .venv (
  python -m venv .venv
  .venv\Scripts\pip install -e ".[haier]"
)
if not exist bridge.env (
  copy bridge.env.example bridge.env
  notepad bridge.env
)
:loop
.venv\Scripts\climateking-bridge run
echo Bridge stopped, restarting in 10 seconds...
timeout /t 10
goto loop
