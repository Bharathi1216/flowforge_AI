$ErrorActionPreference = 'Stop'
$backendPath = Join-Path $PSScriptRoot 'backend'
$frontendPath = Join-Path $PSScriptRoot 'frontend'
$backendPython = Join-Path $backendPath '.venv\Scripts\python.exe'
$listeningPorts = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty LocalPort -Unique

if (8001 -notin $listeningPorts) {
    if (-not (Test-Path -LiteralPath $backendPython)) {
        throw 'Create backend\.venv with Python 3.11 or 3.12 and install backend\requirements-dev.txt first.'
    }
    & $backendPython -c 'import sys; assert (3, 11) <= sys.version_info[:2] <= (3, 12), "Use Python 3.11 or 3.12"'
    if ($LASTEXITCODE -ne 0) { throw 'The backend Python environment is broken. Recreate backend\.venv.' }
    Push-Location $backendPath
    try {
        & $backendPython -c 'from app.db.database import init_db; init_db()'
        if ($LASTEXITCODE -ne 0) { throw 'Backend readiness failed. Check backend\.env and run python -m app.db.migrate from backend/.' }
    } finally { Pop-Location }
    $backendOut = Join-Path $backendPath '.venv\flowforge.out.log'
    $backendErr = Join-Path $backendPath '.venv\flowforge.err.log'
    Start-Process -FilePath $backendPython -WorkingDirectory $backendPath -WindowStyle Hidden -ArgumentList @(
        '-m', 'uvicorn', 'app.main:app', '--reload', '--host', '127.0.0.1', '--port', '8001'
    ) -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr
    Write-Host "Started FastAPI. Logs: $backendOut and $backendErr"
} else {
    try {
        $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8001/health' -TimeoutSec 3
        if ($health.status -ne 'ok') { throw 'Unexpected health response' }
        Write-Host 'Backend is already responding on port 8001.'
    } catch { Write-Warning 'Port 8001 is occupied by an unhealthy or unrelated process. Review it before starting FlowForge.' }
}

if (5173 -notin $listeningPorts) {
    $viteScript = Join-Path $frontendPath 'node_modules\vite\bin\vite.js'
    if (-not (Test-Path -LiteralPath $viteScript)) { throw 'Run npm ci in frontend/ first.' }
    $frontendLogDir = Join-Path $frontendPath 'node_modules\.tmp'
    New-Item -ItemType Directory -Path $frontendLogDir -Force | Out-Null
    $frontendOut = Join-Path $frontendLogDir 'flowforge.out.log'
    $frontendErr = Join-Path $frontendLogDir 'flowforge.err.log'
    Start-Process -FilePath (Get-Command node).Source -WorkingDirectory $frontendPath -WindowStyle Hidden -ArgumentList @(
        ('"' + $viteScript + '"')
    ) -RedirectStandardOutput $frontendOut -RedirectStandardError $frontendErr
    Write-Host "Started Vite. Logs: $frontendOut and $frontendErr"
} else {
    try {
        $frontend = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 3
        if ($frontend.Content -notmatch '/src/main.tsx') { throw 'Unexpected frontend response' }
        Write-Host 'Vite is already responding on port 5173.'
    } catch { Write-Warning 'Port 5173 is occupied by an unhealthy or unrelated process. Review it before starting FlowForge.' }
}
Write-Host 'Open http://localhost:5173 when both services are ready.'
