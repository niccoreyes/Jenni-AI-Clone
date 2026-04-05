import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSettings,
  getGetSettingsQueryKey,
  useUpdateSettings,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const PROVIDER_MODELS: Record<string, string[]> = {
  openai: [
    "gpt-5.2",
    "gpt-5",
    "gpt-5-mini",
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-3.5-turbo",
  ],
  anthropic: [
    "claude-sonnet-4-6-20250827",
    "claude-opus-4-6-20250826",
    "claude-haiku-4-5-20251001",
    "claude-3-5-sonnet-20241022",
    "claude-3-haiku-20240307",
    "claude-3-opus-20240229",
  ],
  moonshot: ["kimi-k2", "kimi-latest", "moonshot-v1-8k"],
  openrouter: [
    // Free models
    "qwen/qwen3.6-plus:free",
    "stepfun/step-3.5-flash:free",
    // Latest high-performance models
    "anthropic/claude-sonnet-4.6",
    "anthropic/claude-opus-4.6",
    "google/gemini-3-flash-preview",
    "deepseek/deepseek-v3.2",
    "xiaomi/mimo-v2-pro",
    "minimax/minimax-m2.7",
    "x-ai/grok-4.20",
    "x-ai/grok-4.20-multi-agent",
    "google/gemma-4-31b-it",
    "google/gemma-4-26b-a4b-it",
    "z-ai/glm-5v-turbo",
    "arcee-ai/trinity-large-thinking",
    // Popular existing models
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "anthropic/claude-3-haiku",
    "meta-llama/llama-3.1-405b-instruct",
    "google/gemini-pro-1.5",
  ],
  custom: ["custom-model"],
};

const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  moonshot: "https://api.moonshot.cn/v1",
  openrouter: "https://openrouter.ai/api/v1",
  ollama: "http://localhost:11434/v1",
  custom: "",
};

