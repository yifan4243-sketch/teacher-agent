param([Parameter(Mandatory=$true)][string]$RequestPath)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
try {
    $taskRequest=Get-Content -LiteralPath $RequestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if($taskRequest.application_id -notmatch '^TeacherAgentPro\.Reminders\.[a-f0-9]{16}$'){throw 'Invalid application identity'}
    [void][Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime]
    [void][Windows.UI.Notifications.ToastNotifier,Windows.UI.Notifications,ContentType=WindowsRuntime]
    [void][Windows.UI.Notifications.ToastNotification,Windows.UI.Notifications,ContentType=WindowsRuntime]
    [void][Windows.UI.Notifications.NotificationSetting,Windows.UI.Notifications,ContentType=WindowsRuntime]
    [void][Windows.Data.Xml.Dom.XmlDocument,Windows.Data.Xml.Dom.XmlDocument,ContentType=WindowsRuntime]
    $taskKey='HKCU:\Software\Classes\AppUserModelId\'+$taskRequest.application_id
    if($taskRequest.action -eq 'probe' -and -not (Test-Path -LiteralPath $taskKey)){
        @{ok=$true; registered=$false; application_id=$taskRequest.application_id} | ConvertTo-Json -Compress
        exit 0
    }
    if(-not (Test-Path -LiteralPath $taskKey)){
        New-Item -Path $taskKey -Force | Out-Null
        New-ItemProperty -LiteralPath $taskKey -Name DisplayName -Value 'Teacher Agent Pro 教学提醒' -PropertyType String | Out-Null
    }
    $taskNotifier=[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($taskRequest.application_id)
    $taskSettingValue=$taskNotifier.Setting
    $taskSetting=if($null -eq $taskSettingValue){'unknown'}else{[string]$taskSettingValue}
    if($taskRequest.action -eq 'probe'){
        @{ok=$true; registered=$true; setting=$taskSetting; application_id=$taskRequest.application_id} | ConvertTo-Json -Compress
        exit 0
    }
    if($null -ne $taskSettingValue -and [int]$taskSettingValue -ne 0){
        @{ok=$false; error='notification_disabled'; setting=$taskSetting} | ConvertTo-Json -Compress
        exit 1
    }
    $taskXml=[Windows.Data.Xml.Dom.XmlDocument]::new()
    $taskXml.LoadXml('<toast><visual><binding template="ToastGeneric"><text/><text/></binding></visual></toast>')
    $taskNodes=$taskXml.GetElementsByTagName('text')
    [void]$taskNodes.Item(0).AppendChild($taskXml.CreateTextNode([string]$taskRequest.title))
    [void]$taskNodes.Item(1).AppendChild($taskXml.CreateTextNode([string]$taskRequest.body))
    $taskToast=[Windows.UI.Notifications.ToastNotification]::new($taskXml)
    $taskToast.Tag=[string]$taskRequest.tag
    $taskToast.Group='TeacherAgentPro'
    $taskNotifier.Show($taskToast)
    $taskHistoryChecked=$false
    $taskHistoryContains=$false
    try {
        foreach($taskItem in [Windows.UI.Notifications.ToastNotificationManager]::History.GetHistory($taskRequest.application_id)){
            if($taskItem.Tag -eq $taskToast.Tag -and $taskItem.Group -eq $taskToast.Group){$taskHistoryContains=$true}
        }
        $taskHistoryChecked=$true
    } catch {$taskHistoryChecked=$false}
    @{ok=$true; setting=$taskSetting; application_id=$taskRequest.application_id; tag=$taskToast.Tag;
        history_checked=$taskHistoryChecked; history_contains_tag=$taskHistoryContains} | ConvertTo-Json -Compress
} catch {
    @{ok=$false; error='notification_failed'; exception_type=$_.Exception.GetType().Name; hresult=$_.Exception.HResult} | ConvertTo-Json -Compress
    exit 1
}
