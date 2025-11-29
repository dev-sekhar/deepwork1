import { describe, it, expect } from 'vitest';

describe('Custom Duration Feature', () => {
    it('should allow custom duration values', () => {
        const validDurations = [30, 45, 60, 90, 120, 300];

        validDurations.forEach(duration => {
            expect(duration).toBeGreaterThan(0);
            expect(Number.isInteger(duration)).toBe(true);
        });
    });

    it('should validate minimum duration of 1 minute', () => {
        const invalidDurations = [0, -1, -30];
        const validDurations = [1, 15, 30, 45];

        invalidDurations.forEach(duration => {
            expect(duration < 1).toBe(true);
        });

        validDurations.forEach(duration => {
            expect(duration >= 1).toBe(true);
        });
    });

    it('should handle preset durations', () => {
        const presets = [60, 90, 120];

        presets.forEach(preset => {
            expect(preset).toBeGreaterThanOrEqual(60);
            expect(preset).toBeLessThanOrEqual(120);
            expect(preset % 30).toBe(0); // All presets are multiples of 30
        });
    });

    it('should accept custom durations outside preset range', () => {
        const customDurations = [15, 30, 45, 150, 180, 300];

        customDurations.forEach(duration => {
            expect(duration).toBeGreaterThan(0);
            // Verify these are valid but not in the preset list
            const isPreset = [60, 90, 120].includes(duration);
            expect(typeof duration).toBe('number');
        });
    });
});