export default function Settings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showKey, setShowKey] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaModelsLoading, setOllamaModelsLoading] = useState(false);
  const [ollamaModelsError, setOllamaModelsError] = useState<string | null>(
    null,
  );

  const { data: settings, isLoading } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey() },
  });

  const [form, setForm] = useState({
    provider: "openai",
    apiKey: "",
    baseUrl: "",
    model: "gpt-5.2",
    defaultCitationStyle: "APA7",
    language: "en-US",
    userRole: "graduate",
    autocompleteEnabled: true,
    citationsEnabled: true,
    pdfChatEnabled: true,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        provider: settings.provider,
        apiKey: settings.apiKey ?? "",
        baseUrl: settings.baseUrl ?? "",
        model: settings.model,
        defaultCitationStyle: settings.defaultCitationStyle,
        language: settings.language,
        userRole: settings.userRole,
        autocompleteEnabled: settings.autocompleteEnabled,
        citationsEnabled: settings.citationsEnabled,
        pdfChatEnabled: settings.pdfChatEnabled,
      });
    }
  }, [settings]);

  const fetchOllamaModels = () => {
    setOllamaModelsLoading(true);
    setOllamaModelsError(null);
    const params = new URLSearchParams({
      provider: "ollama",
      baseUrl: form.baseUrl || "http://localhost:11434/v1",
    });
    fetch(`/api/ai/models?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch models");
        return r.json();
      })
      .then((data) => {
        const models = data.models ?? [];
        setOllamaModels(models);
        setOllamaModelsLoading(false);
        if (models.length > 0) {
          setForm((f) => ({
            ...f,
            model: models.includes(f.model) ? f.model : models[0],
          }));
        }
      })
      .catch(() => {
        setOllamaModelsError("Make sure Ollama is running on localhost:11434");
        setOllamaModels([]);
        setOllamaModelsLoading(false);
      });
  };

  useEffect(() => {
    if (form.provider === "ollama") {
      fetchOllamaModels();
    } else {
      setOllamaModels([]);
      setOllamaModelsError(null);
      setOllamaModelsLoading(false);
    }
  }, [form.provider]);

  const updateSettings = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: "Settings saved" });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to save settings",
          variant: "destructive",
        });
      },
    },
  });

  const handleProviderChange = (provider: string) => {
    const models = PROVIDER_MODELS[provider] ?? [];
    setForm((f) => ({
      ...f,
      provider,
      model: provider === "ollama" ? "" : (models[0] ?? ""),
      baseUrl: PROVIDER_ENDPOINTS[provider] ?? "",
    }));
  };

  const handleSave = () => {
    updateSettings.mutate({
      data: {
        provider: form.provider as
          | "openai"
          | "anthropic"
          | "moonshot"
          | "openrouter"
          | "ollama"
          | "custom",
        apiKey: form.apiKey || null,
        baseUrl: form.baseUrl || null,
        model: form.model,
        defaultCitationStyle: form.defaultCitationStyle as
          | "APA7"
          | "MLA9"
          | "Chicago17"
          | "IEEE"
          | "Harvard",
        language: form.language,
        userRole: form.userRole as
          | "undergraduate"
          | "graduate"
          | "phd"
          | "researcher"
          | "professional",
        autocompleteEnabled: form.autocompleteEnabled,
        citationsEnabled: form.citationsEnabled,
        pdfChatEnabled: form.pdfChatEnabled,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            data-testid="button-back-home"
          >
            Back
          </Button>
          <div className="w-px h-4 bg-border" />
          <h1 className="text-base font-semibold text-foreground">Settings</h1>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={updateSettings.isPending}
          data-testid="button-save-settings"
        >
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <section>
          <h2 className="text-base font-semibold text-foreground mb-1">
            AI Provider (BYOK)
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Connect your own API key to use AI features.
          </p>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select
                value={form.provider}
                onValueChange={handleProviderChange}
              >
                <SelectTrigger data-testid="select-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI (GPT-4)</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="moonshot">Moonshot AI (Kimi)</SelectItem>
                  <SelectItem value="openrouter">
                    OpenRouter (Multi-Provider)
                  </SelectItem>
                  <SelectItem value="ollama">Ollama (Local)</SelectItem>
                  <SelectItem value="custom">Custom Endpoint</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.provider !== "ollama" && (
              <div className="space-y-1.5">
                <Label htmlFor="api-key">API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="api-key"
                    type={showKey ? "text" : "password"}
                    placeholder="sk-..."
                    value={form.apiKey}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, apiKey: e.target.value }))
                    }
                    className="font-mono text-sm"
                    data-testid="input-api-key"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowKey((s) => !s)}
                    data-testid="button-toggle-key-visibility"
                  >
                    {showKey ? "Hide" : "Show"}
                  </Button>
                </div>
              </div>
            )}

            {(form.provider === "custom" || form.provider === "ollama") && (
              <div className="space-y-1.5">
                <Label htmlFor="base-url">Base URL</Label>
                <Input
                  id="base-url"
                  placeholder={
                    form.provider === "ollama"
                      ? "http://localhost:11434/v1"
                      : "https://api.example.com/v1"
                  }
                  value={form.baseUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, baseUrl: e.target.value }))
                  }
                  data-testid="input-base-url"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Model</Label>
                {form.provider === "ollama" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={fetchOllamaModels}
                    disabled={ollamaModelsLoading}
                  >
                    {ollamaModelsLoading ? "Refreshing..." : "Refresh Models"}
                  </Button>
                )}
              </div>
              <Select
                key={`model-select-${form.provider}-${ollamaModels.length}`}
                value={
                  form.provider === "ollama"
                    ? ollamaModels.length > 0
                      ? ollamaModels.includes(form.model)
                        ? form.model
                        : ollamaModels[0]
                      : ""
                    : form.model
                }
                onValueChange={(m) => setForm((f) => ({ ...f, model: m }))}
              >
                <SelectTrigger data-testid="select-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {form.provider === "ollama" ? (
                    ollamaModelsLoading ? (
                      <SelectItem value="loading" disabled>
                        Loading models...
                      </SelectItem>
                    ) : ollamaModelsError ? (
                      <SelectItem value="error" disabled>
                        {ollamaModelsError}
                      </SelectItem>
                    ) : ollamaModels.length > 0 ? (
                      ollamaModels.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No models found
                      </SelectItem>
                    )
                  ) : (
                    (PROVIDER_MODELS[form.provider] ?? ["custom-model"]).map(
                      (m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ),
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <div className="border-t border-border" />

        <section>
          <h2 className="text-base font-semibold text-foreground mb-4">
            Academic Preferences
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Default Citation Style</Label>
              <Select
                value={form.defaultCitationStyle}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, defaultCitationStyle: v }))
                }
              >
                <SelectTrigger data-testid="select-default-citation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APA7">APA 7th</SelectItem>
                  <SelectItem value="MLA9">MLA 9th</SelectItem>
                  <SelectItem value="Chicago17">Chicago 17th</SelectItem>
                  <SelectItem value="IEEE">IEEE</SelectItem>
                  <SelectItem value="Harvard">Harvard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Academic Role</Label>
              <Select
                value={form.userRole}
                onValueChange={(v) => setForm((f) => ({ ...f, userRole: v }))}
              >
                <SelectTrigger data-testid="select-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="undergraduate">Undergraduate</SelectItem>
                  <SelectItem value="graduate">Graduate Student</SelectItem>
                  <SelectItem value="phd">PhD Candidate</SelectItem>
                  <SelectItem value="researcher">Researcher</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <div className="border-t border-border" />

        <section>
          <h2 className="text-base font-semibold text-foreground mb-4">
            Features
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  AI Autocomplete
                </p>
                <p className="text-xs text-muted-foreground">
                  Press Ctrl+J to get AI writing suggestions
                </p>
              </div>
              <Switch
                checked={form.autocompleteEnabled}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, autocompleteEnabled: v }))
                }
                data-testid="toggle-autocomplete"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Citation Manager
                </p>
                <p className="text-xs text-muted-foreground">
                  Manage and format academic citations
                </p>
              </div>
              <Switch
                checked={form.citationsEnabled}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, citationsEnabled: v }))
                }
                data-testid="toggle-citations"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">PDF Chat</p>
                <p className="text-xs text-muted-foreground">
                  Upload and analyze research papers
                </p>
              </div>
              <Switch
                checked={form.pdfChatEnabled}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, pdfChatEnabled: v }))
                }
                data-testid="toggle-pdf-chat"
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
