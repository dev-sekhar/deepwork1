// Fix: Import `Chat` for chat sessions and `ChatMessage` for type safety.
import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { GoalAnalysisResult, AnalyticsQuery, ChatMessage } from "../types";


// Define the models to try in order of preference.
const MODELS_TO_TRY = ['gemini-2.5-flash', 'gemini-flash-latest'];

/**
 * Custom error to differentiate between rate limit types.
 */
export class RateLimitError extends Error {
  limitType: 'MINUTE' | 'DAY';
  constructor(message: string, limitType: 'MINUTE' | 'DAY') {
    super(message);
    this.name = 'RateLimitError';
    this.limitType = limitType;
  }
}


/**
 * A helper function to call the Gemini API with a fallback model mechanism.
 * If a model is rate-limited, it automatically tries the next one in the list.
 * @param baseParams - The parameters for the generateContent call, without the model name.
 * @param onModelSwitch - A callback function that is invoked when switching to a new model.
 * @returns The response from the first successful API call.
 * @throws An error if all models are rate-limited or if a non-rate-limit error occurs.
 */
async function generateContentWithModelFallback(
    baseParams: { contents: any; config: any; },
    onModelSwitch: (modelName: string) => void
): Promise<GenerateContentResponse> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let lastError: any = null;

    for (const [index, model] of MODELS_TO_TRY.entries()) {
        try {
            if (index > 0) { // If it's not the first model
                onModelSwitch(model);
                // Brief pause to allow UI to update if needed
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            const response = await ai.models.generateContent({ model, ...baseParams });
            return response;
        } catch (error) {
            lastError = error;
            const errorMessage = error.toString().toLowerCase();
            if (errorMessage.includes("429") || errorMessage.includes("resource_exhausted")) {
                 if (errorMessage.includes("daily")) {
                    // This is a hard stop. Propagate a 'DAY' limit error immediately.
                    throw new RateLimitError("Daily quota exceeded.", 'DAY');
                }
                // It's a per-minute limit. Log it and continue to the next model.
                console.warn(`Model ${model} is rate-limited per minute. Trying next...`);
                continue;
            }
            // This is a different kind of error, so we should stop and re-throw it.
            throw error;
        }
    }
    
    // If the loop completes, it means all models were rate-limited.
    if (lastError) {
        const errorMessage = lastError.toString().toLowerCase();
        if (errorMessage.includes("429") || errorMessage.includes("resource_exhausted")) {
            // All models failed due to per-minute limits.
            throw new RateLimitError("All models are currently rate-limited.", 'MINUTE');
        }
    }
    throw lastError;
}


export async function getPreSessionRitual(taskDescription: string, taskGoal: string, onModelSwitch: (modelName: string) => void): Promise<string[] | null> {
  // Assume API_KEY is set in the environment
  if (!process.env.API_KEY) {
    console.error("API_KEY environment variable not set.");
    // Return a default ritual if API key is missing
    return [
        "Take a few deep breaths.",
        "Close unnecessary tabs and applications.",
        "Put your phone on silent and out of sight.",
        "Briefly review your goal for this session."
    ];
  }

  try {
    const response = await generateContentWithModelFallback({
      contents: `Based on the deep work task '${taskDescription}' with the goal '${taskGoal}', generate a short, actionable pre-session ritual (3-4 steps) to help the user get into a state of focus. The ritual should be about preparing the mind and environment.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ritual: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
                description: 'A single step in the pre-session ritual.',
              },
            },
          },
        },
      },
    }, onModelSwitch);

    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);
    
    if (result.ritual && Array.isArray(result.ritual)) {
      return result.ritual;
    }
    return null;
  } catch (error) {
    console.error("Error fetching pre-session ritual from Gemini API:", error);
    throw error; // Re-throw the error to be handled by the component
  }
}

export async function evaluateSMARTGoal(taskDescription: string, taskGoal: string, onModelSwitch: (modelName: string) => void): Promise<GoalAnalysisResult | null> {
    if (!process.env.API_KEY) {
        console.error("API_KEY environment variable not set.");
        return null;
    }

    try {
        const response = await generateContentWithModelFallback({
            contents: `Analyze the following goal for a deep work session based on SMART criteria (Specific, Measurable, Achievable, Relevant, Time-bound).
            Task: "${taskDescription}"
            Goal: "${taskGoal}"
            
            Respond with a JSON object. The object must contain:
            1. "isSMART": a boolean, true if the goal is SMART.
            2. "feedback": a string with a concise, one-sentence explanation of your evaluation.
            3. "suggestion": a string with a revised, improved goal if isSMART is false. If it is already SMART, this can be an empty string.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        isSMART: { type: Type.BOOLEAN },
                        feedback: { type: Type.STRING },
                        suggestion: { type: Type.STRING },
                    },
                },
            },
        }, onModelSwitch);

        const jsonString = response.text.trim();
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Error evaluating SMART goal with Gemini API:", error);
        throw error; // Re-throw the error to be handled by the component
    }
}

