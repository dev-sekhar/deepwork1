export type Theme = 'cyan' | 'green' | 'orange';

export interface Holiday {
    id: string;
    description: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
}

export interface AIPreferences {
    enabled: boolean; // Master toggle
    features: {
        voiceInput: boolean;
        voiceOutput: boolean;
        taskSuggestions: boolean;
        goalAnalysis: boolean;
        ritualGeneration: boolean;
        classification: boolean;
    }
}

export interface AppSettings {
    availability: {
        days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
        startTime: string; // HH:mm
        endTime: string; // HH:mm
    };
    holidays: Holiday[];
    theme: Theme;
    aiPersonalization: string;
    aiPreferences: AIPreferences;
}

const SETTINGS_KEY = 'deepWorkAppSettings';

const defaultSettings: AppSettings = {
    availability: {
        days: [1, 2, 3, 4, 5], // Mon-Fri
        startTime: '09:00',
        endTime: '17:00',
    },
    holidays: [],
    theme: 'cyan',
    aiPersonalization: 'Be a supportive and encouraging productivity coach.',
    aiPreferences: {
        enabled: true,
        features: {
            voiceInput: true,
            voiceOutput: true,
            taskSuggestions: true,
            goalAnalysis: true,
            ritualGeneration: true,
            classification: true,
        }
    }
};

export const getSettings = (): AppSettings => {
    try {
        const storedSettings = localStorage.getItem(SETTINGS_KEY);
        if (storedSettings) {
            const parsedSettings = JSON.parse(storedSettings);
            // Merge stored settings with defaults
            // We need to handle deep merging for aiPreferences to ensure new fields are added
            const mergedSettings = { ...defaultSettings, ...parsedSettings };

            // Deep merge aiPreferences if it exists in both
            if (parsedSettings.aiPreferences) {
                mergedSettings.aiPreferences = {
                    ...defaultSettings.aiPreferences,
                    ...parsedSettings.aiPreferences,
                    features: {
                        ...defaultSettings.aiPreferences.features,
                        ...(parsedSettings.aiPreferences.features || {})
                    }
                };
            }

            return mergedSettings;
        }
        return defaultSettings;
    } catch (error) {
        console.error("Failed to read settings from localStorage:", error);
        return defaultSettings;
    }
};

export const saveSettings = (settings: AppSettings): void => {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
        console.error("Failed to save settings to localStorage:", error);
    }
};
