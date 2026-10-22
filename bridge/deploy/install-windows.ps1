<#
  ClimateKing Home Bridge - one-time setup for Windows 10 / 11.
  Run it by double-clicking bridge\Install-Bridge.bat. It:
    1. installs Python 3.12 (through winget) if no Python 3.11+ is present,
    2. installs the bridge into bridge\.venv,
    3. asks for your ClimateKing account and, optionally, Tuya cloud keys, and writes bridge.env,
    4. checks the setup (sign-in, ACs on this Wi-Fi),
    5. starts the bridge in the background now and at every sign-in to Windows.
  Run it again any time to change the account or keys.
#>

$ErrorActionPreference = 'Stop'
$BridgeDir = Split-Path -Parent $PSScriptRoot
$RepoDir = Split-Path -Parent $BridgeDir
$Venv = Join-Path $BridgeDir '.venv'
$EnvFile = Join-Path $BridgeDir 'bridge.env'
$TaskName = 'ClimateKing Home Bridge'

function Say($text, $color = 'Gray') { Write-Host $text -ForegroundColor $color }
function Step($text) { Write-Host ''; Write-Host "==> $text" -ForegroundColor Cyan }

function Find-Python {
    # Returns a command line (array) that runs Python 3.11+, or $null.
    $candidates = @(@('py', '-3.12'), @('py', '-3.11'), @('py', '-3'), @('python'), @('python3'))
    foreach ($c in $candidates) {
        try {
            $exe = $c[0]
            $rest = @($c | Select-Object -Skip 1)
            $ok = & $exe @rest -c 'import sys; print(sys.version_info >= (3, 11))' 2>$null
            if ($LASTEXITCODE -eq 0 -and "$ok".Trim() -eq 'True') { return , $c }
        } catch { }
    }
    $local = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'
    if (Test-Path $local) { return , @($local) }
    return $null
}

function Read-Secret($prompt) {
    $secure = Read-Host $prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Read-Default($prompt, $default) {
    $suffix = if ($default) { " [$default]" } else { '' }
    $value = Read-Host "$prompt$suffix"
    if ([string]::IsNullOrWhiteSpace($value)) { return $default }
    return $value.Trim()
}

function Read-EnvFile($path) {
    $values = @{}
    if (Test-Path $path) {
        foreach ($line in Get-Content $path) {
            if ($line -match '^\s*([A-Z_]+)\s*=\s*(.*)$') { $values[$Matches[1]] = $Matches[2].Trim() }
        }
    }
    return $values
}

Write-Host ''
Say 'ClimateKing Home Bridge setup' 'White'
Say 'Keep this computer on the same Wi-Fi as your ACs.'

# --- 1. Python ---------------------------------------------------------------------------------
Step 'Checking Python'
$python = Find-Python
if (-not $python) {
    Say 'Python 3.11+ not found. Installing Python 3.12 with winget (about 30 MB)...'
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Say 'winget is not available. Install Python 3.12 from https://www.python.org/downloads/ (tick "Add to PATH"), then run this again.' 'Yellow'
        exit 1
    }
    winget install -e --id Python.Python.3.12 --scope user --silent --accept-package-agreements --accept-source-agreements
    $python = Find-Python
    if (-not $python) {
        Say 'Python was installed but cannot be found yet. Close this window and run Install-Bridge.bat again.' 'Yellow'
        exit 1
    }
}
$pyExe = $python[0]
$pyArgs = @($python | Select-Object -Skip 1)
Say ("Using " + (& $pyExe @pyArgs --version))

# --- 2. Bridge ---------------------------------------------------------------------------------
Step 'Installing the bridge'
if (-not (Test-Path (Join-Path $Venv 'Scripts\python.exe'))) {
    & $pyExe @pyArgs -m venv $Venv
}
$VenvPython = Join-Path $Venv 'Scripts\python.exe'
$VenvPythonW = Join-Path $Venv 'Scripts\pythonw.exe'
& $VenvPython -m pip install --quiet --upgrade pip
$extras = ''
if (Get-Command git -ErrorAction SilentlyContinue) {
    $extras = '[haier]'
} else {
    Say 'Git is not installed, so Haier support is skipped (install Git and run this again if you have a Haier AC).' 'Yellow'
}
Push-Location $BridgeDir
try { & $VenvPython -m pip install --quiet -e ".$extras" } finally { Pop-Location }
if ($LASTEXITCODE -ne 0) { Say 'Installing the bridge failed (see the messages above).' 'Red'; exit 1 }
Say 'Bridge installed.' 'Green'

