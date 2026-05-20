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
    '^xoxb-dev',
    '^sk_test_dev_',
    '^pk_test_dev_',
    '^whsec_dev_',
    '^sbp_.*dev_',
    '^upstash_.*_change_me',
    '^re_dev_'
  )

  foreach ($pattern in $patterns) {
    if ($Value -match $pattern) { return $true }
  }

  return $false
}

function Is-ReservedKey {
  param([string]$Key)

  return ($Key -like 'VERCEL_*' -or $Key -like 'TURBO_*' -or $Key -like 'NX_*')
}

function Is-RiskyValue {
  param(
    [string]$Key,
    [string]$Value,
    [string]$Target
  )

  # Never push a localhost Redis URL to preview/production. Use -like for
  # robustness — the previous -match regex failed silently under StrictMode.
  if ($Target -ne 'development' -and $Key -eq 'REDIS_URL' -and ($Value -like '*127.0.0.1*' -or $Value -like '*localhost*')) { return $true }
  if ($Target -ne 'development' -and $Key -eq 'DEV_AUTH_BYPASS' -and ($Value -eq 'true' -or $Value -eq '1')) { return $true }

  return $false
}

$lines = Get-Content $EnvFile
$pairs = @()

# Normalize targets to support either array input or comma-separated string.
$normalizedTargets = @()
foreach ($target in $Targets) {
  if ([string]::IsNullOrWhiteSpace($target)) { continue }
  $normalizedTargets += $target.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
}
if ($normalizedTargets.Count -eq 0) {
  throw 'No valid targets provided. Use development, preview, and/or production.'
}

foreach ($line in $lines) {
  if ($line -match '^[A-Za-z_][A-Za-z0-9_]*=') {
    $key, $value = $line -split '=', 2
    $pairs += [PSCustomObject]@{
      Key = $key.Trim()
      Value = $value.Trim()
    }
  }
}

$syncable = @()
$skipped = @()

foreach ($pair in $pairs) {
  if (Is-ReservedKey -Key $pair.Key) {
    $skipped += [PSCustomObject]@{ Key = $pair.Key; Reason = 'reserved' }
    continue
  }

  if (Is-PlaceholderValue -Value $pair.Value) {
    $skipped += [PSCustomObject]@{ Key = $pair.Key; Reason = 'placeholder-or-empty' }
    continue
  }

  $syncable += $pair
}

Write-Output ("Loaded keys: {0}" -f $pairs.Count)
Write-Output ("Syncable keys: {0}" -f $syncable.Count)
Write-Output ("Skipped keys: {0}" -f $skipped.Count)
Write-Output ""
Write-Output "Skipped key reasons:"
$skipped | Sort-Object Key | ForEach-Object {
  Write-Output ("- {0}: {1}" -f $_.Key, $_.Reason)
}
Write-Output ""
Write-Output "Planned sync matrix (values hidden):"

foreach ($target in $normalizedTargets) {
  Write-Output ("[{0}]" -f $target)

  $targetKeys = @()
  foreach ($item in $syncable) {
    if (Is-RiskyValue -Key $item.Key -Value $item.Value -Target $target) {
      Write-Output ("- SKIP {0}: risky-value-for-target" -f $item.Key)
      continue
    }

    Write-Output ("- SYNC {0}" -f $item.Key)
    $targetKeys += $item
  }

  if ($Apply) {
    foreach ($item in $targetKeys) {
      $escaped = $item.Value.Replace('"', '""')

      # Remove existing key first to avoid interactive overwrite prompts.
      cmd /c "npx -y vercel env rm $($item.Key) $target --yes >nul 2>nul" | Out-Null

      $cmd = "echo $escaped | npx -y vercel env add $($item.Key) $target --yes >nul 2>nul"
      cmd /c $cmd | Out-Null
      Write-Output ("  applied: {0}" -f $item.Key)
    }
  }

  Write-Output ""
}

if (-not $Apply) {
  Write-Output "Dry run complete. Re-run with -Apply to execute sync."
}
