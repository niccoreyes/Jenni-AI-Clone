import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useCompletion } from "@ai-sdk/react";
import { motion, AnimatePresence } from "framer-motion";
import { PanelRight, MessageSquare, FileText, List, Quote } from "lucide-react";
import {
  useGetDocument,
  getGetDocumentQueryKey,
  useUpdateDocument,
  useParaphrase,
  useAiChat,
  useGenerateOutline,
  useListCitations,
  getListCitationsQueryKey,
  useCreateCitation,
  useDeleteCitation,
  useListPdfs,
  getListPdfsQueryKey,
  useDeletePdf,
  getGetDocumentStatsQueryKey,
  getListDocumentsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import AiChatPanel from "@/components/AiChatPanel";

type SidebarTab = "chat" | "citations" | "pdfs" | "outline";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface OutlineSection {
  level: number;
  title: string;
  subsections: OutlineSection[];
}

export default function Editor() {
  const params = useParams<{ id: string }>();
  const docId = parseInt(params.id ?? "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [citationStyle, setCitationStyle] = useState<
    "APA7" | "MLA9" | "Chicago17" | "IEEE" | "Harvard"
  >("APA7");
  const [activeTab, setActiveTab] = useState<SidebarTab>("chat");
  const [ghostText, setGhostText] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [outlineResult, setOutlineResult] = useState<OutlineSection[]>([]);
  const [outlineTopic, setOutlineTopic] = useState("");
  const [outlineThesis, setOutlineThesis] = useState("");
  const [outlineDocType, setOutlineDocType] = useState("research_paper");
  const [paraphraseOpen, setParaphraseOpen] = useState(false);
  const [paraphraseResult, setParaphraseResult] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [addCitationOpen, setAddCitationOpen] = useState(false);
  const [citationForm, setCitationForm] = useState({
    author: "",
    year: "",
    title: "",
    journal: "",
    doi: "",
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef(content);
  const [ghostPosition, setGhostPosition] = useState(0);
  const hasInitializedRef = useRef<number | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollThrottleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Throttled scroll handler to sync textarea with ghost text overlay
  const handleScroll = useCallback(() => {
    if (scrollThrottleTimerRef.current) return;

    scrollThrottleTimerRef.current = setTimeout(() => {
      scrollThrottleTimerRef.current = null;
    }, 16); // ~60fps

    if (overlayRef.current && textareaRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Cleanup throttle timer on unmount
  useEffect(() => {
    return () => {
      if (scrollThrottleTimerRef.current) {
        clearTimeout(scrollThrottleTimerRef.current);
      }
    };
  }, []);

  // Reset initialization flag when document ID changes
  useEffect(() => {
    hasInitializedRef.current = null;
    setContent("");
    setTitle("");
    setGhostText("");
  }, [docId]);

  const { data: doc, isLoading } = useGetDocument(docId, {
    query: { enabled: !!docId, queryKey: getGetDocumentQueryKey(docId) },
  });

  const { data: citations } = useListCitations(
    { documentId: docId },
    {
      query: {
        enabled: !!docId,
        queryKey: getListCitationsQueryKey({ documentId: docId }),
      },
    },
  );

  const { data: pdfs } = useListPdfs({
    query: { queryKey: getListPdfsQueryKey() },
  });

  useEffect(() => {
    if (doc && !hasInitializedRef.current) {
      setContent(doc.content);
      setTitle(doc.title);
      setCitationStyle(
        doc.citationStyle as "APA7" | "MLA9" | "Chicago17" | "IEEE" | "Harvard",
      );
      hasInitializedRef.current = docId;
    }
  }, [doc, docId]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const updateDocument = useUpdateDocument({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getGetDocumentQueryKey(docId),
        });
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        queryClient.invalidateQueries({
          queryKey: getGetDocumentStatsQueryKey(),
        });
      },
    },
  });

  // Streaming autocomplete using Vercel AI SDK
  const {
    completion: autocompleteText,
    complete: triggerAutocomplete,
    isLoading: isAutocompleteLoading,
    stop: stopAutocomplete,
    error: autocompleteError,
  } = useCompletion({
    api: `/api/ai/autocomplete/stream`,
    streamProtocol: "text",
    onFinish: () => {
      // Completion finished - ghost text is already set via useEffect
    },
    onError: (error) => {
      console.error("Autocomplete error:", error);
      const errorMessage = error?.message || "Unknown error";
      if (errorMessage.includes("rate limit")) {
        toast({
          title: "Rate limit exceeded",
          description: "Please wait a moment before trying again",
          variant: "destructive",
        });
      } else if (errorMessage.includes("authentication")) {
        toast({
          title: "Authentication failed",
          description: "Please check your API key in Settings",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Autocomplete failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });

  // Sync streaming completion to ghost text state
  useEffect(() => {
    if (autocompleteText && autocompleteText.length > 0) {
      const suggestion = autocompleteText.replace(/\s+/g, " ");
      const normalizedSuggestion = suggestion.startsWith(" ")
        ? suggestion
        : " " + suggestion;
      setGhostText(normalizedSuggestion);
    }
  }, [autocompleteText]);

  const paraphrase = useParaphrase();
  const aiChat = useAiChat();
  const generateOutline = useGenerateOutline();
  const createCitation = useCreateCitation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getListCitationsQueryKey({ documentId: docId }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetDocumentStatsQueryKey(),
        });
        setAddCitationOpen(false);
        setCitationForm({
          author: "",
          year: "",
          title: "",
          journal: "",
          doi: "",
        });
        toast({ title: "Citation added" });
      },
    },
  });
  const deleteCitation = useDeleteCitation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getListCitationsQueryKey({ documentId: docId }),
        });
        queryClient.invalidateQueries({
          queryKey: getGetDocumentStatsQueryKey(),
        });
      },
    },
  });
  const deletePdf = useDeletePdf({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPdfsQueryKey() });
        queryClient.invalidateQueries({
          queryKey: getGetDocumentStatsQueryKey(),
        });
      },
    },
  });

  const wordCount = content.split(/\s+/).filter(Boolean).length;

  const scheduleSave = useCallback(
    (newContent: string, newTitle: string, newStyle: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateDocument.mutate({
          id: docId,
          data: {
            content: newContent,
            title: newTitle,
            citationStyle: newStyle as
              | "APA7"
              | "MLA9"
              | "Chicago17"
              | "IEEE"
              | "Harvard",
          },
        });
      }, 2000);
    },
    [docId, updateDocument],
  );

  const handleContentChange = (val: string) => {
    setContent(val);
    setGhostText("");
    scheduleSave(val, title, citationStyle);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    scheduleSave(content, val, citationStyle);
  };

  const handleStyleChange = (val: string) => {
    setCitationStyle(val as "APA7" | "MLA9" | "Chicago17" | "IEEE" | "Harvard");
    scheduleSave(content, title, val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab" && ghostText) {
      e.preventDefault();
      // Stop streaming if still in progress
      if (isAutocompleteLoading) {
        stopAutocomplete();
      }
      // Insert ghost text at the stored position, not at the end
      const before = content.slice(0, ghostPosition);
      const after = content.slice(ghostPosition);
      const newContent = before + ghostText + after;
      setContent(newContent);
      setGhostText("");
      scheduleSave(newContent, title, citationStyle);
      return;
    }
    if (e.key === "Escape" && (ghostText || isAutocompleteLoading)) {
      // Stop streaming and clear suggestion
      if (isAutocompleteLoading) {
        stopAutocomplete();
      }
      setGhostText("");
      return;
    }
    if (e.ctrlKey && e.key === "j") {
      e.preventDefault();

      // Prevent multiple simultaneous autocomplete requests
      if (isAutocompleteLoading) {
        return;
      }

      // Clear any existing ghost text and capture cursor position
      setGhostText("");
      const cursorPos = e.currentTarget.selectionStart;
      setGhostPosition(cursorPos);

      // Use contentRef.current to get the latest content (not stale closure)
      const currentContent = contentRef.current;

      // Trigger streaming autocomplete
      triggerAutocomplete(currentContent, {
        body: {
          currentText: currentContent,
          documentId: docId,
          citationStyle,
        },
      });
    }
  };

  const handleTextSelect = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start !== end) {
      setSelectedText(content.slice(start, end));
      setSelectionStart(start);
      setSelectionEnd(end);
    }
  };

  const handleParaphrase = (mode: string) => {
    if (!selectedText) return;
    paraphrase.mutate(
      {
        data: {
          text: selectedText,
          mode: mode as
            | "simplify"
            | "academic"
            | "expand"
            | "shorten"
            | "active"
            | "passive",
          documentId: docId,
        },
      },
      {
        onSuccess: (result) => {
          setParaphraseResult(result.result);
          setParaphraseOpen(true);
        },
        onError: () => {
          toast({ title: "Paraphrase failed", variant: "destructive" });
        },
      },
    );
  };

  const applyParaphrase = () => {
    const newContent =
      content.slice(0, selectionStart) +
      paraphraseResult +
      content.slice(selectionEnd);
    setContent(newContent);
    setParaphraseOpen(false);
    setParaphraseResult("");
    setSelectedText("");
    scheduleSave(newContent, title, citationStyle);
  };

  const handleGenerateOutline = () => {
    if (!outlineTopic || !outlineThesis) return;
    generateOutline.mutate(
      {
        data: {
          topic: outlineTopic,
          thesis: outlineThesis,
          documentType: outlineDocType as
            | "research_paper"
            | "essay"
            | "literature_review"
            | "thesis"
            | "report",
        },
      },
      {
        onSuccess: (result) => {
          setOutlineResult(result.outline);
        },
        onError: () => {
          toast({ title: "Outline generation failed", variant: "destructive" });
        },
      },
    );
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/pdfs/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      queryClient.invalidateQueries({ queryKey: getListPdfsQueryKey() });
      queryClient.invalidateQueries({
        queryKey: getGetDocumentStatsQueryKey(),
      });
      toast({ title: "PDF uploaded" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    e.target.value = "";
  };

  const addCitation = () => {
    if (!citationForm.author || !citationForm.title) return;
    createCitation.mutate({
      data: {
        documentId: docId,
        author: citationForm.author,
        year: citationForm.year || null,
        title: citationForm.title,
        journal: citationForm.journal || null,
        doi: citationForm.doi || null,
        citationStyle,
      },
    });
  };

  const renderOutline = (
    sections: OutlineSection[],
    depth = 0,
  ): React.ReactNode => (
    <ul className={depth === 0 ? "space-y-1" : "mt-1 ml-4 space-y-1"}>
      {sections.map((s, i) => (
        <li key={i}>
          <span
            className={`text-sm ${depth === 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}
          >
            {s.title}
          </span>
          {s.subsections.length > 0 && renderOutline(s.subsections, depth + 1)}
        </li>
      ))}
    </ul>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading document...</div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-3">Document not found</p>
          <Button onClick={() => setLocation("/")} size="sm">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <header className="border-b border-border bg-card px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          Back
        </Button>
        <div className="w-px h-4 bg-border" />
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="flex-1 bg-transparent text-sm font-medium text-foreground outline-none border-none focus:ring-0 min-w-0"
          data-testid="input-doc-title"
        />
        <div className="flex items-center gap-2 ml-auto">
          <Select value={citationStyle} onValueChange={handleStyleChange}>
            <SelectTrigger
              className="h-7 text-xs w-32"
              data-testid="select-editor-citation-style"
            >
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
          <span className="text-xs text-muted-foreground">
            {updateDocument.isPending ? "Saving..." : "Saved"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            data-testid="button-toggle-sidebar"
          >
            <PanelRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedText && (
            <div className="border-b border-border bg-muted/50 px-4 py-2 flex items-center gap-1 flex-shrink-0">
              <span className="text-xs text-muted-foreground mr-2">
                Rewrite:
              </span>
              {["simplify", "academic", "expand", "shorten", "active"].map(
                (mode) => (
                  <Button
                    key={mode}
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs capitalize"
                    onClick={() => handleParaphrase(mode)}
                    disabled={paraphrase.isPending}
                    data-testid={`button-paraphrase-${mode}`}
                  >
                    {mode}
                  </Button>
                ),
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs ml-auto"
                onClick={() => setSelectedText("")}
              >
                Dismiss
              </Button>
            </div>
          )}

          <div className="relative flex-1 overflow-hidden">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onMouseUp={handleTextSelect}
              onKeyUp={handleTextSelect}
              onScroll={handleScroll}
              placeholder="Start writing your document... Press Ctrl+J for AI autocomplete"
              className="absolute inset-0 resize-none border-0 rounded-none bg-background font-serif text-base leading-relaxed text-foreground p-6 focus-visible:ring-0 focus-visible:outline-none"
              style={{
                fontFamily: "Georgia, serif",
                fontSize: "1rem",
                lineHeight: "1.625",
              }}
              data-testid="textarea-editor"
            />
            <AnimatePresence>
              {ghostText && (
                <motion.div
                  ref={overlayRef}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute inset-0 pointer-events-none overflow-hidden"
                  style={{
                    fontFamily: "Georgia, serif",
                    fontSize: "1rem",
                    lineHeight: "1.625",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    padding: "24px",
                    color: "transparent",
                  }}
                >
                  <span>{content.slice(0, ghostPosition)}</span>
                  <span
                    style={{
                      color: "hsl(var(--muted-foreground) / 0.5)",
                      fontStyle: "italic",
                    }}
                  >
                    {ghostText}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {(ghostText || isAutocompleteLoading) && (
            <div className="border-t border-border bg-muted/30 px-4 py-2 flex-shrink-0">
              <div className="flex items-center gap-2 mb-1">
                {ghostText ? (
                  <>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      AI suggestion:
                    </span>
                    <kbd className="text-xs bg-background border border-border rounded px-1.5 py-0.5 font-mono">
                      Tab
                    </kbd>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      to accept,
                    </span>
                    <kbd className="text-xs bg-background border border-border rounded px-1.5 py-0.5 font-mono">
                      Esc
                    </kbd>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      to dismiss
                    </span>
                    {isAutocompleteLoading && (
                      <span className="inline-block w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin ml-auto" />
                    )}
                  </>
                ) : (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                    <span className="text-xs text-muted-foreground">
                      Generating suggestion...
                    </span>
                  </>
                )}
              </div>
              {ghostText && (
                <div className="text-xs italic text-muted-foreground/70 bg-background/50 rounded px-2 py-1.5 border border-border/50">
                  {ghostText.trim()}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-border bg-card px-4 py-1.5 flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
            <span data-testid="text-word-count">
              {wordCount.toLocaleString()} words
            </span>
            {doc.targetWordCount && (
              <>
                <span>/ {doc.targetWordCount.toLocaleString()} target</span>
                <div className="flex-1 max-w-32">
                  <Progress
                    value={Math.min(
                      100,
                      (wordCount / doc.targetWordCount) * 100,
                    )}
                    className="h-1"
                  />
                </div>
              </>
            )}
            <span className="ml-auto">Ctrl+J for autocomplete</span>
          </div>
        </div>

        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="h-full flex flex-col overflow-hidden shrink-0 border-l border-border bg-card"
            >
              {/* Tab bar */}
              <div className="flex items-center border-b border-border">
                {[
                  {
                    id: "chat" as const,
                    icon: MessageSquare,
                    label: "AI Chat",
                  },
                  { id: "citations" as const, icon: Quote, label: "Citations" },
                  { id: "pdfs" as const, icon: FileText, label: "PDFs" },
                  { id: "outline" as const, icon: List, label: "Outline" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                      activeTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`tab-${tab.id}`}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto">
                {activeTab === "chat" && (
                  <AiChatPanel
                    messages={chatMessages}
                    onSendMessage={(msg) => {
                      const userMsg: ChatMessage = {
                        role: "user",
                        content: msg,
                      };
                      setChatMessages((prev) => [...prev, userMsg]);
                      const context = content.slice(-500);
                      aiChat.mutate(
                        {
                          data: {
                            message: msg,
                            documentId: docId,
                            documentContext: context,
                            history: chatMessages.slice(-6),
                          },
                        },
                        {
                          onSuccess: (result) => {
                            setChatMessages((prev) => [
                              ...prev,
                              { role: "assistant", content: result.response },
                            ]);
                          },
                          onError: () => {
                            setChatMessages((prev) => [
                              ...prev,
                              {
                                role: "assistant",
                                content:
                                  "Failed to get response. Please check your API key in Settings.",
                              },
                            ]);
                          },
                        },
                      );
                    }}
                    isTyping={aiChat.isPending}
                  />
                )}

                {activeTab === "citations" && (
                  <div className="p-3 space-y-3">
                    <Button
                      size="sm"
                      className="w-full text-xs h-8"
                      onClick={() => setAddCitationOpen(true)}
                      data-testid="button-add-citation"
                    >
                      Add Citation
                    </Button>
                    {citations?.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No citations yet.
                      </p>
                    )}
                    {citations?.map((cit) => (
                      <div
                        key={cit.id}
                        className="border border-border rounded-lg p-2.5 group"
                        data-testid={`citation-${cit.id}`}
                      >
                        <p className="text-xs font-medium text-foreground">
                          {cit.author}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {cit.title}
                        </p>
                        {cit.year && (
                          <p className="text-xs text-muted-foreground">
                            {cit.year}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-xs text-primary">
                            {cit.citationStyle}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1 text-xs text-destructive opacity-0 group-hover:opacity-100"
                            onClick={() =>
                              deleteCitation.mutate({ id: cit.id })
                            }
                            data-testid={`button-delete-citation-${cit.id}`}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "pdfs" && (
                  <div className="p-3 space-y-3">
                    <label className="block" data-testid="button-upload-pdf">
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={handlePdfUpload}
                      />
                      <span className="flex w-full items-center justify-center h-8 rounded-md border border-border bg-secondary text-secondary-foreground text-xs font-medium cursor-pointer hover:bg-secondary/80 transition-colors">
                        Upload PDF
                      </span>
                    </label>
                    {pdfs?.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No PDFs uploaded yet.
                      </p>
                    )}
                    {pdfs?.map((pdf) => (
                      <div
                        key={pdf.id}
                        className="border border-border rounded-lg p-2.5 group"
                        data-testid={`pdf-${pdf.id}`}
                      >
                        <p className="text-xs font-medium text-foreground truncate">
                          {pdf.originalName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(pdf.uploadedAt).toLocaleDateString()}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1 text-xs text-destructive opacity-0 group-hover:opacity-100 mt-1"
                          onClick={() => deletePdf.mutate({ id: pdf.id })}
                          data-testid={`button-delete-pdf-${pdf.id}`}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "outline" && (
                  <div className="p-3 space-y-3">
                    <div className="space-y-2">
                      <Input
                        placeholder="Research topic"
                        value={outlineTopic}
                        onChange={(e) => setOutlineTopic(e.target.value)}
                        className="text-xs h-8"
                        data-testid="input-outline-topic"
                      />
                      <Textarea
                        placeholder="Thesis statement"
                        value={outlineThesis}
                        onChange={(e) => setOutlineThesis(e.target.value)}
                        className="text-xs min-h-16 resize-none"
                        data-testid="input-outline-thesis"
                      />
                      <Select
                        value={outlineDocType}
                        onValueChange={setOutlineDocType}
                      >
                        <SelectTrigger
                          className="h-8 text-xs"
                          data-testid="select-outline-doc-type"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="research_paper">
                            Research Paper
                          </SelectItem>
                          <SelectItem value="essay">Essay</SelectItem>
                          <SelectItem value="literature_review">
                            Literature Review
                          </SelectItem>
                          <SelectItem value="thesis">Thesis</SelectItem>
                          <SelectItem value="report">Report</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="w-full text-xs h-8"
                        onClick={handleGenerateOutline}
                        disabled={
                          generateOutline.isPending ||
                          !outlineTopic ||
                          !outlineThesis
                        }
                        data-testid="button-generate-outline"
                      >
                        {generateOutline.isPending
                          ? "Generating..."
                          : "Generate Outline"}
                      </Button>
                    </div>
                    {outlineResult.length > 0 && (
                      <div className="border border-border rounded-lg p-3">
                        {renderOutline(outlineResult)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Dialog open={paraphraseOpen} onOpenChange={setParaphraseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paraphrased Text</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Original
              </p>
              <p className="text-sm text-muted-foreground bg-muted rounded p-2">
                {selectedText}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Rewritten
              </p>
              <Textarea
                value={paraphraseResult}
                onChange={(e) => setParaphraseResult(e.target.value)}
                className="text-sm min-h-24"
                data-testid="textarea-paraphrase-result"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setParaphraseOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={applyParaphrase}
              data-testid="button-apply-paraphrase"
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addCitationOpen} onOpenChange={setAddCitationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Citation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Author *</Label>
                <Input
                  value={citationForm.author}
                  onChange={(e) =>
                    setCitationForm((f) => ({ ...f, author: e.target.value }))
                  }
                  placeholder="Smith, J."
                  className="text-sm h-8"
                  data-testid="input-citation-author"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Year</Label>
                <Input
                  value={citationForm.year}
                  onChange={(e) =>
                    setCitationForm((f) => ({ ...f, year: e.target.value }))
                  }
                  placeholder="2024"
                  className="text-sm h-8"
                  data-testid="input-citation-year"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Title *</Label>
              <Input
                value={citationForm.title}
                onChange={(e) =>
                  setCitationForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Article or book title"
                className="text-sm h-8"
                data-testid="input-citation-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Journal</Label>
                <Input
                  value={citationForm.journal}
                  onChange={(e) =>
                    setCitationForm((f) => ({ ...f, journal: e.target.value }))
                  }
                  placeholder="Journal name"
                  className="text-sm h-8"
                  data-testid="input-citation-journal"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">DOI</Label>
                <Input
                  value={citationForm.doi}
                  onChange={(e) =>
                    setCitationForm((f) => ({ ...f, doi: e.target.value }))
                  }
                  placeholder="10.1000/xyz"
                  className="text-sm h-8"
                  data-testid="input-citation-doi"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCitationOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={addCitation}
              disabled={
                !citationForm.author ||
                !citationForm.title ||
                createCitation.isPending
              }
              data-testid="button-save-citation"
            >
              {createCitation.isPending ? "Adding..." : "Add Citation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
