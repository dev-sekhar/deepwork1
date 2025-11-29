$file = "components/SessionScheduler.tsx"
$content = Get-Content $file -Raw

# 1. Revert state type
$content = $content -replace "useState<'ONCE' \| 'DAILY' \| 'WEEKLY' \| 'MONTHLY' \| 'CUSTOM'>", "useState<'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'>"

# 2. Remove custom state variables
$content = $content -replace "  const \[customInterval, setCustomInterval\] = useState\(1\);`r?`n  const \[customUnit, setCustomUnit\] = useState<'DAYS' \| 'WEEKS' \| 'MONTHS'>\('DAYS'\);`r?`n", ""

# 3. Revert grid cols
$content = $content -replace "grid grid-cols-5 gap-2", "grid grid-cols-4 gap-2"

# 4. Revert frequency array
$content = $content -replace "\(\['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'\] as const\)", "(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'] as const)"

# 5. Remove custom validation
$validationPattern = "    if \(repeatFrequency === 'CUSTOM'\) \{`r?`n        if \(!customInterval \|\| customInterval < 1\) \{`r?`n            setError\(`"Please specify a valid interval for custom frequency \(minimum 1\)\.`"\);`r?`n            return;`r?`n        \}`r?`n    \}`r?`n"
$content = $content -replace $validationPattern, ""

# 6. Revert baseItemData
$baseItemDataOld = @"
repeatFrequency,
        repeatOn: repeatFrequency === 'WEEKLY' ? repeatOn.sort((a,b) => a-b) : null,
        customInterval: repeatFrequency === 'CUSTOM' ? customInterval : undefined,
        customUnit: repeatFrequency === 'CUSTOM' ? customUnit : undefined,
"@
$baseItemDataNew = "repeatFrequency, repeatOn: repeatFrequency === 'WEEKLY' ? repeatOn.sort((a,b) => a-b) : null,"
$content = $content -replace [regex]::Escape($baseItemDataOld), $baseItemDataNew

# 7. Remove custom UI block
$customUIPattern = "        \{repeatFrequency === 'CUSTOM' && \(`r?`n            <div className=`"animate-fade-in`">`r?`n                <label className=`"block text-sm font-medium text-slate-300 mb-2`">Every</label>`r?`n                <div className=`"grid grid-cols-2 gap-3`">`r?`n                    <input`r?`n                        type=`"number`"`r?`n                        min=`"1`"`r?`n                        value=\{customInterval\}`r?`n                        onChange=\{\(e\) => setCustomInterval\(parseInt\(e\.target\.value\) \|\| 1\)\}`r?`n                        className=`"w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-primary-accent`"`r?`n                        placeholder=`"Interval`"`r?`n                    />`r?`n                    <select`r?`n                        value=\{customUnit\}`r?`n                        onChange=\{\(e\) => setCustomUnit\(e\.target\.value as 'DAYS' \| 'WEEKS' \| 'MONTHS'\)\}`r?`n                        className=`"w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-primary-accent`"`r?`n                    >`r?`n                        <option value=`"DAYS`">Days</option>`r?`n                        <option value=`"WEEKS`">Weeks</option>`r?`n                        <option value=`"MONTHS`">Months</option>`r?`n                    </select>`r?`n                </div>`r?`n            </div>`r?`n        \)\}"
$content = $content -replace $customUIPattern, ""

# 8. Add Custom Duration Input for Deep Work
# We'll replace the existing Deep Work duration block with a new one that includes the input field
$deepWorkDurationOld = @"
                  {[60, 90, 120].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={`px-3 py-2 rounded-md text-sm font-semibold transition ${
                        duration === d ? 'bg-green-500 text-slate-900' : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
"@

$deepWorkDurationNew = @"
                  {[60, 90, 120].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={`px-3 py-2 rounded-md text-sm font-semibold transition ${
                        duration === d ? 'bg-green-500 text-slate-900' : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
                <div className="mt-2">
                    <label className="text-xs text-slate-400 mb-1 block">Custom Duration</label>
                    <input
                        type="number"
                        min="1"
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                        placeholder="Enter minutes"
                    />
                </div>
"@

$content = $content -replace [regex]::Escape($deepWorkDurationOld), $deepWorkDurationNew

Set-Content $file $content -NoNewline
Write-Host "SessionScheduler.tsx updated successfully!"
