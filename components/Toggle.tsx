import React from 'react';

interface ToggleProps {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({ label, description, checked, onChange, disabled = false }) => {
    return (
        <div className={`flex items-center justify-between py-3 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <div className="flex-1 pr-4">
                <label className={`font-medium text-slate-200 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`} onClick={() => !disabled && onChange(!checked)}>
                    {label}
                </label>
                {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => !disabled && onChange(!checked)}
                disabled={disabled}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-accent focus:ring-offset-2 focus:ring-offset-slate-800 ${checked ? 'bg-primary' : 'bg-slate-600'
                    }`}
            >
                <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'
                        }`}
                />
            </button>
        </div>
    );
};
