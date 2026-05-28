@echo off
:: Wrapper .bat pour lancer globalcord-install.ps1 facilement (double-clic)
title Globalcord — Installation
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0globalcord-install.ps1"
if %errorlevel% neq 0 pause
