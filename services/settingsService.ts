export type Theme = 'cyan' | 'green' | 'orange';

export interface Holiday {
    id: string;
    description: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
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
};

export const getSettings = (): AppSettings => {
    try {
        const storedSettings = localStorage.getItem(SETTINGS_KEY);
        if (storedSettings) {
            // Merge stored settings with defaults to handle new settings being added
            return { ...defaultSettings, ...JSON.parse(storedSettings) };
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
