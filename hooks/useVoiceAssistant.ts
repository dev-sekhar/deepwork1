import { useState, useRef, useEffect, useCallback } from 'react';
import { ScheduleItem, ScheduleItemType, SessionStatus, DeepWorkSession, ShallowWorkTask } from '../types';
import { parseNaturalLanguageTask, getTaskSuggestions, AIServiceError, TaskSuggestions, processConversationTurn, ConversationContext, ConversationResponse } from '../services/aiService';
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

  // Log state changes using useEffect
  useEffect(() => {
    logInfo(`[VoiceAssistant] State: ${assistantState}`, { step, errorRetryCount: errorRetryCount.current, lastErrorType });
  }, [assistantState, step, lastErrorType]);

  // Log step changes using useEffect
  useEffect(() => {
    logInfo(`[VoiceAssistant] Step: ${step}`, { assistantState, errorRetryCount: errorRetryCount.current });
  }, [step, assistantState]);

  const taskDetailsRef = useRef<Partial<ScheduleItem>>({});
  const suggestionsRef = useRef<TaskSuggestions | null>(null);
  const recognitionRef = useRef<any | null>(null);
  const recognitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionResultReceivedRef = useRef(false);
  const errorRetryCount = useRef(0);
  const listenRetryCount = useRef(0); // Track listen() retry attempts

  // New robust speech synthesis queueing system
  const speechQueueRef = useRef<string[]>([]);
  const isSpeakingRef = useRef<boolean>(false);
  const onSpeechEndCallbackRef = useRef<(() => void) | null>(null);

  const addToConversation = useCallback((turn: ConversationTurn) => {
    setConversation(prev => [...prev, turn]);
  }, []);

  const processSpeechQueue = useCallback(() => {
    logInfo('[VoiceAssistant] processSpeechQueue called', {
      isSpeaking: isSpeakingRef.current,
      isSpeechSupported,
      queueLength: speechQueueRef.current.length,
      currentState: assistantState
    });

    if (isSpeakingRef.current || !isSpeechSupported) {
      logWarn('[VoiceAssistant] processSpeechQueue skipped', {
        reason: isSpeakingRef.current ? 'already speaking' : 'speech not supported'
      });
      return;
    }

    if (speechQueueRef.current.length === 0) {
      logInfo('[VoiceAssistant] Speech queue empty', { hasCallback: !!onSpeechEndCallbackRef.current });
      if (onSpeechEndCallbackRef.current) {
        onSpeechEndCallbackRef.current();
        onSpeechEndCallbackRef.current = null;
      } else {
        // Only set to IDLE if we're not actively listening
        setAssistantState(prev => {
          if (prev !== 'LISTENING') {
            logInfo('[VoiceAssistant] Setting state to IDLE (queue empty)');
            return 'IDLE';
          }
          return prev;
        });
      }
      return;
    }

    isSpeakingRef.current = true;
    logInfo('[VoiceAssistant] Starting speech synthesis', {
      text: speechQueueRef.current[0]?.substring(0, 50) + '...',
      queueLength: speechQueueRef.current.length
    });
    setAssistantState('SPEAKING');
    recognitionRef.current?.stop();

    const text = speechQueueRef.current.shift()!;
    const utterance = new SpeechSynthesisUtterance(text);
    let watchdog: number | null = null;

    const cleanupAndContinue = (eventOrError?: any) => {
      if (watchdog) clearTimeout(watchdog);
      if (!isSpeakingRef.current) {
        logWarn('[VoiceAssistant] cleanupAndContinue called but not speaking (double execution?)');
        return; // Avoid double execution
      }

      isSpeakingRef.current = false;
      if (eventOrError) {
        // Filter out benign errors
        const errorType = eventOrError.error;
        if (errorType === 'canceled' || errorType === 'interrupted') {
          logInfo('[VoiceAssistant] Speech canceled/interrupted (expected)', { errorType });
        } else {
          logError('[VoiceAssistant] Speech synthesis utterance error', { errorType, event: eventOrError });
        }
      } else {
        logInfo('[VoiceAssistant] Speech utterance completed successfully');
      }

      // Use a short timeout to allow the speech engine to reset before the next call
      logInfo('[VoiceAssistant] Scheduling next speech queue processing', { remainingInQueue: speechQueueRef.current.length });
      setTimeout(processSpeechQueue, 100);
    };

    utterance.onend = () => cleanupAndContinue();
    utterance.onerror = (e: any) => {
      const errorType = e?.error;
      // Don't treat canceled/interrupted as errors, but log other errors
      if (errorType && errorType !== 'canceled' && errorType !== 'interrupted') {
        logError('Speech synthesis utterance error', e);
        // Mark as speech error for recovery handling
        if (errorType === 'not-allowed' || errorType === 'synthesis-failed') {
          setLastErrorType('synthesis-failed');
        }
      }
      cleanupAndContinue(e);
    };

    // Dynamic timeout based on text length (approx 100ms per char + 2s buffer)
    const timeoutDuration = Math.max(5000, text.length * 100 + 2000);
    watchdog = window.setTimeout(() => {
      logWarn('[VoiceAssistant] Speech synthesis watchdog triggered. Cancelling speech.', { textLength: text.length, timeoutDuration });
      window.speechSynthesis.cancel(); // This should trigger onend or onerror

      // Force cleanup if speech is stuck
      if (isSpeakingRef.current) {
        isSpeakingRef.current = false;
        speechQueueRef.current = [];
        setAssistantState(prev => prev === 'SPEAKING' ? 'IDLE' : prev);
      }
    }, timeoutDuration);

    try {
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      logError('window.speechSynthesis.speak() threw an error', e);
      setLastErrorType('synthesis-failed');
      cleanupAndContinue(e);
    }
  }, []);

  const speak = useCallback((textOrTexts: string | string[], onEndCallback?: () => void) => {
    const settings = getSettings();
    const texts = Array.isArray(textOrTexts) ? textOrTexts : [textOrTexts];
    logInfo('[VoiceAssistant] speak() called', {
      textCount: texts.length,
      firstText: texts[0]?.substring(0, 50),
      isSpeechSupported,
      aiEnabled: settings.aiPreferences.enabled,
      voiceOutputEnabled: settings.aiPreferences.features.voiceOutput,
      hasCallback: !!onEndCallback
    });

    if (!isSpeechSupported || !settings.aiPreferences.enabled || !settings.aiPreferences.features.voiceOutput) {
      logInfo('[VoiceAssistant] Voice output disabled, adding to conversation only', {
        reason: !isSpeechSupported ? 'not supported' : !settings.aiPreferences.enabled ? 'AI disabled' : 'voice output disabled'
      });
      // If voice output is disabled, still add to conversation for display but don't speak
      texts.forEach(text => addToConversation({ speaker: 'assistant', text }));
      if (onEndCallback) onEndCallback();
      return;
    }

    // Always cancel before queueing new speech. This helps clear a stuck state.
    window.speechSynthesis.cancel();
    isSpeakingRef.current = false; // Force reset our internal state too.

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
    logInfo('[VoiceAssistant] listen() called', {
      isSpeechSupported,
      hasRecognition: !!recognitionRef.current,
      currentState: assistantState,
      currentStep: step
    });

    if (!isSpeechSupported) {
      logWarn('[VoiceAssistant] listen() skipped', { reason: 'speech not supported' });
      return;
    }

    // If recognition instance isn't ready yet, wait a bit and try again
    if (!recognitionRef.current) {
      logWarn('[VoiceAssistant] Recognition instance not ready, will retry in 100ms');
      setTimeout(() => listen(), 100);
      return;
    }

    // If speech is currently in progress, wait for it to finish (with max retry limit)
    if (isSpeakingRef.current) {
      if (listenRetryCount.current < 10) {
        listenRetryCount.current++;
        logWarn('[VoiceAssistant] Speech in progress, will retry listen() after 200ms', { retryCount: listenRetryCount.current });
        setTimeout(() => listen(), 200);
        return;
      } else {
        logWarn('[VoiceAssistant] Max listen retries reached, forcing listen to start');
        listenRetryCount.current = 0;
        // Force cancel speech and proceed
        window.speechSynthesis.cancel();
        speechQueueRef.current = [];
        isSpeakingRef.current = false;
        onSpeechEndCallbackRef.current = null;
      }
    } else {
      // Reset retry count when not speaking
      listenRetryCount.current = 0;
    }

    // Stop any currently speaking utterances and clear the queue before listening.
    logInfo('[VoiceAssistant] Clearing speech queue and canceling synthesis before listening');
    window.speechSynthesis.cancel();
    speechQueueRef.current = [];
    isSpeakingRef.current = false;
    onSpeechEndCallbackRef.current = null;

    try {
      logInfo('[VoiceAssistant] Starting speech recognition');
      recognitionResultReceivedRef.current = false; // Reset before starting

      // Clear any existing timeout
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
        recognitionTimeoutRef.current = null;
      }

      recognitionRef.current.start();
      setAssistantState('LISTENING');

      // Add timeout to prevent getting stuck in LISTENING state (10 seconds)
      recognitionTimeoutRef.current = window.setTimeout(() => {
        logWarn('[VoiceAssistant] Recognition timeout - no result received, ending recognition');
        if (recognitionRef.current && assistantState === 'LISTENING') {
          try {
            recognitionRef.current.stop();
          } catch (e) {
            logWarn('[VoiceAssistant] Error stopping recognition on timeout', { error: e });
          }
        }
        // Don't set transcript here - let onend handle the "no result" flow to avoid double-trigger
      }, 10000) as unknown as number;
    } catch (e) {
      // It might throw if it's already started, which is fine.
      if ((e as Error).name !== 'InvalidStateError') {
        logError('[VoiceAssistant] SpeechRecognition.start() failed', { error: e, errorName: (e as Error).name });
        setAssistantState('ERROR');
      } else {
        logInfo('[VoiceAssistant] SpeechRecognition already started (expected)');
      }
    }
  }, [assistantState, step]);

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
    logInfo('[VoiceAssistant] Main flow effect triggered', {
      transcript: transcript !== null ? 'has transcript' : 'no transcript',
      assistantState,
      step,
      errorRetryCount: errorRetryCount.current
    });

    if (transcript !== null) {
      const text = transcript.trim();
      logInfo('[VoiceAssistant] Processing transcript', { text, step, assistantState });
      setTranscript(null);

      // Skip empty transcripts silently - they're often caused by state transitions
      if (!text || text.trim() === '') {
        logWarn('[VoiceAssistant] Empty transcript received, skipping processing');
        return;
      }


      (async () => {
        logInfo('[VoiceAssistant] Starting async transcript processing', { text, step });
        setAssistantState('THINKING');
        recognitionRef.current?.stop();
        addToConversation({ speaker: 'user', text });

        const isAffirmative = text.toLowerCase().includes('yes') || text.toLowerCase().includes('yeah') || text.toLowerCase().includes('sure') || text.toLowerCase().includes('accept') || text.toLowerCase().includes('ok');
        logInfo('[VoiceAssistant] Transcript analysis', { isAffirmative, step });

        try {
          switch (step) {
            case 'AWAITING_TASK':
            case 'FILLING_DETAILS': {
              logInfo('[VoiceAssistant] Processing conversation turn with AI', { step, text });

              // Build conversation context
              const context: ConversationContext = {
                ...taskDetailsRef.current,
                conversationHistory: conversation
              };

              // Use AI to process the conversation turn
              const aiResponse: ConversationResponse = await processConversationTurn(
                text,
                context,
                (status) => logInfo(`[VoiceAssistant] ${status}`)
              );

              logInfo('[VoiceAssistant] AI conversation response', {
                isComplete: aiResponse.isComplete,
                missingFields: aiResponse.missingFields,
                hasResponse: !!aiResponse.response
              });

              // Update task details with AI-extracted information
              taskDetailsRef.current = {
                ...taskDetailsRef.current,
                ...aiResponse.updatedContext
              };

              // Update conversation history
              if (aiResponse.response) {
                addToConversation({ speaker: 'assistant', text: aiResponse.response });
              }

              // If task is complete, move to suggestions
              if (aiResponse.isComplete) {
                logInfo('[VoiceAssistant] Task details complete, moving to suggestions');
                setStep('GETTING_SUGGESTIONS');
              } else {
                // Continue conversation - AI will have provided a question in response
                if (aiResponse.response) {
                  speak(aiResponse.response, () => {
                    if (aiResponse.missingFields.length > 0) {
                      listen();
                    }
                  });
                } else {
                  // No response from AI, but still missing fields - ask generically
                  speak("I need a bit more information to schedule this. Could you tell me more?", () => listen());
                }
              }
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
          logError('[VoiceAssistant] Error in transcript processing', {
            error: e,
            errorMessage: e instanceof Error ? e.message : String(e),
            isAIServiceError: e instanceof AIServiceError,
            step,
            assistantState
          });
          // Check if it's an AIServiceError (network/API issue)
          if (e instanceof AIServiceError) {
            setLastErrorType('network');
            logInfo('[VoiceAssistant] Marked error as network type');
          }
          setAssistantState('ERROR');
          // Don't call speak here - let the error recovery handler manage it
          // This prevents potential loops if speak() itself is failing
        }
      })();

      return;
    }

    logInfo('[VoiceAssistant] Checking if should run main flow', {
      assistantState,
      step,
      condition: assistantState === 'IDLE' || assistantState === 'THINKING'
    });

    if (assistantState !== 'IDLE' && assistantState !== 'THINKING') {
      logInfo('[VoiceAssistant] Skipping main flow - state not IDLE or THINKING');
      return;
    }

    const runMainFlow = async () => {
      logInfo('[VoiceAssistant] Running main flow', { step, assistantState });
      switch (step) {
        case 'GREETING':
          logInfo('[VoiceAssistant] GREETING step - speaking greeting');
          speak("How can I help you schedule your day?", () => listen());
          setStep('AWAITING_TASK');
          break;
        case 'FILLING_DETAILS': {
          const { taskName, type, startDate } = taskDetailsRef.current;
          logInfo('[VoiceAssistant] FILLING_DETAILS step - checking what to ask', {
            hasTaskName: !!taskName,
            hasType: !!type,
            hasStartDate: !!startDate,
            isDeepWork: type === ScheduleItemType.DEEP_WORK,
            hasGoal: !!(taskDetailsRef.current as Partial<DeepWorkSession>).goal
          });

          if (!taskName) {
            logInfo('[VoiceAssistant] Asking for task name');
            speak("What would you like to call this task?", () => listen());
            return;
          }
          if (!type) {
            logInfo('[VoiceAssistant] Asking for task type');
            speak("Is this a deep work or shallow work task?", () => listen());
            return;
          }
          if (type === ScheduleItemType.DEEP_WORK && !(taskDetailsRef.current as Partial<DeepWorkSession>).goal) {
            logInfo('[VoiceAssistant] Asking for goal');
            speak("What's the primary goal for this session?", () => listen());
            return;
          }
          if (!startDate) {
            logInfo('[VoiceAssistant] Asking for start date');
            speak("When should I schedule this for?", () => listen());
            return;
          }
          // Check if we need to ask about recurring frequency
          if (!taskDetailsRef.current.repeatFrequency) {
            logInfo('[VoiceAssistant] Asking about recurring frequency');
            speak("Should this be a one-time task, or would you like it to repeat daily, weekly, or monthly?", () => listen());
            return;
          }
          // If weekly, check if we need to ask about days
          if (taskDetailsRef.current.repeatFrequency === 'WEEKLY' && (!taskDetailsRef.current.repeatOn || taskDetailsRef.current.repeatOn.length === 0)) {
            logInfo('[VoiceAssistant] Asking about weekly days');
            speak("Which days of the week? For example, say Monday and Wednesday, or weekdays, or weekends.", () => listen());
            return;
          }

          logInfo('[VoiceAssistant] All details filled, moving to GETTING_SUGGESTIONS');
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
            repeatFrequency: (task.repeatFrequency || 'ONCE') as 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY',
            repeatOn: task.repeatOn || null,
            status: SessionStatus.PENDING,
            pauses: [],
            completions: [],
          };
          logInfo('[VoiceAssistant] Creating task', {
            repeatFrequency: baseItemData.repeatFrequency,
            repeatOn: baseItemData.repeatOn
          });
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
    logInfo('[VoiceAssistant] Error recovery effect triggered', {
      assistantState,
      lastErrorType,
      errorRetryCount: errorRetryCount.current,
      step
    });

    if (assistantState === 'ERROR') {
      logWarn('[VoiceAssistant] ERROR state detected, starting recovery', {
        errorRetryCount: errorRetryCount.current,
        lastErrorType,
        step
      });

      if (errorRetryCount.current >= 2) {
        logError('[VoiceAssistant] Max retries reached, closing assistant', {
          errorRetryCount: errorRetryCount.current,
          lastErrorType,
          step
        });
        setErrorMessage("I'm having trouble and can't recover. Closing now.");
        const closeTimeout = setTimeout(onClose, 4000);
        return () => clearTimeout(closeTimeout);
      }

      errorRetryCount.current += 1;
      logInfo('[VoiceAssistant] Incrementing retry count', { newCount: errorRetryCount.current });

      // Check if the error is related to speech synthesis - if so, don't try to speak
      const settings = getSettings();
      const canSpeak = isSpeechSupported && settings.aiPreferences.enabled && settings.aiPreferences.features.voiceOutput;
      const isSpeechError = lastErrorType === 'synthesis-failed' || lastErrorType === 'synthesis-not-allowed';

      logInfo('[VoiceAssistant] Error recovery analysis', {
        canSpeak,
        isSpeechError,
        lastErrorType,
        aiEnabled: settings.aiPreferences.enabled,
        voiceOutputEnabled: settings.aiPreferences.features.voiceOutput
      });

      if (lastErrorType === 'not-allowed' || lastErrorType === 'service-not-allowed') {
        logWarn('[VoiceAssistant] Permission denied or service not allowed. Stopping assistant.');
        const permissionMsg = "I don't have permission to use the microphone. Please check your browser settings.";
        addToConversation({ speaker: 'assistant', text: permissionMsg });
        setErrorMessage("Microphone access blocked. Please check browser settings.");

        // If we can speak, say it, but DO NOT close automatically so user sees the UI help
        if (canSpeak) {
          speak(permissionMsg);
        }
        return;
      }

      let spokenErrorMessage = "I'm sorry, I ran into a problem. Let me try that again.";
      let retryDelay = 2000; // Increased delay to give system time to recover

      if (lastErrorType === 'network') {
        spokenErrorMessage = "It seems there's a network connection issue. I'll wait a moment and try again.";
        retryDelay = 3000;
        logInfo('[VoiceAssistant] Network error detected, using longer delay');
      } else if (isSpeechError) {
        // For speech errors, just add to conversation without speaking
        spokenErrorMessage = "I'm having trouble with voice output. Let's continue with text.";
        retryDelay = 1000;
        logInfo('[VoiceAssistant] Speech error detected, will use text only');
      }

      logInfo('[VoiceAssistant] Scheduling error recovery', { retryDelay, willSpeak: canSpeak && !isSpeechError });

      const recoveryTimeout = setTimeout(() => {
        logInfo('[VoiceAssistant] Executing error recovery', { canSpeak, isSpeechError, step });
        // If we can't speak or it's a speech error, just add to conversation and continue
        if (!canSpeak || isSpeechError) {
          logInfo('[VoiceAssistant] Adding error message to conversation (text only)');
          addToConversation({ speaker: 'assistant', text: spokenErrorMessage });
          // Reset recognition if it exists
          if (recognitionRef.current) {
            try {
              recognitionRef.current.stop();
              logInfo('[VoiceAssistant] Stopped recognition after error');
            } catch (e) {
              logWarn('[VoiceAssistant] Error stopping recognition', { error: e });
            }
          }
          setAssistantState('IDLE');
          // Try to continue the conversation flow
          if (step === 'AWAITING_TASK' || step === 'FILLING_DETAILS' || step === 'CONFIRMING_TASK' || step === 'AWAITING_CORRECTION') {
            logInfo('[VoiceAssistant] Scheduling listen() after error recovery', { step });
            setTimeout(() => listen(), 500);
          } else {
            logInfo('[VoiceAssistant] Not scheduling listen() - step not in listening steps', { step });
          }
        } else {
          logInfo('[VoiceAssistant] Speaking error message');
          speak(spokenErrorMessage, () => {
            logInfo('[VoiceAssistant] Error recovery speech completed');
            setAssistantState('IDLE');
            // Try to continue the conversation flow
            if (step === 'AWAITING_TASK' || step === 'FILLING_DETAILS' || step === 'CONFIRMING_TASK' || step === 'AWAITING_CORRECTION') {
              logInfo('[VoiceAssistant] Scheduling listen() after error recovery speech', { step });
              setTimeout(() => listen(), 500);
            } else {
              logInfo('[VoiceAssistant] Not scheduling listen() - step not in listening steps', { step });
            }
          });
        }
      }, retryDelay);
      return () => clearTimeout(recoveryTimeout);
    } else {
      // Reset on non-error state
      if (errorRetryCount.current > 0 && assistantState === 'IDLE') {
        logInfo('[VoiceAssistant] Resetting error retry count (recovered)', { previousCount: errorRetryCount.current });
        errorRetryCount.current = 0;
      }
      if (lastErrorType !== null && assistantState !== 'ERROR') {
        logInfo('[VoiceAssistant] Clearing last error type', { previousError: lastErrorType });
        setLastErrorType(null);
      }
      if (errorMessage !== null && assistantState !== 'ERROR') {
        logInfo('[VoiceAssistant] Clearing error message', { previousMessage: errorMessage });
        setErrorMessage(null);
      }
    }
  }, [assistantState, lastErrorType, speak, onClose, errorMessage, addToConversation, listen, step]);


  const startAssistant = useCallback(() => {
    logInfo('[VoiceAssistant] startAssistant() called');
    const settings = getSettings();
    logInfo('[VoiceAssistant] Settings check', {
      aiEnabled: settings.aiPreferences.enabled,
      voiceInputEnabled: settings.aiPreferences.features.voiceInput,
      voiceOutputEnabled: settings.aiPreferences.features.voiceOutput,
      isSpeechSupported,
      isSecureContext: window.isSecureContext,
      location: window.location.href
    });

    if (!settings.aiPreferences.enabled) {
      logWarn('[VoiceAssistant] AI disabled in settings');
      speak("The AI assistant is currently disabled in settings.", onClose);
      return;
    }

    if (!settings.aiPreferences.features.voiceInput) {
      logWarn('[VoiceAssistant] Voice input disabled in settings');
      speak("Voice input is currently disabled. Please enable it in AI Features settings.", onClose);
      return;
    }

    if (!isSpeechSupported) {
      logError('[VoiceAssistant] Speech not supported');
      speak("Sorry, your browser doesn't support the voice features.", onClose);
      return;
    }

    const initializeRecognition = () => {
      if (!recognitionRef.current) {
        logInfo('[VoiceAssistant] Creating new SpeechRecognition instance');
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        logInfo('[VoiceAssistant] SpeechRecognition configured', { lang: recognition.lang, continuous: recognition.continuous });

        recognition.onresult = (event: any) => {
          const transcriptText = event.results[event.results.length - 1][0].transcript;
          logInfo('[VoiceAssistant] Speech recognition result received', { transcript: transcriptText, resultCount: event.results.length });
          recognitionResultReceivedRef.current = true;
          // Clear timeout since we got a result
          if (recognitionTimeoutRef.current) {
            clearTimeout(recognitionTimeoutRef.current);
            recognitionTimeoutRef.current = null;
          }
          setTranscript(transcriptText);
        };

        recognition.onstart = () => {
          logInfo('[VoiceAssistant] Speech recognition started');
          if (assistantState !== 'SPEAKING') setAssistantState('LISTENING');
        };

        recognition.onend = () => {
          logInfo('[VoiceAssistant] Speech recognition ended', {
            resultReceived: recognitionResultReceivedRef.current
          });
          setAssistantState(prevState => {
            if (prevState === 'LISTENING') {
              logInfo('[VoiceAssistant] Recognition ended while listening, setting state to IDLE');
              // If recognition ended without a result, trigger "didn't catch that" flow
              if (!recognitionResultReceivedRef.current) {
                logInfo('[VoiceAssistant] No result received, triggering no-speech flow');
                // Use setTimeout to ensure state update happens first
                setTimeout(() => {
                  setTranscript(''); // Empty string triggers "didn't catch that" flow
                }, 50);
              }
              recognitionResultReceivedRef.current = false; // Reset for next time
              return 'IDLE';
            }
            return prevState;
          });
        };

        recognition.onerror = (event: any) => {
          const errorType = event.error;
          logError('Speech recognition error', { error: errorType });

          // Handle different error types appropriately
          if (errorType === 'no-speech') {
            // Don't trigger flow here, let onend handle it to avoid double-trigger
            logInfo('[VoiceAssistant] no-speech error received, waiting for onend');
            return;
          }

          // These are non-critical errors that shouldn't trigger full error recovery
          if (errorType === 'audio-capture' || errorType === 'not-allowed') {
            logWarn('Speech recognition permission or audio issue', { error: errorType });
            setLastErrorType(errorType);
            setAssistantState('ERROR');
            return;
          }

          // Only set error state for unexpected errors
          if (errorType !== 'aborted' && errorType !== 'network') {
            // For most errors, try to recover gracefully
            if (errorRetryCount.current < 1) {
              setLastErrorType(errorType);
              setAssistantState('ERROR');
            } else {
              // If we've already retried, just reset and continue
              logWarn('Speech recognition error after retry, continuing without voice', { error: errorType });
              setAssistantState('IDLE');
              setTranscript(''); // Clear transcript to avoid processing
            }
          }
        };

        recognitionRef.current = recognition;
        logInfo('[VoiceAssistant] SpeechRecognition instance stored');
      } else {
        logInfo('[VoiceAssistant] Using existing SpeechRecognition instance');
      }

      logInfo('[VoiceAssistant] Setting step to GREETING');
      setStep('GREETING');
    };

    // Explicitly request microphone permission to force the prompt if supported
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          logInfo('[VoiceAssistant] Microphone permission granted');
          // Stop the tracks immediately, we just needed the permission
          stream.getTracks().forEach(track => track.stop());

          // Proceed with initialization
          initializeRecognition();
        })
        .catch(err => {
          logWarn('[VoiceAssistant] Microphone permission denied or error', { error: err });
          const permissionMsg = "I don't have permission to use the microphone. Please check your browser settings.";
          addToConversation({ speaker: 'assistant', text: permissionMsg });

          if (window.speechSynthesis) {
            speak(permissionMsg, onClose);
          } else {
            setTimeout(onClose, 4000);
          }
        });
    } else {
      logWarn('[VoiceAssistant] navigator.mediaDevices not supported, skipping explicit permission check');
      initializeRecognition();
    }
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
