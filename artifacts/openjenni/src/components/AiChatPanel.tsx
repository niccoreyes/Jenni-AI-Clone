import { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  BookOpen,
  FileText,
  Lightbulb,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "../pages/Editor";

interface AiChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isTyping: boolean;
}

const QUICK_ACTIONS = [
  {
    icon: BookOpen,
    label: "Summarize",
    prompt: "Summarize the key findings from my document",
  },
  {
    icon: ListChecks,
    label: "Find gaps",
    prompt: "Identify gaps in my literature review",
  },
  {
    icon: Lightbulb,
    label: "Suggest sources",
    prompt: "Suggest additional sources for my argument",
  },
  {
    icon: FileText,
    label: "Check claims",
    prompt: "Flag any unsupported claims in my current text",
  },
];

export default function AiChatPanel({
  messages,
  onSendMessage,
  isTyping,
}: AiChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const handleQuickAction = (prompt: string) => {
    onSendMessage(prompt);
  };

  const lastMessage = messages[messages.length - 1];
  const hasStreamingAssistant =
    isTyping && lastMessage?.role === "assistant" && lastMessage.content;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <h3 className="text-sm font-semibold text-foreground">
            Research Assistant
          </h3>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Context-aware AI chat
        </p>
      </div>

      {/* Quick Actions */}
      <div className="px-3 py-2 border-b border-border flex flex-wrap gap-1.5 bg-muted/20">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => handleQuickAction(action.prompt)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                       bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <action.icon className="h-3 w-3" />
            {action.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        <AnimatePresence mode="popLayout">
          {messages.length === 0 && !isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-muted-foreground text-center py-8"
            >
              Ask anything about your document or research topic.
            </motion.div>
          )}
          {messages.map((msg, i) => {
            const isLastAssistant =
              i === messages.length - 1 && msg.role === "assistant";
            const isStreaming = isLastAssistant && isTyping;
            return (
              <motion.div
                key={`${msg.role}-${i}`}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
                      : "bg-muted text-foreground rounded-2xl rounded-bl-sm border border-border"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                        components={{
                          p: ({ children }: { children?: React.ReactNode }) => (
                            <p className="mb-2 last:mb-0">{children}</p>
                          ),
                          ul: ({
                            children,
                          }: {
                            children?: React.ReactNode;
                          }) => (
                            <ul className="list-disc pl-4 mb-2 last:mb-0">
                              {children}
                            </ul>
                          ),
                          ol: ({
                            children,
                          }: {
                            children?: React.ReactNode;
                          }) => (
                            <ol className="list-decimal pl-4 mb-2 last:mb-0">
                              {children}
                            </ol>
                          ),
                          li: ({
                            children,
                          }: {
                            children?: React.ReactNode;
                          }) => <li className="mb-1 last:mb-0">{children}</li>,
                          strong: ({
                            children,
                          }: {
                            children?: React.ReactNode;
                          }) => (
                            <strong className="font-semibold">
                              {children}
                            </strong>
                          ),
                          code: ({
                            children,
                          }: {
                            children?: React.ReactNode;
                          }) => (
                            <code className="bg-muted-foreground/20 px-1 py-0.5 rounded text-xs">
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                      {isStreaming && (
                        <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary/60 animate-pulse align-middle" />
                      )}
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {isTyping && !hasStreamingAssistant && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5 border border-border">
              <span
                className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-border bg-card">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-primary/50 transition-shadow">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask about your research..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-primary hover:text-primary hover:bg-primary/10"
            onClick={handleSend}
            disabled={!input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