# --- 3. Settings -------------------------------------------------------------------------------
Step 'Your ClimateKing account'
$current = Read-EnvFile $EnvFile
$url = $current['SUPABASE_URL']
$anon = $current['SUPABASE_ANON_KEY']
if (-not $url -or -not $anon) {
    # The app's own (public) project settings, so the bridge talks to the same backend.
    $appConfig = Join-Path $RepoDir 'src\config\supabase.ts'
    if (Test-Path $appConfig) {
        $text = Get-Content $appConfig -Raw
        if ($text -match "SUPABASE_URL\s*=\s*'([^']+)'") { $url = $Matches[1] }
        if ($text -match "SUPABASE_ANON_KEY\s*=\s*\r?\n?\s*'([^']+)'") { $anon = $Matches[1] }
    }
}
if (-not $url) { $url = Read-Host 'Supabase URL (https://....supabase.co)' }
if (-not $anon) { $anon = Read-Host 'Supabase anon key' }

$email = Read-Default 'Email you sign in to the app with' $current['CK_EMAIL']
$password = Read-Secret 'Password (typing is hidden; press Enter to keep the saved one)'
if ([string]::IsNullOrEmpty($password)) { $password = $current['CK_PASSWORD'] }
if (-not $email -or -not $password) { Say 'Email and password are required.' 'Red'; exit 1 }

Step 'Tuya cloud (only for Hyundai / Smart Life ACs)'
Say 'From iot.tuya.com -> Cloud -> your project -> Overview. Press Enter to skip.'
$tuyaKey = Read-Default 'Access ID' $current['TUYA_API_KEY']
$tuyaSecret = $current['TUYA_API_SECRET']
$tuyaRegion = $current['TUYA_REGION']
if ($tuyaKey) {
    $newSecret = Read-Secret 'Access Secret (hidden; Enter keeps the saved one)'
    if ($newSecret) { $tuyaSecret = $newSecret }
    $tuyaRegion = Read-Default 'Data center: in (India), eu (Central Europe), us, sg or cn' ($(if ($tuyaRegion) { $tuyaRegion } else { 'in' }))
}

$lines = @(
    '# Written by install-windows.ps1. Holds your password: keep it on this computer only.',
    "SUPABASE_URL=$url",
    "SUPABASE_ANON_KEY=$anon",
    "CK_EMAIL=$email",
    "CK_PASSWORD=$password",
    "CK_BRIDGE_NAME=$env:COMPUTERNAME",
    "CK_LOG_FILE=$(Join-Path $BridgeDir 'bridge.log')"
)
if ($tuyaKey -and $tuyaSecret) {
    $lines += "TUYA_REGION=$tuyaRegion", "TUYA_API_KEY=$tuyaKey", "TUYA_API_SECRET=$tuyaSecret"
}
Set-Content -Path $EnvFile -Value $lines -Encoding UTF8
# Only the current user may read the file with the password in it.
icacls $EnvFile /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null
Say "Saved $EnvFile" 'Green'

# --- 4. Firewall and sleep ----------------------------------------------------------------------
Step 'Letting the ACs answer'
Say 'ACs reply to the bridge over UDP. Windows asks once to allow Python on private networks.'
$rule = "netsh advfirewall firewall delete rule name=`"ClimateKing Bridge`" >nul 2>&1 & " +
    "netsh advfirewall firewall add rule name=`"ClimateKing Bridge`" dir=in action=allow profile=private program=`"$VenvPython`" & " +
    "netsh advfirewall firewall add rule name=`"ClimateKing Bridge`" dir=in action=allow profile=private program=`"$VenvPythonW`""
try {
    Start-Process cmd -ArgumentList "/c $rule" -Verb RunAs -Wait -WindowStyle Hidden
    Say 'Firewall rule added (private networks only).' 'Green'
} catch {
    Say 'Firewall rule skipped. If Windows asks later, click "Allow" for Python on private networks.' 'Yellow'
}
$sleep = Read-Host 'Keep this computer awake while plugged in, so the bridge never stops? (Y/n)'
if ($sleep -notmatch '^[nN]') {
    powercfg /change standby-timeout-ac 0
    Say 'Sleep on mains power turned off.' 'Green'
}

# --- 5. Check ----------------------------------------------------------------------------------
Step 'Checking the setup'
Push-Location $BridgeDir
try { & $VenvPython -m climateking_bridge doctor; $doctor = $LASTEXITCODE } finally { Pop-Location }
if ($doctor -ne 0) {
    Say 'The check found a problem (above). Fix it and run Install-Bridge.bat again.' 'Red'
    exit 1
}

# --- 6. Run in the background ----------------------------------------------------------------
Step 'Starting the bridge'
$action = New-ScheduledTaskAction -Execute $VenvPythonW -Argument '-m climateking_bridge run' -WorkingDirectory $BridgeDir
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -Description 'Keeps ClimateKing ACs connected and controllable from anywhere.' | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host ''
Say 'Done. The Home Bridge is running and starts again whenever you sign in to Windows.' 'Green'
Say "Log file: $(Join-Path $BridgeDir 'bridge.log')"
Say 'Open the app: Home shows "Connected through <this computer>", and new ACs appear under Add Device.'
Say "To stop it: Task Scheduler -> '$TaskName' -> Disable."
