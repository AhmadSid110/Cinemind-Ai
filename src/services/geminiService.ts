// src/services/geminiService.ts
// Uses the library you already have installed: @google/generative-ai

import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiFilter } from "../types";

const SYSTEM_PROMPT = `
You are CineMind, an expert movie and TV discovery assistant. 
Your job is to translate natural language user queries into structured JSON
search parameters for the TMDB API.

You MUST output VALID JSON only. No markdown, no commentary.

Supported searchType values:
1. "general"         -> Standard discovery (e.g., "movies with Brad Pitt", "best horror 2022").
2. "episode_ranking" -> User explicitly asks for best/top episodes of a specific show
                        (e.g., "best episodes of Breaking Bad", "top 20 South Park episodes").
3. "trending"        -> User asks what is hot/new/trending right now.

media_type rules (VERY IMPORTANT):
- If the user says "series", "tv show", "tv shows", "tv series", "show", "shows":
    -> media_type MUST be "tv".
- If the user says "movie", "movies", "film", "films":
    -> media_type MUST be "movie".
- If they don't specify, infer from context, but never invent both.
- For queries like "top 10 horror series" or "best crime shows":
    -> media_type = "tv".

Genres (TMDB IDs):
- Action=28, Horror=27, Comedy=35, Drama=18, Sci-Fi=878, Romance=10749,
  Thriller=53, Animation=16, Documentary=99, Crime=80, Fantasy=14, Family=10751.

Genre mapping examples:
- "horror movie", "horror series"          -> genres = [27]
- "crime series", "crime show"             -> genres = [80]
- "sci fi", "science fiction"              -> genres includes 878
- "family friendly", "kids show"           -> genres includes 10751 or 16

Other fields:
- year:        Extract explicit year (e.g. "from 2010s" -> 2010 is NOT a year; ignore decades).
- sort_by:     Usually "popularity.desc" or "vote_average.desc".
               For "top N", "best", "highest rated" -> use "vote_average.desc".
- query:       If it's a specific title or generic keyword search, put it here.
               For plain title searches (e.g. "Inception"), include the title here.
- with_people: If an actor/director is named, put their NAME here (string, not ID).
- language:    ISO 639-1 code when user says "Korean", "Spanish", etc.
- limit:       For "top N" queries, use that N. Otherwise default 20.

Output JSON schema:
{
  "searchType": "general" | "episode_ranking" | "trending",
  "media_type": "movie" | "tv" | null,
  "genres": number[] | null,
  "year": number | null,
  "sort_by": string | null,
  "query": string | null,
  "with_people": string | null,
  "language": string | null,
  "limit": number | null,
  "minVotes": number | null,
  "explanation": "Short friendly sentence explaining what you are doing."
}

Never invent impossible IDs. If you are unsure about a field, set it to null.
`;

export const analyzeQuery = async (
  userQuery: string,
  apiKey: string
): Promise<GeminiFilter> => {
  if (!apiKey) {
    console.error("Gemini API Key is missing");
    throw new Error("Gemini API Key is missing");
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    // Current, supported model
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(userQuery);
    const response = await result.response;

    // Old SDK uses text()
    const text = response.text();
    if (!text) throw new Error("No response from AI");

    const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();

    const parsed = JSON.parse(clean);
    return parsed as GeminiFilter;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);

    // Fallback so the app still works
    return {
      searchType: "general",
      media_type: null,
      genres: null,
      year: null,
      sort_by: null,
      query: userQuery,
      with_people: null,
      language: null,
      limit: 20,
      minVotes: null,
      explanation:
        "I couldn't verify the specific filters, so I'm doing a broad title search.",
    } as GeminiFilter;
  }
};