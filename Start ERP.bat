@echo off
title ERP MGB Inventory

echo.
echo ===========================================
echo        ERP MGB INVENTORY SERVER
echo ===========================================
echo.

cd /d C:\Users\ebitk\Documents\mgb-inventory

echo [1/3] Menjalankan Next.js...
start "ERP NextJS" cmd /k "npm run dev"

echo.
echo Tunggu server siap...
timeout /t 8 >nul

echo [2/3] Menjalankan Cloudflare Tunnel...
start "Cloudflare Tunnel" cmd /k "cloudflared.exe tunnel --url http://localhost:3000"

echo.
echo [3/3] Membuka Browser...
timeout /t 5 >nul
start http://localhost:3000

echo.
echo ===========================================
echo ERP BERHASIL DIJALANKAN
echo ===========================================
pause