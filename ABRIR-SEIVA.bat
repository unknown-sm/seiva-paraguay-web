@echo off
echo.
echo ==========================================
echo  SEIVA PARAGUAY - Servidor Local
echo ==========================================
echo.
cd /d E:\Pagina_seiva\seivvaweb\app
if not exist "dist" (
  echo ERROR: No existe la carpeta dist. Compilando primero...
  call npm run build
)
echo.
echo Iniciando servidor en http://localhost:4173
echo Presiona Ctrl+C y luego S para detener
echo.
npm run preview -- --port 4174
pause
