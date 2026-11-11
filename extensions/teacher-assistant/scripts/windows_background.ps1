param([Parameter(Mandatory=$true)][string]$RequestPath)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
try {
    $request = Get-Content -LiteralPath $RequestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $scheduler = New-Object -ComObject 'Schedule.Service'
    $scheduler.Connect()
    $folder = $scheduler.GetFolder('\')
    $existing = @($folder.GetTasks(1) | Where-Object { $_.Name -eq $request.name })
    if ($existing.Count -gt 0 -and $existing[0].Definition.RegistrationInfo.Description -ne $request.description) {
        throw 'Task identity is owned by another configuration'
    }
    if ($request.action -eq 'install') {
        $definition = $scheduler.NewTask(0)
        $definition.RegistrationInfo.Description = $request.description
        $definition.Principal.UserId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
        $definition.Principal.LogonType = 3
        $definition.Principal.RunLevel = 0
        $definition.Settings.Enabled = $true
        $definition.Settings.Hidden = $true
        $definition.Settings.StartWhenAvailable = $true
        $definition.Settings.DisallowStartIfOnBatteries = $false
        $definition.Settings.StopIfGoingOnBatteries = $false
        $definition.Settings.MultipleInstances = 2
        $definition.Settings.ExecutionTimeLimit = 'PT4M'
        $trigger = $definition.Triggers.Create(1)
        $trigger.StartBoundary = (Get-Date).AddSeconds(5).ToString('yyyy-MM-ddTHH:mm:ss')
        $trigger.Repetition.Interval = 'PT1M'
        $trigger.Enabled = $true
        $action = $definition.Actions.Create(0)
        $action.Path = $request.executable
        $action.Arguments = $request.arguments
        $action.WorkingDirectory = $request.workdir
        $registered = $folder.RegisterTaskDefinition($request.name, $definition, 6, $definition.Principal.UserId, $null, 3)
        $registered.Run($null) | Out-Null
    } elseif ($request.action -eq 'remove' -and $existing.Count -gt 0) {
        $folder.DeleteTask($request.name, 0)
    }
    $tasks = @($folder.GetTasks(1) | Where-Object { $_.Name -eq $request.name })
    $response = @{ok=$true; name=$request.name; installed=($tasks.Count -gt 0)}
    if ($tasks.Count -gt 0) {
        $response.enabled = [bool]$tasks[0].Enabled
        $response.last_result = [long]$tasks[0].LastTaskResult
        $response.last_run_at = $tasks[0].LastRunTime.ToString('s')
        $response.next_run_at = $tasks[0].NextRunTime.ToString('s')
        $response.state = [int]$tasks[0].State
    }
    $response | ConvertTo-Json -Compress
} catch {
    @{ok=$false; error='background_task_failed'; detail=$_.Exception.Message} | ConvertTo-Json -Compress
    exit 1
}
