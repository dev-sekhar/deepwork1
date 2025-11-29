$file = "components/SessionScheduler.tsx"
$content = Get-Content $file -Raw

# Find and replace the AI suggestions button condition
# Old: {process.env.API_KEY && (
# New: {process.env.API_KEY && itemType === ScheduleItemType.DEEP_WORK && (

$oldPattern = '\{process\.env\.API_KEY && \('
$newPattern = '{process.env.API_KEY && itemType === ScheduleItemType.DEEP_WORK && ('

$content = $content -replace $oldPattern, $newPattern

Set-Content $file $content -NoNewline
Write-Host "AI suggestions disabled for Shallow Work!"
