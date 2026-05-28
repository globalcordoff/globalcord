@echo off
:: Wrapper .bat pour lancer globalcord-uninstall.ps1 facilement (double-clic)
title Globalcord — Désinstallation
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0globalcord-uninstall.ps1"
if %errorlevel% neq 0 pause
