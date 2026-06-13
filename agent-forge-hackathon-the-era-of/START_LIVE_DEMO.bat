@echo off
cd /d "%~dp0"
echo Starting GeoTaste AI live demo...
echo.
echo Leave this window open during judging.
echo Open http://localhost:4173 in your browser.
echo.
node server.js
pause
