$ErrorActionPreference = 'Stop'

$apiPort = 8001
$ports = @($apiPort, 5173)
$listeningPorts = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in $ports } |
    Select-Object -ExpandProperty LocalPort -Unique

if ($apiPort -notin $listeningPorts) {
    Start-Process powershell -WorkingDirectory (Join-Path $PSScriptRoot 'backend') -ArgumentList @(
        '-NoExit',
        '-Command',
        'python -m uvicorn app.main:app --app-dir . --reload --host 127.0.0.1 --port 8001'
    )
    Write-Host 'Started FastAPI on http://localhost:8001'
} else {
    try {
        $health = Invoke-WebRequest -Uri 'http://127.0.0.1:8001/health' -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        $loginReady = $false
        try {
            $login = Invoke-WebRequest -Uri 'http://127.0.0.1:8001/api/auth/github/login' -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 3 -ErrorAction Stop
            $loginReady = $login.StatusCode -eq 307
        } catch {
            $loginReady = $_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 307
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
    Write-Host 'Vite is already running on port 5173'
}

Write-Host 'Open http://localhost:5173 when both terminals are ready.'
