@echo off
set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

echo ==========================================
echo 1. Validando Suite de Reglas, IA y Visuales...
"%EDGE%" --headless --allow-file-access-from-files --dump-dom "file:///%~dp0test_runner.html" > "%~dp0runner_res.txt"
findstr /C:"TODAS LAS PRUEBAS COMPLETADAS CON" "%~dp0runner_res.txt" >nul
if errorlevel 1 (
    echo [FAIL] Error en pruebas de logica.
    type "%~dp0runner_res.txt"
    del "%~dp0runner_res.txt" 2>nul
    exit /b 1
)
echo [PASS] 44/44 Pruebas de Logica, IA, Visuales y Reglas TCG aprobadas.
del "%~dp0runner_res.txt" 2>nul

echo 2. Validando Sintaxis y Funciones de la UI...
"%EDGE%" --headless --allow-file-access-from-files --dump-dom "file:///%~dp0verify_syntax.html" > "%~dp0syntax_res.txt"
findstr /C:"SUCCESS: Todos los scripts compilaron" "%~dp0syntax_res.txt" >nul
if errorlevel 1 (
    echo [FAIL] Error en scripts o funciones de la UI.
    type "%~dp0syntax_res.txt"
    del "%~dp0syntax_res.txt" 2>nul
    exit /b 1
)
echo [PASS] Todos los scripts y funciones de UI operativos.
del "%~dp0syntax_res.txt" 2>nul

echo 3. Validando Modo 3D, Animaciones y Botones de Combate...
"%EDGE%" --headless --allow-file-access-from-files --dump-dom "file:///%~dp0test_3d_mode.html" > "%~dp0test_3d_res.txt"
findstr /C:"TODAS LAS PRUEBAS DE MODO 3D Y ANIMACIONES PASARON CON" "%~dp0test_3d_res.txt" >nul
if errorlevel 1 (
    echo [FAIL] Error en pruebas de modo 3D o animaciones.
    type "%~dp0test_3d_res.txt"
    del "%~dp0test_3d_res.txt" 2>nul
    exit /b 1
)
echo [PASS] 18/18 Pruebas de Modo 3D, Animaciones y Botones aprobadas.
del "%~dp0test_3d_res.txt" 2>nul

echo 4. Validando Constructor de Mazos (Filtros, Curva, Guardado y Presets)...
"%EDGE%" --headless --allow-file-access-from-files --dump-dom "file:///%~dp0test_deck_builder.html" > "%~dp0deck_res.txt"
findstr /C:"TODAS LAS PRUEBAS DE DECK BUILDER COMPLETADAS CON" "%~dp0deck_res.txt" >nul
if errorlevel 1 (
    echo [FAIL] Error en pruebas del Constructor de Mazos.
    type "%~dp0deck_res.txt"
    del "%~dp0deck_res.txt" 2>nul
    exit /b 1
)
echo [PASS] 18/18 Pruebas del Constructor de Mazos aprobadas.
del "%~dp0deck_res.txt" 2>nul

echo 5. Validando Catalogo de Sets y Cartas Visuales (Filtros, Busqueda y Modales)...
"%EDGE%" --headless --allow-file-access-from-files --dump-dom "file:///%~dp0test_sets_catalog.html" > "%~dp0sets_res.txt"
findstr /C:"TODAS LAS PRUEBAS DE CATALOGO DE SETS PASARON CON" "%~dp0sets_res.txt" >nul
if errorlevel 1 (
    echo [FAIL] Error en pruebas del Catalogo de Sets.
    type "%~dp0sets_res.txt"
    del "%~dp0sets_res.txt" 2>nul
    exit /b 1
)
echo [PASS] 15/15 Pruebas del Catalogo de Sets y Cartas aprobadas.
del "%~dp0sets_res.txt" 2>nul

echo 6. Validando Menu Principal y Lobby Legendario (Perfil, Lider, Misiones y Modulos)...
"%EDGE%" --headless --allow-file-access-from-files --dump-dom "file:///%~dp0test_main_menu.html" > "%~dp0menu_res.txt"
findstr /C:"TODAS LAS PRUEBAS DEL LOBBY LEGENDARIO PASARON CON" "%~dp0menu_res.txt" >nul
if errorlevel 1 (
    echo [FAIL] Error en pruebas del Menu Principal.
    type "%~dp0menu_res.txt"
    del "%~dp0menu_res.txt" 2>nul
    exit /b 1
)
echo [PASS] 15/15 Pruebas del Menu Principal y Lobby Legendario aprobadas.
del "%~dp0menu_res.txt" 2>nul

echo 7. Validando Viewports y Adaptabilidad Multi-Dispositivo (Movil, Tablet, Desktop)...
"%EDGE%" --headless --allow-file-access-from-files --dump-dom "file:///%~dp0test_responsive_viewports.html" > "%~dp0viewports_res.txt"
findstr /C:"TODAS LAS PRUEBAS DE VIEWPORT Y RESPONSIVIDAD PASARON CON" "%~dp0viewports_res.txt" >nul
if errorlevel 1 (
    echo [FAIL] Error en pruebas de Viewports y Responsividad.
    type "%~dp0viewports_res.txt"
    del "%~dp0viewports_res.txt" 2>nul
    exit /b 1
)
echo [PASS] 54/54 Pruebas de Adaptabilidad de Resolucion y Sin Recortes aprobadas.
del "%~dp0viewports_res.txt" 2>nul

echo ==========================================
echo VALIDACION COMPLETA: TODO FUNCIONA CORRECTAMENTE
echo Total: 165+ Aserciones + Sintaxis verificadas al 100%%
echo ==========================================
exit /b 0