export async function getSuggestedDuration(taskDescription: string, taskGoal: string, onModelSwitch: (modelName: string) => void): Promise<number | null> {
    if (!process.env.API_KEY) {
        console.error("API_KEY environment variable not set.");
        return null;
    }

    try {
        const response = await generateContentWithModelFallback({
            contents: `Based on the task "${taskDescription}" and goal "${taskGoal}", suggest an ideal duration in minutes for a single, uninterrupted deep work session. Common durations are 60, 90, or 120 minutes. Consider the complexity and scope of the goal.
            
            Respond with a JSON object containing only the suggested duration.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        duration: { 
                            type: Type.NUMBER,
                            description: "The suggested duration in minutes."
                        },
                    },
                },
            },
        }, onModelSwitch);

        const jsonString = response.text.trim();
        const result = JSON.parse(jsonString);
        
        if (result.duration && typeof result.duration === 'number') {
            // Round to nearest 5 minutes for user-friendliness
            return Math.round(result.duration / 5) * 5;
        }
        return null;
    } catch (error) {
        console.error("Error fetching suggested duration from Gemini API:", error);
        throw error; // Re-throw the error to be handled by the component
    }
}


export async function getAnalyticsQuery(prompt: string, onModelSwitch: (modelName: string) => void): Promise<AnalyticsQuery | null> {
    if (!process.env.API_KEY) {
        console.error("API_KEY environment variable not set.");
        return null;
    }

    try {
        const response = await generateContentWithModelFallback({
            contents: `You are an analytics assistant for a productivity app. Analyze the user's request about their work sessions and return a JSON object describing how to query and visualize the data.
            User Request: "${prompt}"
            
            Instructions:
            1.  Determine the 'analysisType': 'TOTAL_DURATION', 'SESSION_COUNT', 'AVERAGE_FOCUS', or 'TYPE_BREAKDOWN'.
            2.  Determine the 'timeframe': 'TODAY', 'LAST_7_DAYS', 'THIS_MONTH', or 'ALL_TIME'.
            3.  Determine if there are filters for 'taskType' ('DEEP_WORK', 'SHALLOW_WORK', 'AI_ASSISTED_WORK') or 'status' ('PENDING', 'COMPLETED'). If not specified, omit them.
            4.  Suggest a 'chartType': 'STAT_CARD' (for single numbers), 'PIE_CHART' (for breakdowns), or 'BAR_CHART' (for comparisons).
            5.  Create a concise 'title' for the chart.
            6.  If the request is unclear or cannot be fulfilled, return a JSON object with an 'error' field explaining why.
            
            Example Request: "How much deep work did I complete this month?"
            Example Response: {"analysisType": "TOTAL_DURATION", "timeframe": "THIS_MONTH", "filters": {"taskType": "DEEP_WORK", "status": "COMPLETED"}, "chartType": "STAT_CARD", "title": "Total Completed Deep Work This Month"}

            Example Request: "How many tasks are pending for today?"
            Example Response: {"analysisType": "SESSION_COUNT", "timeframe": "TODAY", "filters": {"status": "PENDING"}, "chartType": "STAT_CARD", "title": "Pending Tasks Today"}
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        analysisType: { type: Type.STRING, nullable: true },
                        timeframe: { type: Type.STRING },
                        filters: {
                            type: Type.OBJECT,
                            properties: {
                                taskType: { type: Type.STRING, nullable: true },
                                status: { type: Type.STRING, nullable: true }
                            }
                        },
                        chartType: { type: Type.STRING },
                        title: { type: Type.STRING },
                        error: { type: Type.STRING, nullable: true }
                    },
                },
            },
        }, onModelSwitch);

        const jsonString = response.text.trim();
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Error fetching analytics query from Gemini API:", error);
        throw error;
    }
}
// Fix: Implement and export getChatResponse to handle chat messages.
export async function getChatResponse(taskName: string, history: ChatMessage[], newUserInput: string): Promise<string> {
    if (!process.env.API_KEY) {
        console.error("API_KEY environment variable not set.");
        return "Sorry, I can't connect to the assistant right now. (API key missing)";
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const chat: Chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: `You are a helpful assistant for a user performing a focused work session. The user is working on the task: "${taskName}". Keep your responses concise and focused on helping the user complete their task.`,
            },
            history: history,
        });

        const response = await chat.sendMessage({ message: newUserInput });
        
        return response.text;

    } catch (error) {
        console.error("Error fetching chat response from Gemini API:", error);
        return "Sorry, something went wrong while trying to get a response.";
    }
}
