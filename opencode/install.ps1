# Installs the Claudle Jump OpenCode plugin into the OpenCode config dir.
# Env: CLAUDLE_JUMP_VERSION (default 0.1.0), CLAUDLE_JUMP_ASSET (local tarball
# instead of a download), OPENCODE_CONFIG_DIR (default ~/.config/opencode).
$ErrorActionPreference = 'Stop'

$version = if ($env:CLAUDLE_JUMP_VERSION) { $env:CLAUDLE_JUMP_VERSION } else { '0.1.0' }
$configDir = if ($env:OPENCODE_CONFIG_DIR) { $env:OPENCODE_CONFIG_DIR } else { Join-Path $HOME '.config/opencode' }
$url = "https://github.com/Moritz-Staat/claudle-jump/releases/download/opencode-v$version/claudle-jump-opencode.tar.gz"

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ('claudle-jump-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
try {
  $asset = Join-Path $tmp 'asset.tar.gz'
  if ($env:CLAUDLE_JUMP_ASSET) {
    Write-Host "Using local asset $($env:CLAUDLE_JUMP_ASSET)"
    Copy-Item -LiteralPath $env:CLAUDLE_JUMP_ASSET -Destination $asset
  } else {
    Write-Host "Downloading $url"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $asset
  }

  $extract = Join-Path $tmp 'x'
  New-Item -ItemType Directory -Force -Path $extract | Out-Null
  Push-Location $tmp
  try {
    & tar -xzf 'asset.tar.gz' -C 'x'
    if ($LASTEXITCODE -ne 0) { throw 'tar failed to extract the asset' }
  } finally {
    Pop-Location
  }
  if (-not (Test-Path (Join-Path $extract 'claudle-jump/tui.tsx'))) { throw 'Asset has no claudle-jump/tui.tsx' }

  New-Item -ItemType Directory -Force -Path $configDir | Out-Null
  $target = Join-Path $configDir 'claudle-jump'
  if (Test-Path $target) { Remove-Item -Recurse -Force $target }
  Copy-Item -Recurse -Path (Join-Path $extract 'claudle-jump') -Destination $target
  Write-Host "Installed plugin folder: $target"

  $entry = './claudle-jump'
  $cli = Join-Path $configDir 'cli.json'
  if (Test-Path $cli) {
    $config = (Get-Content -Raw -Encoding UTF8 $cli).TrimStart([char]0xFEFF) | ConvertFrom-Json
  } else {
    $config = [pscustomobject]@{ '$schema' = 'https://opencode.ai/v2/cli.json'; plugins = @() }
  }
  $plugins = @()
  if ($config.PSObject.Properties['plugins']) { $plugins = @($config.plugins) }
  if ($plugins -contains $entry) {
    Write-Host "cli.json already lists $entry"
  } else {
    $plugins = @($plugins + $entry)
    Write-Host "Added $entry to plugins in $cli"
  }
  # Wrap in a one-element array so a single plugin stays a JSON array.
  $config | Add-Member -NotePropertyName 'plugins' -NotePropertyValue ([object[]]$plugins) -Force
  $json = $config | ConvertTo-Json -Depth 20
  $json = $json -replace '"plugins":\s*"([^"]*)"', '"plugins": ["$1"]'
  [System.IO.File]::WriteAllText($cli, $json + "`n", (New-Object System.Text.UTF8Encoding($false)))

  Write-Host 'Restart OpenCode, then type /jump'
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
