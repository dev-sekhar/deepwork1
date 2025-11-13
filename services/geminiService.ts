
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, GoalAnalysisResult } from "../types";

export async function getPreSessionRitual(taskDescription: string, taskGoal: string): Promise<string[] | null> {
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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
    });

    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);
    
    if (result.ritual && Array.isArray(result.ritual)) {
      return result.ritual;
    }
    return null;
  } catch (error) {
    console.error("Error fetching pre-session ritual from Gemini API:", error);
    return null;
  }
}

export async function evaluateSMARTGoal(taskDescription: string, taskGoal: string): Promise<GoalAnalysisResult | null> {
    if (!process.env.API_KEY) {
        console.error("API_KEY environment variable not set.");
        return null;
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
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
        });

        const jsonString = response.text.trim();
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Error evaluating SMART goal with Gemini API:", error);
        return null;
    }
}

export async function getSuggestedDuration(taskDescription: string, taskGoal: string): Promise<number | null> {
    if (!process.env.API_KEY) {
        console.error("API_KEY environment variable not set.");
        return null;
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
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
        });

        const jsonString = response.text.trim();
        const result = JSON.parse(jsonString);
        
        if (result.duration && typeof result.duration === 'number') {
            // Round to nearest 5 minutes for user-friendliness
            return Math.round(result.duration / 5) * 5;
        }
        return null;
    } catch (error) {
        console.error("Error fetching suggested duration from Gemini API:", error);
        return null;
    }
}


// Fix: Add getChatResponse function to interact with Gemini chat.
export async function getChatResponse(taskName: string, history: ChatMessage[], newUserInput: string): Promise<string> {
    if (!process.env.API_KEY) {
        console.error("API_KEY environment variable not set.");
        return "I'm sorry, I can't respond right now. The API key is missing.";
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            history: history,
            config: {
                systemInstruction: `You are an expert assistant for a user performing a deep work session. The user's current task is: "${taskName}". Be concise and helpful.`,
            }
        });

        const response = await chat.sendMessage({ message: newUserInput });
        return response.text;
    } catch (error) {
        console.error("Error fetching chat response from Gemini API:", error);
        return "An error occurred while trying to get a response. Please try again.";
    }
}
