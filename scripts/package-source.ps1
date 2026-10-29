$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$releaseDir = Join-Path $projectRoot 'release'
[IO.Directory]::CreateDirectory($releaseDir) | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$zipPath = Join-Path $releaseDir "DongSon-source-$stamp.zip"
$manifestPath = Join-Path $releaseDir "DongSon-source-$stamp.manifest.json"
function Get-Sha256([string] $filePath) {
    $hasher = [Security.Cryptography.SHA256]::Create()
    $inputStream = [IO.File]::OpenRead($filePath)
    try { return ([BitConverter]::ToString($hasher.ComputeHash($inputStream))).Replace('-', '').ToLowerInvariant() }
    finally { $inputStream.Dispose(); $hasher.Dispose() }
}
$rootFiles = @('.gitignore', '.gitattributes', '.dockerignore', '.npmrc', '.nvmrc',
    '.python-version', 'Dockerfile', 'index.html', 'package.json', 'package-lock.json',
    'readme.md', 'RULES.md', 'vite.config.js', 'playwright.config.cjs',
    'playwright.local.config.cjs', 'playwright.pages.config.cjs', 'playwright.web.config.cjs')
$sourceDirs = @('src', 'scripts', 'tests', 'docs', 'packaging', '.github')
$extensions = @('.js', '.cjs', '.mjs', '.py', '.ps1', '.spec', '.json', '.txt', '.md',
    '.html', '.css', '.yml', '.yaml', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.toml')
$selected = [Collections.Generic.List[object]]::new()
foreach ($name in $rootFiles) {
    $file = Get-Item -LiteralPath (Join-Path $projectRoot $name)
    $selected.Add(@{ Source = $file.FullName; Path = $name })
}
function Add-SourceDirectory([string] $directory) {
    foreach ($item in Get-ChildItem -LiteralPath $directory -Force) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
        if ($item.PSIsContainer) {
            if ($item.Name -match '^(node_modules|__pycache__|saves|\.git|\.venv.*|.*cache.*|test-results)$') { continue }
            Add-SourceDirectory $item.FullName
        } elseif ($extensions -contains $item.Extension.ToLowerInvariant()) {
            $relative = $item.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
            $selected.Add(@{ Source = $item.FullName; Path = $relative })
        }
    }
}
foreach ($directory in $sourceDirs) { Add-SourceDirectory (Join-Path $projectRoot $directory) }
$entries = @($selected | Sort-Object -Property Path)
$manifest = [Collections.Generic.List[object]]::new()
$partialPath = $zipPath + '.partial'
$stream = [IO.File]::Open($partialPath, [IO.FileMode]::CreateNew)
$archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create, $false)
try {
    foreach ($entry in $entries) {
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $entry.Source,
            'DongSon/' + $entry.Path, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
        $manifest.Add([ordered]@{ path = $entry.Path; bytes = (Get-Item -LiteralPath $entry.Source).Length;
            sha256 = Get-Sha256 $entry.Source })
    }
} finally { $archive.Dispose(); $stream.Dispose() }
[IO.File]::Move($partialPath, $zipPath)
$report = [ordered]@{ archive = [IO.Path]::GetFileName($zipPath); fileCount = $entries.Count;
    bytes = (Get-Item -LiteralPath $zipPath).Length;
    sha256 = Get-Sha256 $zipPath; files = @($manifest.ToArray()) }
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
Write-Host "Source archive: $zipPath"
Write-Host "Manifest: $manifestPath"
Write-Host "Files: $($entries.Count); ZIP bytes: $($report.bytes)"
