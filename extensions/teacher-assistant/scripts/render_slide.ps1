param([Parameter(Mandatory=$true)][string]$RequestPath)

$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)

function Get-TeacherTextMeasurement {
    param($Shape,[string]$ElementName,$Row=$null,$Column=$null)
    $taskFrame=$Shape.TextFrame
    if($taskFrame.HasText -eq 0){return $null}
    $taskRange=$taskFrame.TextRange
    if($taskRange.Font.Size -le 0){throw 'Uniform font size required'}
    return @{
        element_name=$ElementName
        row=$Row
        column=$Column
        frame_width=[Math]::Max([double]0,[double]($Shape.Width-$taskFrame.MarginLeft-$taskFrame.MarginRight))
        frame_height=[Math]::Max([double]0,[double]($Shape.Height-$taskFrame.MarginTop-$taskFrame.MarginBottom))
        content_width=$taskRange.BoundWidth
        content_height=$taskRange.BoundHeight
        font_size=$taskRange.Font.Size
    }
}

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
    $taskMeasurements=@()
    $taskUnmeasured=@()
    $taskInspected=0
    foreach($taskShape in $taskPresentation.Slides.Item(1).Shapes){
        try {
            if($taskShape.Type -eq 17){
                if($taskInspected -ge 500){$taskUnmeasured+=$taskShape.Name; continue}
                $taskInspected++
                $taskMeasurement=Get-TeacherTextMeasurement -Shape $taskShape -ElementName $taskShape.Name
                if($null -ne $taskMeasurement){$taskMeasurements+=$taskMeasurement}
            } elseif($taskShape.Type -eq 19){
                $taskTable=$taskShape.Table
                $taskVisited=0
                for($taskRow=1; $taskRow -le $taskTable.Rows.Count -and $taskInspected -lt 500; $taskRow++){
                    for($taskColumn=1; $taskColumn -le $taskTable.Columns.Count -and $taskInspected -lt 500; $taskColumn++){
                        $taskInspected++
                        $taskVisited++
                        $taskMeasurement=Get-TeacherTextMeasurement -Shape $taskTable.Cell($taskRow,$taskColumn).Shape -ElementName $taskShape.Name -Row ($taskRow-1) -Column ($taskColumn-1)
                        if($null -ne $taskMeasurement){$taskMeasurements+=$taskMeasurement}
                    }
                }
                if($taskVisited -lt $taskTable.Rows.Count*$taskTable.Columns.Count){$taskUnmeasured+=$taskShape.Name}
            }
        } catch {$taskUnmeasured+=$taskShape.Name}
    }
    $taskVersion='unknown'
    try {$taskVersion=[string]$taskApp.Version} catch {$taskVersion='unknown'}
    @{ok=$true; version=$taskVersion; measurements=$taskMeasurements; unmeasured_objects=$taskUnmeasured} | ConvertTo-Json -Depth 6 -Compress
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
