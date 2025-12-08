// src/services/geminiService.ts
// Uses the library you already have installed:
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

// --- Helper: pick one key from a comma-separated list and rotate ---
function pickGeminiKey(raw: string | undefined | null): string | null {
  if (!raw) return null;

  const parts = raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (!parts.length) return null;

  // simple round-robin index stored in localStorage
  let index = 0;
  try {
    const stored = localStorage.getItem("gemini_key_index");
    if (stored) {
      const n = parseInt(stored, 10);
      if (!Number.isNaN(n)) index = n;
    }
  } catch {
    // ignore if localStorage not available
  }

  const key = parts[index % parts.length];

  try {
    localStorage.setItem(
      "gemini_key_index",
      String((index + 1) % parts.length)
    );
  } catch {
    // ignore storage errors
  }

  return key;
}

export const analyzeQuery = async (
  userQuery: string,
  rawApiKey: string
): Promise<GeminiFilter> => {
  const apiKey = pickGeminiKey(rawApiKey);

  if (!apiKey) {
    console.error("Gemini API Key is missing");
    throw new Error("Gemini API Key is missing");
  }

  try {
    // 1. Initialize the SDK you have installed
    const genAI = new GoogleGenerativeAI(apiKey);

    // 2. Use the current stable model
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent(userQuery);
    const response = await result.response;

    // 3. Old SDK uses .text() as a function
    const text = response.text();

    if (!text) throw new Error("No response from AI");

    // Clean accidental markdown fences
    const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText) as GeminiFilter;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);

    // Fallback allows the app to keep functioning
    return {
      searchType: "general",
      query: userQuery,
      explanation:
        "I couldn't verify the specific filters, so I'm doing a broad title search.",
    };
  }
};