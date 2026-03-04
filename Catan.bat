@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 lanzar_catan.py
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  python lanzar_catan.py
  goto :eof
)

echo.
echo ERROR: No se encontro Python instalado en este equipo.
echo Instala Python 3 y vuelve a ejecutar este archivo.
echo.
pause
