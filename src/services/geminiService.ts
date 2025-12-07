import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiFilter } from "../types";

const SYSTEM_PROMPT = `
You are CineMind, an expert movie and TV discovery assistant. 
Your goal is to translate natural language user queries into structured JSON search parameters for the TMDB API.

You must output valid JSON.

Supported Search Types:
1. "general": Standard discovery (e.g., "movies with Brad Pitt", "best horror 2022").
2. "episode_ranking": When user explicitly asks for best/top episodes of a specific show (e.g., "best episodes of Breaking Bad").
3. "trending": When user asks what is hot, new, or trending.

Extraction Rules:
- "genres": specific genre IDs (Action=28, Horror=27, Comedy=35, Drama=18, Sci-Fi=878, Romance=10749, Thriller=53, Animation=16, Documentary=99, Crime=80, Fantasy=14, Family=10751).
- "year": extract release year if mentioned.
- "sort_by": usually "popularity.desc" or "vote_average.desc".
- "query": If it's a specific title or generic keyword search, put it here.
- "with_people": If an actor/director is named, put their NAME here (string).
- "language": ISO 639-1 code (e.g., 'ko' for Korean, 'es' for Spanish).
- "limit": For rankings, default 10.

Output Schema:
{
  "searchType": "general" | "episode_ranking" | "trending",
  "media_type": "movie" | "tv",
  "genres": [ids],
  "year": number,
  "sort_by": string,
  "query": string,
  "with_people": string,
  "language": string,
  "limit": number,
  "explanation": "A short, friendly sentence explaining what you found."
}
`;

export const analyzeQuery = async (userQuery: string, apiKey: string): Promise<GeminiFilter> => {
  if (!apiKey) {
    console.error("Gemini API Key is missing");
    throw new Error("Gemini API Key is missing");
  }

  try {
    // 1. Use the standard class
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 2. Use the CORRECT model name (1.5-flash is current standard)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_PROMPT, // System prompt moves here
      generationConfig: { responseMimeType: "application/json" } // Force JSON
    });

    const result = await model.generateContent(userQuery);
    const response = await result.response;
    
    // 3. Call text() as a function
    const text = response.text();
    
    if (!text) throw new Error("No response from AI");

    // 4. Clean up any accidental markdown fences just in case
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const parsed = JSON.parse(cleanText);
    return parsed as GeminiFilter;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    
    // Fallback allows the app to keep functioning even if AI fails
    return {
      searchType: 'general',
      query: userQuery,
      explanation: "I couldn't verify the specific filters, so I'm doing a broad title search."
    };
  }
};
