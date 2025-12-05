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
- "genres": specific genre IDs (e.g., Action=28, Horror=27, Comedy=35, Drama=18, Sci-Fi=878, Romance=10749, Thriller=53, Animation=16, Documentary=99).
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

export const analyzeQueryWithOpenAI = async (userQuery: string, apiKey: string): Promise<GeminiFilter> => {
  if (!apiKey) {
    throw new Error("OpenAI API Key is missing");
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userQuery }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    
    if (!text) throw new Error("No response from OpenAI");

    const parsed = JSON.parse(text);
    return parsed as GeminiFilter;

  } catch (error) {
    console.error("OpenAI Error:", error);
    // Fallback to simple keyword search
    return {
      searchType: 'general',
      query: userQuery,
      explanation: "I couldn't quite understand the specific filters, so I'm doing a general search."
    };
  }
};
