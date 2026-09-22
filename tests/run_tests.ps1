# Grand Legends TCG - Script de Validacion Automatizada
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
    $edge = (Get-Command msedge.exe -ErrorAction SilentlyContinue).Source
}

$baseDir = (Get-Item $PSScriptRoot).Parent.FullName
$urlRunner = "file:///" + ($baseDir -replace '\\', '/') + "/tests/test_runner.html"
$urlSyntax = "file:///" + ($baseDir -replace '\\', '/') + "/tests/verify_syntax.html"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "1. Validando Suite de Reglas, IA y Visuales..." -ForegroundColor Yellow

$argsRunner = @("--headless", "--allow-file-access-from-files", "--dump-dom", $urlRunner)
$runnerOut = (& $edge $argsRunner) -join "`n"

if ($runnerOut -match "TODAS LAS PRUEBAS COMPLETADAS CON") {
    Write-Host " [PASS] 36/36 Pruebas de Logica, IA y Visuales pasadas con exito." -ForegroundColor Green
} else {
    Write-Host " [FAIL] Falla en Suite de Logica:" -ForegroundColor Red
    Write-Host $runnerOut
    exit 1
}

Write-Host "2. Validando Sintaxis de Scripts y Funciones de la UI..." -ForegroundColor Yellow

$argsSyntax = @("--headless", "--allow-file-access-from-files", "--dump-dom", $urlSyntax)
$syntaxOut = (& $edge $argsSyntax) -join "`n"

if ($syntaxOut -match "SUCCESS: Todos los scripts compilaron") {
    Write-Host " [PASS] Todos los scripts compilaron sin errores y las funciones de la UI estan operativas." -ForegroundColor Green
} else {
    Write-Host " [FAIL] Error en carga de scripts o funciones de la UI:" -ForegroundColor Red
    Write-Host $syntaxOut
    exit 1
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " VALIDACION COMPLETA: TODO FUNCIONA CORRECTAMENTE " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
exit 0
