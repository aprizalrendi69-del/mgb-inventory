@echo off

call "Stop ERP.bat"

timeout /t 3 >nul

call "Start ERP.bat"