@echo off
title MusikBox - Bibliotheque musicale locale
cd /d "%~dp0"
echo.
echo  ============================================
echo   MUSIKBOX - bibliotheque musicale locale
echo   Ouvrez ensuite : http://localhost:8787
echo  ============================================
echo.
python server.py
if errorlevel 1 (
  echo.
  echo  Python n'est pas trouve ou une erreur est survenue.
  echo  Installez Python 3 depuis https://python.org puis relancez.
  pause
)
