import React from 'react';
import { SparklesIcon } from './icons';

interface TokenConfirmDialogProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    estimatedCost?: string; // e.g. "~150 tokens"
}

export const TokenConfirmDialog: React.FC<TokenConfirmDialogProps> = ({ isOpen, onConfirm, onCancel, estimatedCost }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md space-y-4 transform animate-fade-in-up">
                <div className="flex items-center gap-3 text-primary-accent">
                    <SparklesIcon className="w-6 h-6" />
                    <h2 className="text-xl font-bold">AI Feature Confirmation</h2>
                </div>

                <p className="text-slate-300">
                    This action requires sending data to an AI service.
                    {estimatedCost && <span className="block mt-2 text-sm text-slate-400">Estimated usage: {estimatedCost}</span>}
                </p>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 bg-violet-600 text-white font-semibold rounded-md hover:bg-violet-700 transition"
                    >
                        Proceed
                    </button>
                </div>
            </div>
        </div>
    );
};
