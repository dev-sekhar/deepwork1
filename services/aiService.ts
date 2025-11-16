import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { GoalAnalysisResult, AnalyticsQuery, ChatMessage, ScheduleItemType, Feedback } from "../types";
import { getSettings } from "./settingsService";
import { logInfo, logWarn, logError } from "./logService";

// --- CUSTOM ERRORS ---
export class AIServiceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AIServiceError';
    }
}

export interface TaskSuggestions {
  ritual: string[] | null;
  goalAnalysis: GoalAnalysisResult | null;
  suggestedDuration: number | null;
  classificationSuggestion: { classification: ScheduleItemType; rationale: string } | null;
}


// --- PROVIDER CONFIGURATION ---
const GEMINI_MODELS_TO_TRY = ['gemini-2.5-flash', 'gemini-flash-latest'];

// --- GEMINI HELPER ---
async function generateContentWithGemini(
    baseParams: { contents: any; config?: any; },
    onModelSwitch?: (modelName: string) => void
): Promise<GenerateContentResponse> {
    if (!process.env.API_KEY) {
        logError("Gemini API key not found in environment.");
        throw new AIServiceError("Gemini API key not found.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let lastError: any = null;

    for (const [index, model] of GEMINI_MODELS_TO_TRY.entries()) {
        try {
            logInfo(`Attempting AI call with model: ${model}`, { prompt: baseParams.contents });
            if (index > 0 && onModelSwitch) {
                onModelSwitch(model);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            const response = await ai.models.generateContent({ model, ...baseParams });
            logInfo(`AI call successful with model: ${model}`);
            return response;
        } catch (error) {
            lastError = error;
            logWarn(`Model ${model} failed.`, { error });
            console.warn(`Model ${model} failed with error:`, error);
        }
    }
    
    logError("All Gemini models failed.", { lastError });
    throw new AIServiceError(`All Gemini models failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

// --- EXPORTED API FUNCTIONS ---

export async function parseNaturalLanguageTask(
    userInput: string,
    onStatusUpdate: (status: string) => void
): Promise<Partial<TaskSuggestions & { taskName: string, goal: string | null, itemType: ScheduleItemType, durationMinutes: number, startDate: string }>> {

    const prompt = `
        You are a task scheduler assistant. Parse the user's request: "${userInput}".
        Extract the following details into a JSON object: "taskName", "itemType" ('DEEP_WORK' or 'SHALLOW_WORK'), 
        "durationMinutes", "goal", and "startDate" (as an ISO 8601 string).

        Guidelines:
        - If a detail is not mentioned, set its value to null.
        - The current date is ${new Date().toISOString()}.
        - **IMPORTANT TIME PARSING RULES:**
          - **Prioritize explicit times.** If the user says "at 4 PM", the time is 16:00. If they say "at 10 AM", the time is 10:00. Do not interpret these as relative durations (e.g., "in 4 hours"). An explicit time always takes precedence.
          - Use the current date to resolve relative dates like 'tomorrow' or 'next Tuesday'.
          - For relative times like 'in 3 hours', calculate from the current date.
        - If the task sounds like it requires deep focus (e.g., 'write', 'study', 'code', 'research', 'plan'), default itemType to 'DEEP_WORK'. Otherwise, default to 'SHALLOW_WORK'.
        - If no duration is specified, default to 90 for DEEP_WORK and 30 for SHALLOW_WORK.
        - The user's preferred working hours are 9am to 5pm. If a time is ambiguous (e.g., "in the afternoon"), pick a reasonable time like 2 PM. If the user gives an explicit time, you must respect it, even if it's outside these working hours.
    `;
    const schema = {
        type: Type.OBJECT,
        properties: {
            taskName: { type: Type.STRING, nullable: true },
            itemType: { type: Type.STRING, enum: [ScheduleItemType.DEEP_WORK, ScheduleItemType.SHALLOW_WORK], nullable: true },
            durationMinutes: { type: Type.NUMBER, nullable: true },
            goal: { type: Type.STRING, nullable: true },
            startDate: { type: Type.STRING, nullable: true }
        }
    };
    try {
        logInfo('Parsing natural language task.', { userInput });
        onStatusUpdate("Understanding your request...");
        const response = await generateContentWithGemini({
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: schema },
        }, (modelName) => onStatusUpdate(`Using fallback model (${modelName})...`));
        onStatusUpdate("Request understood.");
        return JSON.parse(response.text.trim());
    } catch (error: any) {
        logError('Failed to parse natural language task.', { error });
        onStatusUpdate("AI service failed.");
        throw new AIServiceError(`Failed to parse task: ${error.message}`);
    }
}


export async function getTaskSuggestions(
  taskName: string, 
  goal: string | null, 
  itemType: ScheduleItemType, 
  onStatusUpdate: (status: string) => void
): Promise<TaskSuggestions | null> {
    const { aiPersonalization } = getSettings();

    const deepWorkPrompt = `
      "classificationSuggestion": { "classification": "DEEP_WORK" | "SHALLOW_WORK", "rationale": "A concise, one-sentence rationale for your classification choice." },
      "ritual": ["A 3-step, short, actionable pre-session ritual to help the user focus."],
      "goalAnalysis": { "isSMART": boolean, "feedback": "Concise feedback on the goal's SMART criteria.", "suggestion": "An optional improved goal if necessary." },
      "suggestedDuration": number (Suggest 60, 90, or 120 minutes)
    `;
    const shallowWorkPrompt = `
      "classificationSuggestion": { "classification": "DEEP_WORK" | "SHALLOW_WORK", "rationale": "A concise, one-sentence rationale for your classification choice." }
    `;

    const prompt = `
      You are an AI assistant for a productivity app based on the Deep Work methodology.
      Analyze the user's task and provide a JSON object with suggestions for scheduling.

      Task Details:
      - Task: "${taskName}"
      - User's intended classification: ${itemType}
      ${goal ? `- Goal: "${goal}"` : ''}
      - User personalization: ${aiPersonalization}

      Provide a JSON response with the following structure. ONLY provide the JSON object, without any markdown formatting.

      If the user's intended classification is 'DEEP_WORK', use this structure:
      {
        ${deepWorkPrompt}
      }

      If the user's intended classification is 'SHALLOW_WORK', use this structure:
      {
        ${shallowWorkPrompt}
      }
    `;

    const deepWorkSchema = {
        type: Type.OBJECT,
        properties: {
            classificationSuggestion: { type: Type.OBJECT, properties: { classification: { type: Type.STRING }, rationale: { type: Type.STRING } } },
            ritual: { type: Type.ARRAY, items: { type: Type.STRING } },
            goalAnalysis: { type: Type.OBJECT, properties: { isSMART: { type: Type.BOOLEAN }, feedback: { type: Type.STRING }, suggestion: { type: Type.STRING } } },
            suggestedDuration: { type: Type.NUMBER }
        }
    };
    const shallowWorkSchema = {
        type: Type.OBJECT,
        properties: {
            classificationSuggestion: { type: Type.OBJECT, properties: { classification: { type: Type.STRING }, rationale: { type: Type.STRING } } }
        }
    };
    
    const schema = itemType === ScheduleItemType.DEEP_WORK ? deepWorkSchema : shallowWorkSchema;

    try {
        logInfo('Fetching all task suggestions.', { taskName, goal, itemType });
        onStatusUpdate("Querying Gemini for suggestions...");
        const response = await generateContentWithGemini({
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: schema },
        }, (modelName) => onStatusUpdate(`Switching to Gemini fallback model (${modelName})...`));
        onStatusUpdate("Gemini suggestions received.");
        return JSON.parse(response.text.trim());
    } catch (error: any) {
        logError('Failed to get task suggestions.', { error });
        onStatusUpdate("AI service failed.");
        throw new AIServiceError(`Failed to get task suggestions: ${error.message}`);
    }
}


export async function evaluateTaskClassification(
  taskName: string,
  goal: string | null,
  feedback: Feedback | null,
  onStatusUpdate: (status: string) => void
): Promise<{ classification: ScheduleItemType, rationale: string } | null> {
  const { aiPersonalization } = getSettings();
  
  let context: string;
  if (feedback) {
    context = `The user has COMPLETED a task. Task: "${taskName}". Goal: "${goal || 'not provided'}". Their feedback is: Focus Quality (1-5): ${feedback.focusQuality}, Mood: ${feedback.mood || 'N/A'}, Interruptions: "${feedback.interruptions || 'none'}".`;
  } else {
    context = `The user is PLANNING a task. Task: "${taskName}". Goal: "${goal || 'not provided'}".`;
  }

  const prompt = `
    Based on the principles of Deep Work vs. Shallow Work, classify the following task.
    - Deep Work Definition: Cognitively demanding tasks requiring intense focus that create high value and are hard to replicate. Examples: writing a research paper, coding a complex feature, learning a difficult new skill.
    - Shallow Work Definition: Logistical, non-demanding tasks that don't require intense focus, create little new value, and are easy to replicate. Examples: answering routine emails, scheduling meetings, data entry.

    Task Context: ${context}

    Analyze the context and classify the task as either "DEEP_WORK" or "SHALLOW_WORK". Provide a concise, one-sentence rationale for your classification. For completed tasks, consider if the user's feedback (e.g., many interruptions) suggests a deep task was actually performed shallowly.

    User personalization: ${aiPersonalization}
  `;

  const schema = {
    type: Type.OBJECT,
    properties: {
      classification: { type: Type.STRING, enum: [ScheduleItemType.DEEP_WORK, ScheduleItemType.SHALLOW_WORK] },
      rationale: { type: Type.STRING }
    }
  };

  try {
    logInfo('Evaluating task classification.', { taskName, goal, hasFeedback: !!feedback });
    onStatusUpdate("Analyzing task classification...");
    const response = await generateContentWithGemini({
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: schema },
    }, (modelName) => onStatusUpdate(`Switching to Gemini fallback model (${modelName})...`));
    onStatusUpdate("Analysis complete.");
    return JSON.parse(response.text.trim());
  } catch (error) {
      logError('Failed to evaluate task classification.', { error });
      onStatusUpdate("AI service failed.");
      // Don't throw for this one as it's a non-critical enhancement
      console.error(`Failed to evaluate task classification: ${error.message}`);
      return null;
  }
}

export async function getAnalyticsQuery(prompt: string, onStatusUpdate: (status: string) => void): Promise<AnalyticsQuery | null> {
  const geminiPrompt = `You are an analytics assistant. Analyze the user's request: "${prompt}" and return a JSON object with: 'analysisType' ('TOTAL_DURATION', 'SESSION_COUNT', 'AVERAGE_FOCUS', 'TYPE_BREAKDOWN'), 'timeframe' ('TODAY', 'LAST_7_DAYS', 'THIS_MONTH', 'ALL_TIME'), 'filters' (object with optional 'taskType' or 'status'), 'chartType' ('STAT_CARD', 'PIE_CHART', 'BAR_CHART'), 'title' (string), and an optional 'error' (string).`;
  const geminiSchema = { type: Type.OBJECT, properties: { analysisType: { type: Type.STRING, nullable: true }, timeframe: { type: Type.STRING }, filters: { type: Type.OBJECT, properties: { taskType: { type: Type.STRING, nullable: true }, status: { type: Type.STRING, nullable: true } } }, chartType: { type: Type.STRING }, title: { type: Type.STRING }, error: { type: Type.STRING, nullable: true } } };
  
  try {
      logInfo('Generating analytics query.', { prompt });
      onStatusUpdate("Querying Gemini...");
      const response = await generateContentWithGemini({
          contents: geminiPrompt,
          config: { responseMimeType: "application/json", responseSchema: geminiSchema },
      }, (modelName) => onStatusUpdate(`Switching to Gemini fallback model (${modelName})...`));
      onStatusUpdate("Gemini query successful.");
      return JSON.parse(response.text.trim());
  } catch (error) {
      logError('Failed to generate analytics query.', { error });
      onStatusUpdate("AI service failed.");
      throw new AIServiceError(`Failed to get analytics query: ${error.message}`);
  }
}

export async function getChatResponse(taskName: string, history: ChatMessage[], newUserInput: string): Promise<string> {
    if (!process.env.API_KEY) {
        logError("Gemini API key not found for chat response.");
        throw new AIServiceError("Gemini API key not found.");
    }
    try {
        logInfo('Fetching chat response.', { taskName, historyLength: history.length });
        const { aiPersonalization } = getSettings();
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const chat: Chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: { systemInstruction: `You are a helpful assistant for a user performing a focused work session. The user is working on the task: "${taskName}". Keep your responses concise and focused on helping the user complete their task. User personalization instructions: "${aiPersonalization}"` },
            history: history,
        });
        const response = await chat.sendMessage({ message: newUserInput });
        logInfo('Chat response received.');
        return response.text;
    } catch (error) {
        logError('Gemini chat failed.', { error });
        console.error("Gemini chat failed:", error);
        throw new AIServiceError("The AI assistant is currently unavailable.");
    }
}