import { useState } from "react";
import { MessageSquare, FileText, List, X, Quote } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage } from "../pages/Editor";

export type PanelTab = "chat" | "citations" | "pdfs" | "outline";

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  children: React.ReactNode;
}

const TABS: { id: PanelTab; icon: React.ElementType; label: string }[] = [
  { id: "chat", icon: MessageSquare, label: "AI Chat" },
  { id: "citations", icon: Quote, label: "Citations" },
  { id: "pdfs", icon: FileText, label: "PDFs" },
  { id: "outline", icon: List, label: "Outline" },
];

export default function RightSidebar({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  children,
}: RightSidebarProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="h-full flex flex-col overflow-hidden shrink-0 border-l border-border bg-card"
        >
          {/* Tab bar */}
          <div className="flex items-center border-b border-border">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
            <button
              onClick={onClose}
              className="px-2 py-2.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
