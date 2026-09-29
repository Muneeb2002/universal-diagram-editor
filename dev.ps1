param(
    [int]$ClientPort = 3000,
    [int]$ServerPort = 8081,
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$children = [System.Collections.Generic.List[object]]::new()

function Assert-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found on PATH."
    }
}

function Ensure-Dependencies([string]$Directory) {
    if ($SkipInstall -or (Test-Path -LiteralPath (Join-Path $Directory 'node_modules'))) {
        return
    }

    Write-Host "Installing dependencies in $Directory..." -ForegroundColor Cyan
    Push-Location $Directory
    try {
        & yarn.cmd install
        if ($LASTEXITCODE -ne 0) {
            throw "yarn install failed in $Directory."
        }
    } finally {
        Pop-Location
    }
}

function Start-DevProcess(
    [string]$Name,
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$WorkingDirectory
) {
    Write-Host "Starting $Name..." -ForegroundColor Cyan
    # Start-Process can fail when Windows exposes both Path and PATH variables.
    # ProcessStartInfo inherits the same console and avoids that environment merge.
    $quotedArguments = $ArgumentList | ForEach-Object {
        if ($_ -match '[\s"]') {
            '"' + ($_ -replace '"', '\"') + '"'
        } else {
            $_
        }
    }
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $FilePath
    $startInfo.Arguments = $quotedArguments -join ' '
    $startInfo.WorkingDirectory = $WorkingDirectory
    $startInfo.UseShellExecute = $false
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    if (-not $process.Start()) {
        throw "Failed to start $Name."
    }
    $children.Add([pscustomobject]@{ Name = $Name; Process = $process })
}

function Stop-ChildProcess([System.Diagnostics.Process]$Process) {
    try {
        if (-not $Process.HasExited) {
            $Process.Kill()
            $Process.WaitForExit(5000)
        }
    } catch {
        # The process may have exited between the status check and Kill().
    }
}

function Start-ServerProcess([string]$EntryPoint, [string]$WorkingDirectory, [int]$Port) {
    Write-Host "Starting WebSocket server on port $Port..." -ForegroundColor Green
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'node.exe'
    $startInfo.Arguments = "--enable-source-maps `"$EntryPoint`" -w --port $Port"
    $startInfo.WorkingDirectory = $WorkingDirectory
    $startInfo.UseShellExecute = $false
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    if (-not $process.Start()) {
        throw 'Failed to start the WebSocket server.'
    }
    return $process
}

Assert-Command 'node.exe'
Assert-Command 'yarn.cmd'
Assert-Command 'powershell.exe'

$clientRoot = Join-Path $repoRoot 'glsp-client'
$standaloneRoot = Join-Path $clientRoot 'universal-editor-standalone'
$serverRoot = Join-Path $repoRoot 'glsp-server'
$serverProjectRoot = Join-Path $serverRoot 'universal-editor-server'
$serverRuntimeRoot = Join-Path $serverRoot 'universal-editor-server-bundled'
$serverEntryPoint = Join-Path $serverProjectRoot 'lib\node\app.js'
$clientTypeScript = Join-Path $clientRoot 'node_modules\typescript\bin\tsc'
$clientWebpack = Join-Path $clientRoot 'node_modules\webpack\bin\webpack.js'
$serverTypeScript = Join-Path $serverRoot 'node_modules\typescript\bin\tsc'

Ensure-Dependencies $clientRoot
Ensure-Dependencies $serverRoot

$serverBuildMarkers = @(
    (Join-Path $serverRoot 'packages\graph\tsconfig.tsbuildinfo'),
    (Join-Path $serverRoot 'packages\layout-elk\tsconfig.tsbuildinfo'),
    (Join-Path $serverRoot 'packages\server\tsconfig.tsbuildinfo'),
    (Join-Path $serverProjectRoot 'tsconfig.tsbuildinfo')
)
$serverProcess = $null
$lastServerBuildStamp = $null

try {
    # Webpack reads this while creating the browser bundle, keeping custom server
    # ports consistent with the WebSocket process started below.
    $env:GLSP_SERVER_PORT = "$ServerPort"

    # Each watcher owns one build stage. Changes flow from TypeScript to Webpack,
    # then the server runner restarts when its generated bundle changes.
    Start-DevProcess 'client packages TypeScript watcher' 'node.exe' @($clientTypeScript, '-b', '-w', '--preserveWatchOutput') $clientRoot
    Start-DevProcess 'standalone client TypeScript watcher' 'node.exe' @($clientTypeScript, '-b', '-w', '--preserveWatchOutput') $standaloneRoot
    Start-DevProcess 'standalone client Webpack watcher' 'node.exe' @($clientWebpack, '-w') $standaloneRoot
    Start-DevProcess 'server TypeScript watcher' 'node.exe' @($serverTypeScript, '-b', '-w', '--preserveWatchOutput') $serverRoot
    Start-DevProcess `
        'client HTTP server' `
        'node.exe' `
        @((Join-Path $repoRoot 'scripts\static-server.mjs'), $standaloneRoot, "$ClientPort") `
        $repoRoot

    Write-Host ''
    Write-Host 'Development environment is running.' -ForegroundColor Green
    Write-Host "Client:    http://localhost:$ClientPort/app/"
    Write-Host "WebSocket: ws://localhost:$ServerPort"
    Write-Host 'Code changes rebuild automatically. Refresh the browser to load a new client bundle.'
    Write-Host 'Press Ctrl+C to stop everything.'

    while ($true) {
        Start-Sleep -Seconds 1

        if (Test-Path -LiteralPath $serverEntryPoint) {
            $markerTimes = @($serverBuildMarkers | ForEach-Object {
                if (Test-Path -LiteralPath $_) {
                    (Get-Item -LiteralPath $_).LastWriteTimeUtc.Ticks
                }
            })
            $entryTime = (Get-Item -LiteralPath $serverEntryPoint).LastWriteTimeUtc.Ticks
            $serverBuildStamp = (@($entryTime) + $markerTimes | Measure-Object -Maximum).Maximum

            if ($serverBuildStamp -ne $lastServerBuildStamp) {
                if ($null -ne $serverProcess) {
                    Write-Host 'Server build changed; restarting WebSocket server...' -ForegroundColor Yellow
                    Stop-ChildProcess $serverProcess
                }
                $serverProcess = Start-ServerProcess $serverEntryPoint $serverRuntimeRoot $ServerPort
                $lastServerBuildStamp = $serverBuildStamp
            } elseif ($null -ne $serverProcess -and $serverProcess.HasExited) {
                throw "WebSocket server stopped unexpectedly with exit code $($serverProcess.ExitCode)."
            }
        }

        foreach ($child in $children) {
            if ($child.Process.HasExited) {
                throw "$($child.Name) stopped unexpectedly with exit code $($child.Process.ExitCode)."
            }
        }
    }
} finally {
    Write-Host "`nStopping development processes..." -ForegroundColor Yellow
    if ($null -ne $serverProcess) {
        Stop-ChildProcess $serverProcess
    }
    foreach ($child in $children) {
        Stop-ChildProcess $child.Process
    }
}
