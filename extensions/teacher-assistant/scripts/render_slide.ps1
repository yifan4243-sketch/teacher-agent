param([Parameter(Mandatory=$true)][string]$RequestPath)

$ErrorActionPreference='Stop'
$taskRequest=Get-Content -LiteralPath $RequestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$taskApp=$null
$taskPresentation=$null
$taskError='office_unavailable'
try {
    $taskProgId=@{wps='KWPP.Application'; powerpoint='PowerPoint.Application'}[$taskRequest.renderer]
    $taskApp=New-Object -ComObject $taskProgId
    $taskError='office_render_failed'
    $taskPresentation=$taskApp.Presentations.Open($taskRequest.input_path,-1,0,0)
    if($taskPresentation.Slides.Count -ne 1){throw 'Single-page export required'}
    $taskPresentation.Slides.Item(1).Export($taskRequest.output_path,'PNG',1600,900)
    $taskVersion='unknown'
    try {$taskVersion=[string]$taskApp.Version} catch {$taskVersion='unknown'}
    @{ok=$true; version=$taskVersion} | ConvertTo-Json -Compress
} catch {
    @{ok=$false; error=$taskError} | ConvertTo-Json -Compress
    exit 1
} finally {
    if($taskPresentation){
        $taskPresentation.Close()
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($taskPresentation)
    }
    if($taskApp){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($taskApp)}
}
