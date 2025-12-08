// src/services/geminiService.ts
// We use the library you ALREADY have installed:
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
    // 1. Initialize the Old SDK (which you have installed)
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 2. Use the NEWEST Stable Model: "gemini-2.5-flash"
    // "gemini-1.5-flash-001" is retired, which caused the 404 error
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash", 
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: { responseMimeType: "application/json" }
    });

    const result = await model.generateContent(userQuery);
    const response = await result.response;
    
    // 3. Old SDK uses .text() as a function
    const text = response.text();
    
    if (!text) throw new Error("No response from AI");

    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText) as GeminiFilter;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    
    // Fallback allows the app to keep functioning
    return {
      searchType: 'general',
      query: userQuery,
      explanation: "I couldn't verify the specific filters, so I'm doing a broad title search."
    };
  }
};
