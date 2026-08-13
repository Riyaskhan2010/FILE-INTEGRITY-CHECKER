@echo off
echo Starting File Integrity Checker Backend...
cd /d "%~dp0backend"
python app.py
pause
