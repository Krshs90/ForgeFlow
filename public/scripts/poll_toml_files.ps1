


$watchDir = Join-Path $env:USERPROFILE "Downloads"
$baseDir = Join-Path $env:USERPROFILE ".genAI"
$procDir = Join-Path $baseDir "processed-toml"
$failDir = Join-Path $baseDir "failed-toml"
$stateDir = Join-Path $baseDir ".toml-processor-state"
$logFile = Join-Path $baseDir "toml-processor.log"
$pythonScript = Join-Path $baseDir "toml_processor.py"


$dirs = @($baseDir, $procDir, $failDir, $stateDir)
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:sc"
    $logEntry = "[$timestamp] $Message"
    Write-Host $logEntry
    Add-Content -Path $logFile -Value $logEntry
}

Write-Log "Starting ForgeFlow TOML Processor Service"


try {
    $pythonVer = python -c "import sys; print(sys.version_info >= (3, 11))" 2>$null
    if ($pythonVer -match "False") {
        Write-Log "Python version < 3.11 detected. Checking for tomli..."
        $tomliCheck = python -c "import tomli" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Log "tomli not found, installing..."
            pip install tomli | Out-Null
        }
    }
} catch {
    Write-Log "Warning: Python check failed. Make sure Python is installed and in PATH."
}


Add-Type -AssemblyName System.Windows.Forms


while ($true) {
    
    Get-ChildItem -Path $stateDir | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item -Force -ErrorAction SilentlyContinue

    $tomlFiles = Get-ChildItem -Path $watchDir -Filter "*.toml" -File
    
    foreach ($file in $tomlFiles) {
        $stateFile = Join-Path $stateDir "$($file.Name).state"
        
        
        if (Test-Path $stateFile) {
            continue
        }

        
        try {
            $stream = [System.IO.File]::Open($file.FullName, 'Open', 'Read', 'None')
            $stream.Close()
        } catch {
            Write-Log "File $($file.Name) is locked by another process. Skipping for now."
            continue
        }

        
        Write-Log "Found new TOML file: $($file.FullName)"
        $result = [System.Windows.Forms.MessageBox]::Show(
            "ForgeFlow found a new workspace TOML configuration file:`n$($file.Name)`n`nWould you like to process and orchestrate this workspace?",
            "ForgeFlow Orchestrator",
            [System.Windows.Forms.MessageBoxButtons]::YesNo,
            [System.Windows.Forms.MessageBoxIcon]::Question
        )

        if ($result -eq [System.Windows.Forms.DialogResult]::Yes) {
            Write-Log "User approved execution for $($file.Name)"
            
            
            if (-not (Test-Path $pythonScript)) {
                Write-Log "ERROR: Python processor script not found at $pythonScript"
                continue
            }

            
            Write-Log "Executing $pythonScript on $($file.FullName)"
            
            $processInfo = New-Object System.Diagnostics.ProcessStartInfo
            $processInfo.FileName = "python"
            $processInfo.Arguments = "`"$pythonScript`" `"$($file.FullName)`""
            $processInfo.RedirectStandardOutput = $true
            $processInfo.RedirectStandardError = $true
            $processInfo.UseShellExecute = $false
            $processInfo.CreateNoWindow = $true

            $process = New-Object System.Diagnostics.Process
            $process.StartInfo = $processInfo
            $process.Start() | Out-Null
            $process.WaitForExit()

            $stdout = $process.StandardOutput.ReadToEnd()
            $stderr = $process.StandardError.ReadToEnd()

            if ($process.ExitCode -eq 0) {
                Write-Log "Successfully processed $($file.Name)"
                Move-Item -Path $file.FullName -Destination $procDir -Force
                New-Item -ItemType File -Path $stateFile -Value "SUCCESS" | Out-Null
            } else {
                Write-Log "Failed to process $($file.Name). Exit code: $($process.ExitCode). Error: $stderr"
                Move-Item -Path $file.FullName -Destination $failDir -Force
                New-Item -ItemType File -Path $stateFile -Value "FAILED" | Out-Null
            }

        } else {
            Write-Log "User explicitly rejected processing for $($file.Name)"
            New-Item -ItemType File -Path $stateFile -Value "REJECTED" | Out-Null
        }
    }

    
    Start-Sleep -Seconds 5
}
