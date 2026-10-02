$ErrorActionPreference = 'Stop'

$apiPort = 8001
$ports = @($apiPort, 5173)
$backendPath = Join-Path $PSScriptRoot 'backend'
$backendPython = Join-Path $backendPath '.venv\Scripts\python.exe'
$listeningPorts = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in $ports } |
    Select-Object -ExpandProperty LocalPort -Unique

if ($apiPort -notin $listeningPorts) {
    if (-not (Test-Path $backendPython)) {
        throw 'Backend environment is missing. Create backend\.venv with Python 3.11 and install backend\requirements.txt first.'
    }
    $backendCommand = "& `"$backendPython`" -m uvicorn app.main:app --app-dir . --reload --host 127.0.0.1 --port 8001"
    Start-Process powershell -WorkingDirectory $backendPath -ArgumentList @(
        '-NoExit',
        '-Command',
        $backendCommand
    )
    Write-Host 'Started FastAPI on http://localhost:8001'
} else {
    try {
        $health = Invoke-WebRequest -Uri 'http://127.0.0.1:8001/health' -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        $loginReady = $false
        try {
            $login = Invoke-WebRequest -Uri 'http://127.0.0.1:8001/api/auth/github/login' -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 3 -ErrorAction Stop
                $loginReady = $login.StatusCode -eq 307 -and ([uri]$login.Headers['Location']).Host -eq 'github.com'
        } catch {
                $loginResponse = $_.Exception.Response
                $loginReady = $loginResponse -and [int]$loginResponse.StatusCode -eq 307 -and ([uri]$loginResponse.Headers['Location']).Host -eq 'github.com'
        }

        if ($health.StatusCode -eq 200 -and $loginReady) {
            Write-Host 'FastAPI is already running on port 8001'
        } else {
            Write-Warning 'Port 8001 is occupied, but the backend OAuth check failed. Restart the stale backend process.'
        }
    } catch {
        Write-Warning 'Port 8001 is occupied by a stale or unhealthy process. Restart it before using the app.'
    }
}

if (5173 -notin $listeningPorts) {
    Start-Process powershell -WorkingDirectory (Join-Path $PSScriptRoot 'frontend') -ArgumentList @(
        '-NoExit',
        '-Command',
        'npm run dev'
    )
    Write-Host 'Started Vite on http://localhost:5173'
} else {
    try {
        $frontend = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        if ($frontend.Content -match 'FlowForge AI' -and $frontend.Content -match '/src/main.tsx') {
            Write-Host 'FlowForge frontend is already running on port 5173'
        } else {
            Write-Warning 'Port 5173 is serving a different app. Stop that process, then run start-dev.ps1 again.'
        }
    } catch {
        Write-Warning 'Port 5173 is occupied by an unhealthy or unrelated process. Stop it before starting FlowForge.'
    }
}

Write-Host 'Open http://localhost:5173 when both terminals are ready.'
