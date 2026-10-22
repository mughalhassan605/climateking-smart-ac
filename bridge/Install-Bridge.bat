@echo off
rem Double-click to install or reconfigure the ClimateKing Home Bridge on this computer.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\install-windows.ps1"
echo.
pause
