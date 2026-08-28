#!/usr/bin/env bash
# MusikBox — lanceur macOS / Linux
cd "$(dirname "$0")"
echo "============================================"
echo " MUSIKBOX — bibliothèque musicale locale"
echo " Ouvrez ensuite : http://localhost:8787"
echo "============================================"
python3 server.py || python server.py
