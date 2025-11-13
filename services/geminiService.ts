
import { GoogleGenAI, Type } from "@google/genai";

export async function getPreSessionRitual(taskDescription: string): Promise<string[] | null> {
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
      contents: `Based on the deep work task '${taskDescription}', generate a short, actionable pre-session ritual (3-4 steps) to help the user get into a state of focus. The ritual should be about preparing the mind and environment.`,
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
