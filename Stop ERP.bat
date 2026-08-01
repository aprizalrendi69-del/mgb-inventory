@echo off
title Stop ERP

echo Menghentikan ERP...

taskkill /F /IM node.exe
taskkill /F /IM cloudflared.exe

echo.
echo ERP berhasil dihentikan.
pause