@echo off
title Patra — Sarvam Study Desk (Offline Local Server)
echo ======================================================================
echo   Patra — Sarvam Document Reader ^& Doubt Desk
echo   Powered by Sarvam Vision 1.5 (Doc AI) ^& Sarvam-105B (Chat API)
echo ======================================================================
echo.
echo   Starting local server at: http://localhost:8000
echo    API Key file: %~dp0.env
echo.
".\.venv\Scripts\python.exe" app.py
pause
