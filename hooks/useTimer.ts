
import { useState, useEffect, useRef, useCallback } from 'react';

interface TimerControl {
  secondsLeft: number;
  isActive: boolean;
  start: () => void;
  pause: () => void;
  reset: (newSeconds: number) => void;
}

export const useTimer = (initialSeconds: number): TimerControl => {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const start = useCallback(() => {
    if (secondsLeft > 0) {
      setIsActive(true);
    }
  }, [secondsLeft]);

  const pause = useCallback(() => {
    setIsActive(false);
  }, []);

  const reset = useCallback((newSeconds: number) => {
    setIsActive(false);
    setSecondsLeft(newSeconds);
  }, []);

  useEffect(() => {
    if (isActive && secondsLeft > 0) {
      intervalRef.current = window.setInterval(() => {
        setSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (!isActive && intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    } else if (secondsLeft === 0) {
      setIsActive(false);
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [isActive, secondsLeft]);

  return { secondsLeft, isActive, start, pause, reset };
};
