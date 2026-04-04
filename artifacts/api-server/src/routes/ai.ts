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

const router: IRouter = Router();

async function getSettings() {
  const [settings] = await db.select().from(settingsTable).limit(1);
  return settings;
}

function buildClient(settings: { provider: string; apiKey?: string | null; baseUrl?: string | null; model: string }) {
  const { provider, apiKey, baseUrl, model } = settings;

  let endpoint = baseUrl ?? "";
  if (!endpoint) {
    switch (provider) {
      case "anthropic": endpoint = "https://api.anthropic.com/v1"; break;
      case "moonshot": endpoint = "https://api.moonshot.cn/v1"; break;
      default: endpoint = "https://api.openai.com/v1";
    }
  }

  return { endpoint, apiKey, model };
}

async function callOpenAICompat(
  endpoint: string,
  apiKey: string | null | undefined,
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number = 0.7
): Promise<string> {
  if (!apiKey) {
    return generateFallbackResponse(messages[messages.length - 1]?.content ?? "");
  }

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

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? "";
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
  const { endpoint, apiKey, model } = buildClient(settings ?? { provider: "openai", model: "gpt-4o" });

  const systemPrompt = `You are an academic writing assistant. Continue the user's text with 1-2 sentences that logically follow. Match the academic tone and citation style (${parsed.data.citationStyle ?? "APA7"}). Return ONLY the continuation text, no preamble.`;

  const lastChunk = parsed.data.currentText.slice(-1000);

  let suggestion = "";
  if (apiKey) {
    suggestion = await callOpenAICompat(
      endpoint,
      apiKey,
      model,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Continue this text:\n${lastChunk}` },
      ],
      0.3
    );
  } else {
    suggestion = "This analysis reveals several important patterns that warrant further investigation, particularly in relation to the broader theoretical framework established in prior research.";
  }

  res.json(AutocompleteResponse.parse({ suggestion, alternative: null }));
});

router.post("/ai/paraphrase", async (req, res): Promise<void> => {
  const parsed = ParaphraseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const settings = await getSettings();
  const { endpoint, apiKey, model } = buildClient(settings ?? { provider: "openai", model: "gpt-4o" });

  const modeInstructions: Record<string, string> = {
    simplify: "Rewrite this text in simpler language, reducing jargon while preserving meaning.",
    academic: "Rewrite this text with more formal academic language, increasing scholarly tone.",
    expand: "Expand this text with more detail, evidence, and elaboration.",
    shorten: "Condense this text to its essential points while preserving key information.",
    active: "Rewrite this text using active voice throughout.",
    passive: "Rewrite this text using passive voice throughout.",
  };

  const instruction = modeInstructions[parsed.data.mode] ?? modeInstructions.academic;

  let result = "";
  if (apiKey) {
    result = await callOpenAICompat(
      endpoint,
      apiKey,
      model,
      [
        { role: "system", content: `${instruction} Return ONLY the rewritten text.` },
        { role: "user", content: parsed.data.text },
      ],
      0.4
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
  const { endpoint, apiKey, model } = buildClient(settings ?? { provider: "openai", model: "gpt-4o" });

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
    response = "To use the AI chat feature, please configure your API key in Settings. I can help you analyze your document, find research gaps, generate outlines, and suggest citations once connected.";
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
  const { endpoint, apiKey, model } = buildClient(settings ?? { provider: "openai", model: "gpt-4o" });

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
        { role: "user", content: `Topic: ${parsed.data.topic}\nThesis: ${parsed.data.thesis}${parsed.data.fieldOfStudy ? `\nField: ${parsed.data.fieldOfStudy}` : ""}` },
      ],
      0.3
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
        { level: 1, title: "Introduction", subsections: [
          { level: 2, title: "Background and Context", subsections: [] },
          { level: 2, title: "Research Problem", subsections: [] },
          { level: 2, title: `Thesis: ${parsed.data.thesis}`, subsections: [] },
        ]},
        { level: 1, title: "Literature Review", subsections: [
          { level: 2, title: "Theoretical Framework", subsections: [] },
          { level: 2, title: "Prior Research", subsections: [] },
          { level: 2, title: "Research Gaps", subsections: [] },
        ]},
        { level: 1, title: "Methodology", subsections: [
          { level: 2, title: "Research Design", subsections: [] },
          { level: 2, title: "Data Collection", subsections: [] },
          { level: 2, title: "Analysis Approach", subsections: [] },
        ]},
        { level: 1, title: "Results", subsections: [
          { level: 2, title: "Key Findings", subsections: [] },
          { level: 2, title: "Data Analysis", subsections: [] },
        ]},
        { level: 1, title: "Discussion", subsections: [
          { level: 2, title: "Interpretation of Results", subsections: [] },
          { level: 2, title: "Implications", subsections: [] },
          { level: 2, title: "Limitations", subsections: [] },
        ]},
        { level: 1, title: "Conclusion", subsections: [
          { level: 2, title: "Summary of Findings", subsections: [] },
          { level: 2, title: "Future Research Directions", subsections: [] },
        ]},
      ]
    };
  }

  res.json(GenerateOutlineResponse.parse(outlineData));
});

export default router;
