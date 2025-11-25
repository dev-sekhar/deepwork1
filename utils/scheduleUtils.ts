import { ScheduleItem } from '../types';

export const getTasksForDate = (schedule: ScheduleItem[], date: Date): ScheduleItem[] => {
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    return schedule.filter(item => {
        // Filter out logically deleted (cancelled) one-time tasks
        if (item.isCancelled) {
            return false;
        }

        const itemStartDate = new Date(item.startDate);
        itemStartDate.setHours(0, 0, 0, 0);

        // Filter out recurring tasks that have ended
        if (item.endDate) {
            const itemEndDate = new Date(item.endDate);
            itemEndDate.setHours(0, 0, 0, 0);
            if (checkDate > itemEndDate) {
                return false;
            }
        }

        // Filter out tasks that are paused on this date
        if (item.pauses && item.pauses.length > 0) {
            const isPaused = item.pauses.some(pause => {
                const pauseStart = new Date(pause.startDate);
                pauseStart.setHours(0, 0, 0, 0);
                const pauseEnd = new Date(pause.endDate);
                pauseEnd.setHours(0, 0, 0, 0);
                return checkDate >= pauseStart && checkDate <= pauseEnd;
            });
            if (isPaused) {
                return false;
            }
        }

        if (item.repeatFrequency === 'ONCE') {
            return itemStartDate.getTime() === checkDate.getTime();
        }

        // Don't show recurring tasks before their official start date
        if (itemStartDate.getTime() > checkDate.getTime()) {
            return false;
        }

        switch (item.repeatFrequency) {
            case 'DAILY':
                return true;
            case 'WEEKLY':
                return item.repeatOn?.includes(checkDate.getDay()) ?? false;
            case 'MONTHLY':
                return new Date(item.startDate).getDate() === checkDate.getDate();
            default:
                return false;
        }
    });
};
