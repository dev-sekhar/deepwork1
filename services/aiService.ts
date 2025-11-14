import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { GoalAnalysisResult, AnalyticsQuery, ChatMessage } from "../types";
import { getSettings } from "./settingsService";

// --- CUSTOM ERRORS ---
export class AIServiceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AIServiceError';
    }
}

// --- PROVIDER CONFIGURATION ---
const GEMINI_MODELS_TO_TRY = ['gemini-2.5-flash', 'gemini-flash-latest'];

// --- GEMINI HELPER ---
async function generateContentWithGemini(
    baseParams: { contents: any; config?: any; },
    onModelSwitch?: (modelName: string) => void
): Promise<GenerateContentResponse> {
    if (!process.env.API_KEY) {
        throw new AIServiceError("Gemini API key not found.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let lastError: any = null;

    for (const [index, model] of GEMINI_MODELS_TO_TRY.entries()) {
        try {
            if (index > 0 && onModelSwitch) {
                onModelSwitch(model);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            const response = await ai.models.generateContent({ model, ...baseParams });
            return response;
        } catch (error) {
            lastError = error;
            console.warn(`Model ${model} failed with error:`, error);
        }
    }
    
    throw new AIServiceError(`All Gemini models failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

// --- EXPORTED API FUNCTIONS ---

export async function getPreSessionRitual(taskDescription: string, taskGoal: string, onStatusUpdate: (status: string) => void): Promise<string[] | null> {
  const { aiPersonalization } = getSettings();
  const geminiPrompt = `Based on the deep work task '${taskDescription}' with the goal '${taskGoal}', generate a short, actionable pre-session ritual (3-4 steps) to help the user get into a state of focus. The ritual should be about preparing the mind and environment.
  User personalization: ${aiPersonalization}`;
  const geminiSchema = { type: Type.OBJECT, properties: { ritual: { type: Type.ARRAY, items: { type: Type.STRING } } } };
  
  try {
    onStatusUpdate("Querying Gemini...");
    const response = await generateContentWithGemini({
        contents: geminiPrompt,
        config: { responseMimeType: "application/json", responseSchema: geminiSchema },
    }, (modelName) => onStatusUpdate(`Switching to Gemini fallback model (${modelName})...`));
    onStatusUpdate("Gemini query successful.");
    const result = JSON.parse(response.text.trim());
    return result.ritual && Array.isArray(result.ritual) ? result.ritual : null;
  } catch (error) {
     onStatusUpdate("AI service failed.");
     throw new AIServiceError(`Failed to get pre-session ritual: ${error.message}`);
  }
}

export async function evaluateSMARTGoal(taskDescription: string, taskGoal: string, onStatusUpdate: (status: string) => void): Promise<GoalAnalysisResult | null> {
  const { aiPersonalization } = getSettings();
  const geminiPrompt = `Analyze the following goal for a deep work session based on SMART criteria (Specific, Measurable, Achievable, Relevant, Time-bound). Task: "${taskDescription}" Goal: "${taskGoal}"
    Respond with a JSON object containing: "isSMART" (boolean), "feedback" (string, concise explanation), and "suggestion" (string, revised goal if needed).
    User personalization: ${aiPersonalization}`;
  const geminiSchema = { type: Type.OBJECT, properties: { isSMART: { type: Type.BOOLEAN }, feedback: { type: Type.STRING }, suggestion: { type: Type.STRING } } };

  try {
      onStatusUpdate("Querying Gemini...");
      const response = await generateContentWithGemini({
          contents: geminiPrompt,
          config: { responseMimeType: "application/json", responseSchema: geminiSchema },
      }, (modelName) => onStatusUpdate(`Switching to Gemini fallback model (${modelName})...`));
      onStatusUpdate("Gemini query successful.");
      return JSON.parse(response.text.trim());
  } catch(error) {
      onStatusUpdate("AI service failed.");
      throw new AIServiceError(`Failed to evaluate SMART goal: ${error.message}`);
  }
}

export async function getSuggestedDuration(taskDescription: string, taskGoal: string, onStatusUpdate: (status: string) => void): Promise<number | null> {
  const geminiPrompt = `Based on the task "${taskDescription}" and goal "${taskGoal}", suggest an ideal duration in minutes for a single, uninterrupted deep work session (e.g., 60, 90, 120). Respond with a JSON object containing only the key "duration".`;
  const geminiSchema = { type: Type.OBJECT, properties: { duration: { type: Type.NUMBER } } };

  try {
      onStatusUpdate("Querying Gemini...");
       const response = await generateContentWithGemini({
          contents: geminiPrompt,
          config: { responseMimeType: "application/json", responseSchema: geminiSchema },
      }, (modelName) => onStatusUpdate(`Switching to Gemini fallback model (${modelName})...`));
      onStatusUpdate("Gemini query successful.");
      const result = JSON.parse(response.text.trim());
      if (result.duration && typeof result.duration === 'number') {
        return Math.round(result.duration / 5) * 5;
      }
      return null;
  } catch(error) {
      onStatusUpdate("AI service failed.");
      throw new AIServiceError(`Failed to get suggested duration: ${error.message}`);
  }
}

export async function getAnalyticsQuery(prompt: string, onStatusUpdate: (status: string) => void): Promise<AnalyticsQuery | null> {
  const geminiPrompt = `You are an analytics assistant. Analyze the user's request: "${prompt}" and return a JSON object with: 'analysisType' ('TOTAL_DURATION', 'SESSION_COUNT', 'AVERAGE_FOCUS', 'TYPE_BREAKDOWN'), 'timeframe' ('TODAY', 'LAST_7_DAYS', 'THIS_MONTH', 'ALL_TIME'), 'filters' (object with optional 'taskType' or 'status'), 'chartType' ('STAT_CARD', 'PIE_CHART', 'BAR_CHART'), 'title' (string), and an optional 'error' (string).`;
  const geminiSchema = { type: Type.OBJECT, properties: { analysisType: { type: Type.STRING, nullable: true }, timeframe: { type: Type.STRING }, filters: { type: Type.OBJECT, properties: { taskType: { type: Type.STRING, nullable: true }, status: { type: Type.STRING, nullable: true } } }, chartType: { type: Type.STRING }, title: { type: Type.STRING }, error: { type: Type.STRING, nullable: true } } };
  
  try {
      onStatusUpdate("Querying Gemini...");
      const response = await generateContentWithGemini({
          contents: geminiPrompt,
          config: { responseMimeType: "application/json", responseSchema: geminiSchema },
      }, (modelName) => onStatusUpdate(`Switching to Gemini fallback model (${modelName})...`));
      onStatusUpdate("Gemini query successful.");
      return JSON.parse(response.text.trim());
  } catch (error) {
      onStatusUpdate("AI service failed.");
      throw new AIServiceError(`Failed to get analytics query: ${error.message}`);
  }
}

export async function getChatResponse(taskName: string, history: ChatMessage[], newUserInput: string): Promise<string> {
    if (!process.env.API_KEY) {
        throw new AIServiceError("Gemini API key not found.");
    }
    try {
        const { aiPersonalization } = getSettings();
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const chat: Chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: { systemInstruction: `You are a helpful assistant for a user performing a focused work session. The user is working on the task: "${taskName}". Keep your responses concise and focused on helping the user complete their task. User personalization instructions: "${aiPersonalization}"` },
            history: history,
        });
        const response = await chat.sendMessage({ message: newUserInput });
        return response.text;
    } catch (error) {
        console.error("Gemini chat failed:", error);
        throw new AIServiceError("The AI assistant is currently unavailable.");
    }
}