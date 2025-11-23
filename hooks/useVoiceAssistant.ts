import { useState, useRef, useEffect, useCallback } from 'react';
import { ScheduleItem, ScheduleItemType, SessionStatus, DeepWorkSession, ShallowWorkTask } from '../types';
import { parseNaturalLanguageTask, getTaskSuggestions, AIServiceError, TaskSuggestions } from '../services/aiService';
import { logInfo, logError, logWarn } from '../services/logService';
import { getSettings } from '../services/settingsService';

type AssistantState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'ERROR';
type ConversationTurn = { speaker: 'user' | 'assistant', text: string };
type ConversationStep = 'GREETING' | 'AWAITING_TASK' | 'FILLING_DETAILS' | 'GETTING_SUGGESTIONS' | 'PROCESSING_SUGGESTIONS' | 'CONFIRMING_TASK' | 'AWAITING_CORRECTION' | 'FINALIZING';

interface UseVoiceAssistantProps {
  onTaskCreate: (item: ScheduleItem) => void;
  onClose: () => void;
}

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const isSpeechSupported = SpeechRecognition && window.speechSynthesis;

export const useVoiceAssistant = ({ onTaskCreate, onClose }: UseVoiceAssistantProps) => {
  const [assistantState, setAssistantState] = useState<AssistantState>('IDLE');
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [step, setStep] = useState<ConversationStep>('GREETING');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [lastErrorType, setLastErrorType] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const taskDetailsRef = useRef<Partial<ScheduleItem>>({});
  const suggestionsRef = useRef<TaskSuggestions | null>(null);
  const recognitionRef = useRef<any | null>(null);
  const errorRetryCount = useRef(0);

  // New robust speech synthesis queueing system
  const speechQueueRef = useRef<string[]>([]);
  const isSpeakingRef = useRef<boolean>(false);
  const onSpeechEndCallbackRef = useRef<(() => void) | null>(null);

  const addToConversation = useCallback((turn: ConversationTurn) => {
    setConversation(prev => [...prev, turn]);
  }, []);

  const processSpeechQueue = useCallback(() => {
    if (isSpeakingRef.current || !isSpeechSupported) {
      return;
    }

    if (speechQueueRef.current.length === 0) {
      if (onSpeechEndCallbackRef.current) {
        onSpeechEndCallbackRef.current();
        onSpeechEndCallbackRef.current = null;
      } else if (assistantState !== 'LISTENING') {
        setAssistantState('IDLE');
      }
      return;
    }

    isSpeakingRef.current = true;
    setAssistantState('SPEAKING');
    recognitionRef.current?.stop();

    const text = speechQueueRef.current.shift()!;
    const utterance = new SpeechSynthesisUtterance(text);
    let watchdog: number | null = null;

    const cleanupAndContinue = (eventOrError?: any) => {
      if (watchdog) clearTimeout(watchdog);
      if (!isSpeakingRef.current) return; // Avoid double execution

      isSpeakingRef.current = false;
      if (eventOrError) {
        // Filter out benign errors
        const errorType = eventOrError.error;
        if (errorType === 'canceled' || errorType === 'interrupted') {
          // These are expected, no need to log as error
        } else {
          logError('Speech synthesis utterance error', eventOrError);
        }
      }

      // Use a short timeout to allow the speech engine to reset before the next call
      setTimeout(processSpeechQueue, 100);
    };

    utterance.onend = () => cleanupAndContinue();
    utterance.onerror = (e) => cleanupAndContinue(e);

    watchdog = window.setTimeout(() => {
      logWarn("Speech synthesis watchdog triggered. Cancelling speech.");
      window.speechSynthesis.cancel(); // This should trigger onend or onerror
    }, 10000);

    try {
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      logError('window.speechSynthesis.speak() threw an error', e);
      cleanupAndContinue(e);
    }
  }, [assistantState]);

  const speak = useCallback((textOrTexts: string | string[], onEndCallback?: () => void) => {
    if (!isSpeechSupported) {
      if (onEndCallback) onEndCallback();
      return;
    }

    // Always cancel before queueing new speech. This helps clear a stuck state.
    window.speechSynthesis.cancel();
    isSpeakingRef.current = false; // Force reset our internal state too.

    const texts = Array.isArray(textOrTexts) ? textOrTexts : [textOrTexts];
    if (texts.length === 0) {
      if (onEndCallback) onEndCallback();
      return;
    }

    // Add all to conversation immediately for better UX
    texts.forEach(text => addToConversation({ speaker: 'assistant', text }));

    speechQueueRef.current = [...speechQueueRef.current, ...texts];
    onSpeechEndCallbackRef.current = onEndCallback || null;

    processSpeechQueue();
  }, [addToConversation, processSpeechQueue]);

  const listen = useCallback(() => {
    if (!isSpeechSupported || !recognitionRef.current) {
      return;
    }

    // Stop any currently speaking utterances and clear the queue before listening.
    window.speechSynthesis.cancel();
    speechQueueRef.current = [];
    isSpeakingRef.current = false;
    onSpeechEndCallbackRef.current = null;

    try {
      setAssistantState('LISTENING');
      recognitionRef.current.start();
    } catch (e) {
      // It might throw if it's already started, which is fine.
      if ((e as Error).name !== 'InvalidStateError') {
        logError("SpeechRecognition.start() failed.", e);
        setAssistantState('ERROR');
      }
    }
  }, []);

  const processSuggestions = useCallback(() => {
    const suggestions = suggestionsRef.current;
    if (!suggestions) {
      setStep('CONFIRMING_TASK');
      return;
    }
    const { classificationSuggestion, goalAnalysis, suggestedDuration } = suggestions;

    if (classificationSuggestion && classificationSuggestion.classification !== taskDetailsRef.current.type) {
      speak(`Based on your task, I think this might be better classified as ${classificationSuggestion.classification.replace('_', ' ')} because ${classificationSuggestion.rationale}. Would you like to switch?`, () => listen());
      return;
    }
    if (goalAnalysis && !goalAnalysis.isSMART && goalAnalysis.suggestion) {
      speak(`I have a suggestion to make your goal more specific: "${goalAnalysis.suggestion}". Would you like to use this goal instead?`, () => listen());
      return;
    }
    if (suggestedDuration && suggestedDuration !== taskDetailsRef.current.durationMinutes) {
      speak(`I recommend a duration of ${suggestedDuration} minutes for this task. Would you like to change it?`, () => listen());
      return;
    }

    setStep('CONFIRMING_TASK');
  }, [speak, listen]);

  // Main conversation flow logic
  useEffect(() => {
    if (transcript !== null) {
      const text = transcript.trim();
      setTranscript(null);

      if (!text) {
        speak("I'm sorry, I didn't catch that. Could you please repeat?", () => {
          const listeningSteps: ConversationStep[] = ['AWAITING_TASK', 'FILLING_DETAILS', 'PROCESSING_SUGGESTIONS', 'CONFIRMING_TASK', 'AWAITING_CORRECTION'];
          if (listeningSteps.includes(step)) {
            listen();
          }
        });
        return;
      }


      (async () => {
        setAssistantState('THINKING');
        recognitionRef.current?.stop();
        addToConversation({ speaker: 'user', text });

        const isAffirmative = text.toLowerCase().includes('yes') || text.toLowerCase().includes('yeah') || text.toLowerCase().includes('sure') || text.toLowerCase().includes('accept') || text.toLowerCase().includes('ok');

        try {
          switch (step) {
            case 'AWAITING_TASK': {
              const parsed = await parseNaturalLanguageTask(text, (status) => logInfo(status));
              taskDetailsRef.current = { ...taskDetailsRef.current, ...parsed };
              setStep('FILLING_DETAILS');
              break;
            }
            case 'FILLING_DETAILS': {
              const { type, startDate, taskName } = taskDetailsRef.current;
              if (!taskName) {
                taskDetailsRef.current.taskName = text;
              } else if (!type) {
                if (text.toLowerCase().includes('deep')) {
                  taskDetailsRef.current.type = ScheduleItemType.DEEP_WORK;
                  taskDetailsRef.current.durationMinutes = 90;
                } else if (text.toLowerCase().includes('shallow')) {
                  taskDetailsRef.current.type = ScheduleItemType.SHALLOW_WORK;
                  taskDetailsRef.current.durationMinutes = 30;
                } else {
                  speak("I didn't quite catch that. Is it a deep work or shallow work task?", () => listen());
                  return;
                }
              } else if (type === ScheduleItemType.DEEP_WORK && !(taskDetailsRef.current as Partial<DeepWorkSession>).goal) {
                (taskDetailsRef.current as Partial<DeepWorkSession>).goal = text;
              } else if (!startDate) {
                const parsedInfo = await parseNaturalLanguageTask(text, (status) => logInfo(status));
                if (parsedInfo?.startDate) {
                  taskDetailsRef.current.startDate = parsedInfo.startDate;
                } else {
                  speak("I had trouble understanding that date. Could you please say it again, for example 'tomorrow at 3pm'?", () => listen());
                  return;
                }
                if (parsedInfo?.durationMinutes) {
                  taskDetailsRef.current.durationMinutes = parsedInfo.durationMinutes;
                }
              }
              setStep('FILLING_DETAILS');
              break;
            }
            case 'PROCESSING_SUGGESTIONS': {
              const suggestions = suggestionsRef.current;
              if (!suggestions) {
                setStep('CONFIRMING_TASK');
                break;
              }
              const { classificationSuggestion, goalAnalysis, suggestedDuration } = suggestions;

              if (classificationSuggestion && classificationSuggestion.classification !== taskDetailsRef.current.type) {
                if (isAffirmative) taskDetailsRef.current.type = classificationSuggestion.classification;
                suggestionsRef.current!.classificationSuggestion = null;
              } else if (goalAnalysis && !goalAnalysis.isSMART && goalAnalysis.suggestion) {
                if (isAffirmative) (taskDetailsRef.current as Partial<DeepWorkSession>).goal = goalAnalysis.suggestion;
                suggestionsRef.current!.goalAnalysis = null;
              } else if (suggestedDuration && suggestedDuration !== taskDetailsRef.current.durationMinutes) {
                if (isAffirmative) taskDetailsRef.current.durationMinutes = suggestedDuration;
                suggestionsRef.current!.suggestedDuration = null;
              }
              setStep('PROCESSING_SUGGESTIONS');
              break;
            }
            case 'CONFIRMING_TASK': {
              if (isAffirmative) {
                setStep('FINALIZING');
              } else {
                setStep('AWAITING_CORRECTION');
              }
              break;
            }
            case 'AWAITING_CORRECTION': {
              const parsedChanges = await parseNaturalLanguageTask(text, (status) => logInfo(status));
              Object.keys(parsedChanges).forEach(key => {
                const parsedKey = key as keyof typeof parsedChanges;
                if (parsedChanges[parsedKey] !== null) {
                  (taskDetailsRef.current as any)[parsedKey] = parsedChanges[parsedKey];
                }
              });
              setStep('CONFIRMING_TASK');
              break;
            }
            default: break;
          }
        } catch (e) {
          logError('Voice assistant error', e);
          setAssistantState('ERROR');
          speak("I'm sorry, I ran into an issue. Let's try that again.", () => {
            setStep('AWAITING_TASK');
            listen();
          });
        }
      })();

      return;
    }

    if (assistantState !== 'IDLE' && assistantState !== 'THINKING') return;

    const runMainFlow = async () => {
      switch (step) {
        case 'GREETING':
          speak("How can I help you schedule your day?", () => listen());
          setStep('AWAITING_TASK');
          break;
        case 'FILLING_DETAILS': {
          const { taskName, type, startDate } = taskDetailsRef.current;
          if (!taskName) { speak("What would you like to call this task?", () => listen()); return; }
          if (!type) { speak("Is this a deep work or shallow work task?", () => listen()); return; }
          if (type === ScheduleItemType.DEEP_WORK && !(taskDetailsRef.current as Partial<DeepWorkSession>).goal) { speak("What's the primary goal for this session?", () => listen()); return; }
          if (!startDate) { speak("When should I schedule this for?", () => listen()); return; }

          setStep('GETTING_SUGGESTIONS');
          break;
        }
        case 'GETTING_SUGGESTIONS':
          const settings = getSettings();
          if (!settings.aiPreferences.enabled || !settings.aiPreferences.features.taskSuggestions) {
            speak("AI suggestions are currently disabled in settings. I'll skip that step.", () => {
              setStep('CONFIRMING_TASK');
            });
            break;
          }

          speak("Okay, I have the details. Let me check for suggestions.", () => {
            setAssistantState('THINKING');
            (async () => {
              try {
                const suggestions = await getTaskSuggestions(
                  taskDetailsRef.current.taskName!,
                  (taskDetailsRef.current as DeepWorkSession).goal || null,
                  taskDetailsRef.current.type!,
                  (status) => logInfo(status)
                );
                suggestionsRef.current = suggestions;
                (taskDetailsRef.current as DeepWorkSession).ritual = suggestions?.ritual || null;
                (taskDetailsRef.current as DeepWorkSession).wasCreatedWithAI = true;

                setStep('PROCESSING_SUGGESTIONS');
                setAssistantState('IDLE');
              } catch (e) {
                logError('Failed to get AI suggestions via voice', e);
                speak("I couldn't get AI suggestions, but I can still schedule the task.", () => {
                  setStep('CONFIRMING_TASK');
                  setAssistantState('IDLE');
                });
              }
            })();
          });
          break;
        case 'PROCESSING_SUGGESTIONS':
          processSuggestions();
          break;
        case 'CONFIRMING_TASK': {
          const { taskName, type, durationMinutes, startDate } = taskDetailsRef.current;
          const date = new Date(startDate!);
          const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const dateString = date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

          const confirmationMessages = [
            `Alright, I'm ready to schedule a ${type?.replace('_', ' ')} session.`,
            `You want to work on "${taskName}" for ${durationMinutes} minutes.`,
            `I have it scheduled for ${dateString} at ${timeString}.`,
            "Is that all correct?"
          ];
          speak(confirmationMessages, () => listen());
          break;
        }
        case 'AWAITING_CORRECTION': {
          speak("Okay, what would you like to change?", () => listen());
          break;
        }
        case 'FINALIZING': {
          const task = taskDetailsRef.current;
          const baseItemData = {
            id: new Date().toISOString() + Math.random(),
            taskName: task.taskName!,
            durationMinutes: task.durationMinutes!,
            startDate: task.startDate!,
            endDate: null,
            repeatFrequency: 'ONCE' as const,
            repeatOn: null,
            status: SessionStatus.PENDING,
            pauses: [],
            completions: [],
          };
          if (task.type === ScheduleItemType.DEEP_WORK) {
            const newSession: DeepWorkSession = {
              ...baseItemData,
              type: ScheduleItemType.DEEP_WORK,
              goal: (task as DeepWorkSession).goal!,
              ritual: (task as DeepWorkSession).ritual || null,
              ritualChecklist: (task as DeepWorkSession).ritual ? (task as DeepWorkSession).ritual!.map(text => ({ text, completed: false })) : null,
              workspaceImageUrl: null,
              wasCreatedWithAI: true,
            };
            onTaskCreate(newSession);
          } else {
            const newShallowTask: ShallowWorkTask = { ...baseItemData, type: ScheduleItemType.SHALLOW_WORK };
            onTaskCreate(newShallowTask);
          }
          speak("Great! I've added it to your schedule.", onClose);
          break;
        }
        default:
          break;
      }
    };
    runMainFlow();
  }, [step, assistantState, transcript, speak, listen, processSuggestions, onTaskCreate, onClose, addToConversation]);

  useEffect(() => {
    if (assistantState === 'ERROR') {
      if (errorRetryCount.current >= 2) {
        logError('Voice assistant failed to recover after multiple retries. Closing.');
        setErrorMessage("I'm having trouble and can't recover. Closing now.");
        const closeTimeout = setTimeout(onClose, 4000);
        return () => clearTimeout(closeTimeout);
      }

      errorRetryCount.current += 1;

      let spokenErrorMessage = "I'm sorry, I ran into a problem. Let me try that again.";
      let retryDelay = 1000;

      if (lastErrorType === 'network') {
        spokenErrorMessage = "It seems there's a network connection issue. I'll wait a moment and try again.";
        retryDelay = 3000;
      }

      const recoveryTimeout = setTimeout(() => {
        speak(spokenErrorMessage, () => setAssistantState('IDLE'));
      }, retryDelay);
      return () => clearTimeout(recoveryTimeout);
    } else {
      // Reset on non-error state
      if (errorRetryCount.current > 0) {
        errorRetryCount.current = 0;
      }
      if (lastErrorType !== null) {
        setLastErrorType(null);
      }
      if (errorMessage !== null) {
        setErrorMessage(null);
      }
    }
  }, [assistantState, lastErrorType, speak, onClose, errorMessage]);

  const startAssistant = useCallback(() => {
    const settings = getSettings();
    if (!settings.aiPreferences.enabled) {
      speak("The AI assistant is currently disabled in settings.", onClose);
      return;
    }

    if (!isSpeechSupported) {
      speak("Sorry, your browser doesn't support the voice features.", onClose);
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcriptText = event.results[event.results.length - 1][0].transcript;
        setTranscript(transcriptText);
      };

      recognition.onstart = () => {
        if (assistantState !== 'SPEAKING') setAssistantState('LISTENING');
      };

      recognition.onend = () => {
        if (assistantState === 'LISTENING') setAssistantState('IDLE');
      };

      recognition.onerror = (event: any) => {
        logError('Speech recognition error', { error: event.error });
        if (event.error === 'no-speech') {
          setTranscript(''); // Trigger "didn't catch that" flow
          return;
        }
        if (event.error !== 'aborted') {
          setLastErrorType(event.error);
          setAssistantState('ERROR');
        }
      };

      recognitionRef.current = recognition;
    }

    setStep('GREETING');
  }, [speak, onClose, assistantState]);

  const stopAssistant = useCallback(() => {
    if (!isSpeechSupported) return;
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    window.speechSynthesis.cancel();
    speechQueueRef.current = [];
    isSpeakingRef.current = false;
    onSpeechEndCallbackRef.current = null;
    setAssistantState('IDLE');
  }, []);

  return { assistantState, conversation, errorMessage, startAssistant, stopAssistant };
};
