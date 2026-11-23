param([string]$Version='2026-11-23')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$stage=Join-Path $root ('work/release-'+$Version+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8))
$out=Join-Path $root 'output/releases'
New-Item -ItemType Directory -Path $stage,$out -Force | Out-Null
foreach($dir in @('server','web','kb','deploy','tests')) {
  Copy-Item -LiteralPath (Join-Path $root $dir) -Destination (Join-Path $stage $dir) -Recurse
}
New-Item -ItemType Directory -Path (Join-Path $stage 'data') -Force | Out-Null
Get-ChildItem -LiteralPath (Join-Path $root 'data') -Filter '*.json' -File | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $stage 'data')
}
$catalog=Get-Content -LiteralPath (Join-Path $root 'data/knowledge-catalog.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach($doc in $catalog.documents) {
  $target=Join-Path $stage $doc.file
  New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $root $doc.file) -Destination $target
}
foreach($name in @('README.md','package.json','.env.example')) {
  Copy-Item -LiteralPath (Join-Path $root $name) -Destination (Join-Path $stage $name)
}
New-Item -ItemType Directory -Path (Join-Path $stage 'docs') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $root 'docs/PUBLIC-DEPLOYMENT.md') -Destination (Join-Path $stage 'docs/PUBLIC-DEPLOYMENT.md')
$zip=Join-Path $out ('andrology-knowledge-'+$Version+'.zip')
if(Test-Path -LiteralPath $zip){throw '同名发布包已存在，请换一个 Version；不会覆盖已有发布包。'}
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
Write-Output $zip
Write-Output '发布包包含知识目录引用的专题与证据文档；不包含 .env、日志、原始语料索引或历史备份。'
