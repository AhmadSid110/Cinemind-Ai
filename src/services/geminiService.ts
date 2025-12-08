import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiFilter } from "../types";

const SYSTEM_PROMPT = `
You are CineMind. Translate user queries into JSON search parameters for TMDB.
Output valid JSON only. NO markdown.

Rules:
- "genres": IDs (Action=28, Horror=27, Comedy=35, Sci-Fi=878, Thriller=53, Drama=18, Crime=80, Fantasy=14, Family=10751).
- "year": number or null.
- "sort_by": "popularity.desc" or "vote_average.desc".
- "limit": number (default 20).
- "searchType": "trending" | "episode_ranking" | "general".
- "media_type": "movie" | "tv".
- "explanation": Short string.
`;

async function tryGenerate(apiKey: string, query: string): Promise<GeminiFilter> {
  const genAI = new GoogleGenerativeAI(apiKey);
  // Using gemini-2.5-flash as it is the current standard.
  // If this fails (unlikely), change to "gemini-1.5-flash".
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash", 
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json" }
  });

  const result = await model.generateContent(query);
  const response = await result.response;
  const text = response.text();
  if (!text) throw new Error("Empty response");

  const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleanText) as GeminiFilter;
}

export const analyzeQuery = async (userQuery: string, apiKeys: string[]): Promise<GeminiFilter> => {
  const validKeys = apiKeys.filter(k => k && k.trim().length > 0);
  if (validKeys.length === 0) throw new Error("No Gemini API Keys provided");

  let lastError;
  for (let i = 0; i < validKeys.length; i++) {
    const currentKey = validKeys[i];
    try {
      if (i > 0) console.log(`🔄 Switching to Key #${i + 1}...`);
      return await tryGenerate(currentKey, userQuery);
    } catch (error: any) {
      console.warn(`⚠️ Key #${i + 1} failed:`, error.message);
      lastError = error;
      if (i === validKeys.length - 1) break;
    }
  }

  console.error("❌ All Gemini Keys failed.");
  return {
    searchType: 'general',
    query: userQuery,
    explanation: "I couldn't verify the specific filters (AI busy), so I'm doing a broad search."
  };
};
