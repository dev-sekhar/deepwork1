$file = "components/SessionScheduler.tsx"
$content = Get-Content $file -Raw

# 1. Update state type to include CUSTOM
$content = $content -replace "useState<'ONCE' \| 'DAILY' \| 'WEEKLY' \| 'MONTHLY'>", "useState<'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM'>"

# 2. Add custom interval and unit state after repeatOn
$stateAddition = @"
  const [repeatOn, setRepeatOn] = useState<number[]>([]);
  const [customInterval, setCustomInterval] = useState(1);
  const [customUnit, setCustomUnit] = useState<'DAYS' | 'WEEKS' | 'MONTHS'>('DAYS');
  const [error, setError] = useState<string | null>(null);
"@
$content = $content -replace "  const \[repeatOn, setRepeatOn\] = useState<number\[\]>\(\[\]\);`r?`n  const \[error, setError\] = useState<string \| null>\(null\);", $stateAddition

# 3. Change grid-cols-4 to grid-cols-5 for repeat buttons
$content = $content -replace "grid grid-cols-4 gap-2", "grid grid-cols-5 gap-2"

# 4. Add CUSTOM to the frequency array
$content = $content -replace "\(\['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'\] as const\)", "(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'] as const)"

# 5. Add validation for CUSTOM frequency (after WEEKLY validation)
$validationAddition = @"
    if (repeatFrequency === 'WEEKLY') {
        if (repeatOn.length === 0) {
            setError("Please select at least one day for weekly tasks.");
            return;
        }
    }

    if (repeatFrequency === 'CUSTOM') {
        if (!customInterval || customInterval < 1) {
            setError("Please specify a valid interval for custom frequency (minimum 1).");
            return;
        }
    }
"@
$content = $content -replace "    if \(repeatFrequency === 'WEEKLY'\) \{`r?`n        if \(repeatOn\.length === 0\) \{`r?`n            setError\(`"Please select at least one day for weekly tasks\.`"\);`r?`n            return;`r?`n        \}`r?`n    \}", $validationAddition

# 6. Add custom fields to baseItemData
$baseItemDataOld = "repeatFrequency, repeatOn: repeatFrequency === 'WEEKLY' ? repeatOn.sort((a,b) => a-b) : null,"
$baseItemDataNew = @"
repeatFrequency,
        repeatOn: repeatFrequency === 'WEEKLY' ? repeatOn.sort((a,b) => a-b) : null,
        customInterval: repeatFrequency === 'CUSTOM' ? customInterval : undefined,
        customUnit: repeatFrequency === 'CUSTOM' ? customUnit : undefined,
"@
$content = $content -replace [regex]::Escape($baseItemDataOld), $baseItemDataNew

# 7. Add UI for custom interval (after WEEKLY days selection)
$customUIAddition = @"
        {repeatFrequency === 'WEEKLY' && (
             <div className="animate-fade-in">
                <label className="block text-sm font-medium text-slate-300 mb-2">On these days</label>
                <div className="flex justify-center gap-2">
                    {WEEK_DAYS.map((day, index) => (
                        <button
                            key={index}
                            type="button"
                            onClick={() => handleToggleRepeatDay(index)}
                            className={``w-10 h-10 rounded-full text-sm font-semibold transition `${
                                repeatOn.includes(index) ? 'bg-primary text-slate-900' : 'bg-slate-700 hover:bg-slate-600'
                            }``}
                        >
                            {day}
                        </button>
                    ))}
                </div>
            </div>
        )}

        {repeatFrequency === 'CUSTOM' && (
            <div className="animate-fade-in">
                <label className="block text-sm font-medium text-slate-300 mb-2">Every</label>
                <div className="grid grid-cols-2 gap-3">
                    <input
                        type="number"
                        min="1"
                        value={customInterval}
                        onChange={(e) => setCustomInterval(parseInt(e.target.value) || 1)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-primary-accent"
                        placeholder="Interval"
                    />
                    <select
                        value={customUnit}
                        onChange={(e) => setCustomUnit(e.target.value as 'DAYS' | 'WEEKS' | 'MONTHS')}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-primary-accent"
                    >
                        <option value="DAYS">Days</option>
                        <option value="WEEKS">Weeks</option>
                        <option value="MONTHS">Months</option>
                    </select>
                </div>
            </div>
        )}
"@

# Find and replace the WEEKLY section
$weeklyPattern = "        \{repeatFrequency === 'WEEKLY' && \(`r?`n             <div className=`"animate-fade-in`">`r?`n                <label className=`"block text-sm font-medium text-slate-300 mb-2`">On these days</label>`r?`n                <div className=`"flex justify-center gap-2`">`r?`n                    \{WEEK_DAYS\.map\(\(day, index\) => \(`r?`n                        <button`r?`n                            key=\{index\}`r?`n                            type=`"button`"`r?`n                            onClick=\{\(\) => handleToggleRepeatDay\(index\)\}`r?`n                            className=\{`w-10 h-10 rounded-full font-bold text-sm flex items-center justify-center transition \$\{`r?`n                                repeatOn\.includes\(index\) \? 'bg-primary text-slate-900' : 'bg-slate-700 hover:bg-slate-600'`r?`n                            \}`\}`r?`n                        >\{day\}</button>`r?`n                    \)\)\}`r?`n                </div>`r?`n            </div>`r?`n        \)\}"

$content = $content -replace $weeklyPattern, $customUIAddition

Set-Content $file $content -NoNewline
Write-Host "SessionScheduler.tsx updated successfully!"
