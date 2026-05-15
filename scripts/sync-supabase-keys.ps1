param(
    [string]$EnvFile = ".env.local",
    [string[]]$Targets = @("development", "preview", "production"),
    [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path $EnvFile)) {
    throw "Env file not found: $EnvFile"
}

function Is-PlaceholderValue {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) { return $true }

    $patterns = @(
        'please_replace',
        'change_me',
        '^dev_',
        '^sbp_.*dev_'
    )

    foreach ($pattern in $patterns) {
        if ($Value -match $pattern) { return $true }
    }

    return $false
}

$requiredKeys = @(
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_JWT_SECRET'
)

$lines = Get-Content $EnvFile
$valuesByKey = @{}

foreach ($line in $lines) {
    if ($line -match '^[A-Za-z_][A-Za-z0-9_]*=') {
        $key, $value = $line -split '=', 2
        $valuesByKey[$key.Trim()] = $value.Trim()
    }
}

$updates = @()
foreach ($key in $requiredKeys) {
    if (-not $valuesByKey.ContainsKey($key)) {
        Write-Output ("- SKIP {0}: not found in {1}" -f $key, $EnvFile)
        continue
    }

    $value = $valuesByKey[$key]
    if (Is-PlaceholderValue -Value $value) {
        Write-Output ("- SKIP {0}: placeholder-or-empty" -f $key)
        continue
    }

    $updates += [PSCustomObject]@{
        Key = $key
        Value = $value
    }
}

if ($updates.Count -eq 0) {
    throw 'No valid Supabase keys found to sync.'
}

Write-Output ("Supabase keys ready: {0}" -f $updates.Count)

foreach ($target in $Targets) {
    Write-Output ("[{0}]" -f $target)

    foreach ($item in $updates) {
        Write-Output ("- SYNC {0}" -f $item.Key)

        if ($Apply) {
            npx -y vercel env rm $item.Key $target --yes *> $null

            $tempFile = New-TemporaryFile
            try {
                Set-Content -Path $tempFile.FullName -Value $item.Value -NoNewline
                Get-Content -Path $tempFile.FullName | npx -y vercel env add $item.Key $target --yes *> $null
            }
            finally {
                Remove-Item -Path $tempFile.FullName -ErrorAction SilentlyContinue
            }

            Write-Output ("  applied: {0}" -f $item.Key)
        }
    }

    Write-Output ""
}

if (-not $Apply) {
    Write-Output 'Dry run complete. Re-run with -Apply to execute sync.'
}
