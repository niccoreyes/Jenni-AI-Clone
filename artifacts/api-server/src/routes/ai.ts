import { Router, type IRouter } from "express";
import {
  AutocompleteBody,
  AutocompleteResponse,
  ParaphraseBody,
  ParaphraseResponse,
  AiChatBody,
  AiChatResponse,
  GenerateOutlineBody,
  GenerateOutlineResponse,
} from "@workspace/api-zod";
import { db, settingsTable } from "@workspace/db";
import { streamText, pipeTextStreamToResponse, type LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";

const router: IRouter = Router();

async function getSettings() {
  const [settings] = await db.select().from(settingsTable).limit(1);
  return settings;
}

function buildClient(settings: {
  provider: string;
  apiKey?: string | null;
  baseUrl?: string | null;
  model: string;
}) {
  const { provider, apiKey, baseUrl, model } = settings;

  let endpoint = baseUrl ?? "";
  if (!endpoint) {
    switch (provider) {
      case "anthropic":
        endpoint = "https://api.anthropic.com/v1";
        break;
      case "moonshot":
        endpoint = "https://api.moonshot.cn/v1";
        break;
      case "openrouter":
        endpoint = "https://openrouter.ai/api/v1";
        break;
      default:
        endpoint = "https://api.openai.com/v1";
    }
  }

  return { endpoint, apiKey, model };
}

async function callOpenAICompat(
  endpoint: string,
  apiKey: string | null | undefined,
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number = 0.7,
  maxRetries: number = 3,
): Promise<string> {
  if (!apiKey) {
    return generateFallbackResponse(
      messages[messages.length - 1]?.content ?? "",
    );
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: 1024,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          choices: Array<{ message: { content: string } }>;
        };
        return data.choices[0]?.message?.content ?? "";
      }

      // Handle rate limiting (429) with exponential backoff
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const waitTime = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.pow(2, attempt) * 1000; // exponential backoff

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        } else {
          throw new Error(
            `AI API rate limit exceeded. Please wait before trying again.`,
          );
        }
      }

      // Handle other errors
      if (response.status === 401) {
        throw new Error(
          `AI API authentication failed. Please check your API key.`,
        );
      } else if (response.status === 403) {
        throw new Error(
          `AI API access forbidden. Please check your API key permissions.`,
        );
      } else if (response.status >= 500) {
        // Retry server errors
        if (attempt < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000),
          );
          continue;
        }
        throw new Error(
          `AI API server error: ${response.status} ${response.statusText}`,
        );
      } else {
        throw new Error(
          `AI API error: ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      lastError = error as Error;
      if (
        attempt < maxRetries &&
        (error as Error).message.includes("rate limit")
      ) {
        continue;
      }
      break;
    }
  }

  throw lastError || new Error("AI API request failed after retries");
}

function generateFallbackResponse(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("autocomplete") || lower.includes("continue")) {
    return "This phenomenon has been extensively studied in recent literature, with researchers identifying several key mechanisms that underlie the observed effects.";
  }
  if (lower.includes("paraphrase") || lower.includes("rewrite")) {
    return "The revised formulation maintains the original meaning while adjusting the rhetorical register to better suit the academic context.";
  }
  return "Based on the current evidence, several important considerations emerge from this analysis.";
}

router.post("/ai/autocomplete", async (req, res): Promise<void> => {
  const parsed = AutocompleteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const settings = await getSettings();
  const { endpoint, apiKey, model } = buildClient(
    settings ?? { provider: "openai", model: "gpt-5.2" },
  );

  const systemPrompt = `You are completing the user's sentence. The text they provided is INCOMPLETE. Your job is to continue from the EXACT point where they stopped writing. Do NOT start a new sentence or paragraph. Do NOT repeat or paraphrase what they wrote. Continue the grammatical structure, thought, or phrase they were in the middle of. If they stopped mid-sentence, finish that sentence naturally. If they just finished a sentence, add 1-2 sentences that logically follow. Do NOT add citations, author names, years, or references in parentheses. Return ONLY the continuation text—no preamble, no explanations, no quotes.`;

  const lastChunk = parsed.data.currentText.slice(-1000);
  const lastSentence = parsed.data.currentText.split(/[.!?;\n]+/).pop() || "";

  let suggestion = "";
  if (apiKey) {
    suggestion = await callOpenAICompat(
      endpoint,
      apiKey,
      model,
      [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Continue from exactly where this text ends. Do not repeat or rephrase anything—just continue:\n\n${lastChunk}\n\n[END OF TEXT - continue from here]:`,
        },
      ],
      0.2,
    );
    console.log("[DEBUG] lastSentence:", JSON.stringify(lastSentence));
    console.log("[DEBUG] suggestion before:", JSON.stringify(suggestion));
    if (
      lastSentence &&
      suggestion.toLowerCase().includes(lastSentence.toLowerCase().trim())
    ) {
      const regex = new RegExp(
        lastSentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "gi",
      );
      suggestion = suggestion.replace(regex, "").trim();
      console.log(
        "[DEBUG] suggestion after dedup:",
        JSON.stringify(suggestion),
      );
    }

    // Remove common AI preamble patterns
    suggestion = suggestion
      .replace(
        /^(here|this|the)\s+(text|passage|sentence|paragraph)\s+(is|shows|demonstrates|illustrates|continues)/i,
        "",
      )
      .replace(
        /^(continuing|following|above)\s+(from|where)\s+(you|the)\s+(left|stopped|ended)/i,
        "",
      )
      .trim();

    // Safeguard: if post-processing emptied the suggestion, use a fallback
    if (!suggestion) {
      console.log(
        "[DEBUG] Suggestion was emptied by post-processing, using fallback",
      );
      suggestion =
        "This analysis reveals several important patterns that warrant further investigation.";
    }
  } else {
    suggestion =
      "This analysis reveals several important patterns that warrant further investigation, particularly in relation to the broader theoretical framework established in prior research.";
  }

  res.json(AutocompleteResponse.parse({ suggestion, alternative: null }));
});

// Helper to create model provider based on settings
function createModelProvider(settings: {
  provider: string;
  apiKey: string;
  baseUrl?: string | null;
  model: string;
}): LanguageModel {
  const { provider, apiKey, baseUrl, model } = settings;

  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey, baseURL: baseUrl ?? undefined })(model);
    case "openrouter":
      return createOpenAI({
        apiKey,
        baseURL: baseUrl ?? "https://openrouter.ai/api/v1",
      })(model);
    case "moonshot":
      return createOpenAI({
        apiKey,
        baseURL: baseUrl ?? "https://api.moonshot.cn/v1",
      })(model);
    default:
      return createOpenAI({
        apiKey,
        baseURL: baseUrl ?? "https://api.openai.com/v1",
      })(model);
  }
}

// Streaming autocomplete endpoint
router.post("/ai/autocomplete/stream", async (req, res): Promise<void> => {
  const parsed = AutocompleteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const settings = await getSettings();
  const configuredSettings = settings ?? {
    provider: "openai",
    model: "gpt-4o-mini",
  };

  const systemPrompt = `You are completing the user's sentence. The text they provided is INCOMPLETE. Your job is to continue from the EXACT point where they stopped writing. Do NOT start a new sentence or paragraph. Do NOT repeat or paraphrase what they wrote. Continue the grammatical structure, thought, or phrase they were in the middle of. If they stopped mid-sentence, finish that sentence naturally. If they just finished a sentence, add 1-2 sentences that logically follow. Do NOT add citations, author names, years, or references in parentheses. Return ONLY the continuation text—no preamble, no explanations, no quotes.`;

  const lastChunk = parsed.data.currentText.slice(-1000);

  try {
    if (!configuredSettings.apiKey) {
      res.status(400).json({ error: "API key not configured" });
      return;
    }

    const model = createModelProvider({
      provider: configuredSettings.provider,
      model: configuredSettings.model,
      apiKey: configuredSettings.apiKey,
      baseUrl: configuredSettings.baseUrl ?? undefined,
    });

    const result = streamText({
      model,
      system: systemPrompt,
      prompt: `Continue from exactly where this text ends. Do not repeat or rephrase anything—just continue:\n\n${lastChunk}\n\n[END OF TEXT - continue from here]:`,
      temperature: 0.2,
      maxTokens: 512,
    } as any);

    pipeTextStreamToResponse({
      response: res,
      textStream: result.textStream,
    });
  } catch (error) {
    console.error("Streaming error:", error);
    res.status(500).json({ error: "Streaming failed" });
  }
});

router.post("/ai/paraphrase", async (req, res): Promise<void> => {
  const parsed = ParaphraseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const settings = await getSettings();
  const { endpoint, apiKey, model } = buildClient(
    settings ?? { provider: "openai", model: "gpt-5.2" },
  );

  const modeInstructions: Record<string, string> = {
    simplify:
      "Rewrite this text in simpler language, reducing jargon while preserving meaning.",
    academic:
      "Rewrite this text with more formal academic language, increasing scholarly tone.",
    expand: "Expand this text with more detail, evidence, and elaboration.",
    shorten:
      "Condense this text to its essential points while preserving key information.",
    active: "Rewrite this text using active voice throughout.",
    passive: "Rewrite this text using passive voice throughout.",
  };

  const instruction =
    modeInstructions[parsed.data.mode] ?? modeInstructions.academic;

  let result = "";
  if (apiKey) {
    result = await callOpenAICompat(
      endpoint,
      apiKey,
      model,
      [
        {
          role: "system",
          content: `${instruction} Return ONLY the rewritten text.`,
        },
        { role: "user", content: parsed.data.text },
      ],
      0.4,
    );
  } else {
    result = `[${parsed.data.mode.toUpperCase()} MODE] ${parsed.data.text}`;
  }

  res.json(ParaphraseResponse.parse({ result, warning: null }));
});

router.post("/ai/chat", async (req, res): Promise<void> => {
  const parsed = AiChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const settings = await getSettings();
  const { endpoint, apiKey, model } = buildClient(
    settings ?? { provider: "openai", model: "gpt-5.2" },
  );

  const systemPrompt = `You are an academic research assistant helping a scholar write. You provide cited, careful, academically rigorous responses. When referencing information, indicate confidence levels. Do not fabricate citations or statistics.${parsed.data.documentContext ? `\n\nCurrent document context:\n${parsed.data.documentContext}` : ""}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...(parsed.data.history ?? []),
    { role: "user", content: parsed.data.message },
  ];

  let response = "";
  if (apiKey) {
    response = await callOpenAICompat(endpoint, apiKey, model, messages, 0.7);
  } else {
    response =
      "To use the AI chat feature, please configure your API key in Settings. I can help you analyze your document, find research gaps, generate outlines, and suggest citations once connected.";
  }

  res.json(AiChatResponse.parse({ response, citations: [] }));
});

router.post("/ai/outline", async (req, res): Promise<void> => {
  const parsed = GenerateOutlineBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const settings = await getSettings();
  const { endpoint, apiKey, model } = buildClient(
    settings ?? { provider: "openai", model: "gpt-5.2" },
  );

  const systemPrompt = `You are an academic writing expert. Generate a structured outline for a ${parsed.data.documentType ?? "research_paper"} on the given topic. Return valid JSON only in this format:
{
  "outline": [
    { "level": 1, "title": "Section Title", "subsections": [
      { "level": 2, "title": "Subsection", "subsections": [] }
    ]}
  ]
}`;

  let outlineData;
  if (apiKey) {
    const raw = await callOpenAICompat(
      endpoint,
      apiKey,
      model,
      [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Topic: ${parsed.data.topic}\nThesis: ${parsed.data.thesis}${parsed.data.fieldOfStudy ? `\nField: ${parsed.data.fieldOfStudy}` : ""}`,
        },
      ],
      0.3,
    );
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      outlineData = match ? JSON.parse(match[0]) : null;
    } catch {
      outlineData = null;
    }
  }

  if (!outlineData) {
    outlineData = {
      outline: [
        {
          level: 1,
          title: "Introduction",
          subsections: [
            { level: 2, title: "Background and Context", subsections: [] },
            { level: 2, title: "Research Problem", subsections: [] },
            {
              level: 2,
              title: `Thesis: ${parsed.data.thesis}`,
              subsections: [],
            },
          ],
        },
        {
          level: 1,
          title: "Literature Review",
          subsections: [
            { level: 2, title: "Theoretical Framework", subsections: [] },
            { level: 2, title: "Prior Research", subsections: [] },
            { level: 2, title: "Research Gaps", subsections: [] },
          ],
        },
        {
          level: 1,
          title: "Methodology",
          subsections: [
            { level: 2, title: "Research Design", subsections: [] },
            { level: 2, title: "Data Collection", subsections: [] },
            { level: 2, title: "Analysis Approach", subsections: [] },
          ],
        },
        {
          level: 1,
          title: "Results",
          subsections: [
            { level: 2, title: "Key Findings", subsections: [] },
            { level: 2, title: "Data Analysis", subsections: [] },
          ],
        },
        {
          level: 1,
          title: "Discussion",
          subsections: [
            { level: 2, title: "Interpretation of Results", subsections: [] },
            { level: 2, title: "Implications", subsections: [] },
            { level: 2, title: "Limitations", subsections: [] },
          ],
        },
        {
          level: 1,
          title: "Conclusion",
          subsections: [
            { level: 2, title: "Summary of Findings", subsections: [] },
            { level: 2, title: "Future Research Directions", subsections: [] },
          ],
        },
      ],
    };
  }

  res.json(GenerateOutlineResponse.parse(outlineData));
});

export default router;
