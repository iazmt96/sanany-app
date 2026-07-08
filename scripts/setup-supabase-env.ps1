param()

$repoRoot = Split-Path -Parent $PSScriptRoot
$webEnvPath = Join-Path $repoRoot "apps\web\.env.local"
$mobileEnvPath = Join-Path $repoRoot "apps\mobile\.env"

function Get-Value([string]$name, [string]$promptText) {
  $value = [Environment]::GetEnvironmentVariable($name)
  if (-not [string]::IsNullOrWhiteSpace($value)) {
    return $value.Trim()
  }

  $inputValue = Read-Host -Prompt $promptText
  if ([string]::IsNullOrWhiteSpace($inputValue)) {
    throw "Missing value for $name"
  }

  return $inputValue.Trim()
}

$supabaseUrl = Get-Value "SUPABASE_URL" "Enter Supabase Project URL (https://xxxx.supabase.co)"
$supabaseAnonKey = Get-Value "SUPABASE_ANON_KEY" "Enter Supabase anon public key"

if (-not $supabaseUrl.StartsWith("https://")) {
  throw "SUPABASE_URL must start with https://"
}

$webContent = @(
  "NEXT_PUBLIC_SUPABASE_URL=$supabaseUrl"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY=$supabaseAnonKey"
) -join [Environment]::NewLine

$mobileContent = @(
  "EXPO_PUBLIC_SUPABASE_URL=$supabaseUrl"
  "EXPO_PUBLIC_SUPABASE_ANON_KEY=$supabaseAnonKey"
) -join [Environment]::NewLine

Set-Content -Path $webEnvPath -Value $webContent -NoNewline
Set-Content -Path $mobileEnvPath -Value $mobileContent -NoNewline

Write-Output "Updated:"
Write-Output " - apps\web\.env.local"
Write-Output " - apps\mobile\.env"
