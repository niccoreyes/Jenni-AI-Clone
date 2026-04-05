import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  BookOpen,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const CITATION_STYLES = [
  { value: "APA7", label: "APA 7th" },
  { value: "MLA9", label: "MLA 9th" },
  { value: "Chicago17", label: "Chicago 17th" },
  { value: "IEEE", label: "IEEE" },
  { value: "Harvard", label: "Harvard" },
];

const PARAPHRASE_MODES = [
  { value: "simplify", label: "Simplify Language" },
  { value: "academic", label: "Make More Academic" },
  { value: "expand", label: "Expand Selection" },
  { value: "shorten", label: "Shorten Selection" },
  { value: "active", label: "Convert to Active Voice" },
];

type FormatAction =
  | "bold"
  | "italic"
  | "underline"
  | "h1"
  | "h2"
  | "h3"
  | "quote"
  | "ul"
  | "ol"
  | "alignLeft"
  | "alignCenter"
  | "alignRight"
  | "undo"
  | "redo";

interface EditorToolbarProps {
  citationStyle: string;
  onCitationStyleChange: (style: string) => void;
  wordCount: number;
  onAiCommand: (command: string) => void;
  onFormat: (action: FormatAction) => void;
}

const ToolbarButton = ({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={onClick}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export default function EditorToolbar({
  citationStyle,
  onCitationStyleChange,
  wordCount,
  onAiCommand,
  onFormat,
}: EditorToolbarProps) {
  const citationLabel =
    CITATION_STYLES.find((s) => s.value === citationStyle)?.label ??
    citationStyle;

  return (
    <div className="toolbar-surface flex items-center gap-1 px-4 py-2 sticky top-0 z-10">
      <ToolbarButton
        icon={Undo}
        label="Undo"
        onClick={() => onFormat("undo")}
      />
      <ToolbarButton
        icon={Redo}
        label="Redo"
        onClick={() => onFormat("redo")}
      />
      <Separator orientation="vertical" className="h-5 mx-1" />

      <ToolbarButton
        icon={Bold}
        label="Bold (Ctrl+B)"
        onClick={() => onFormat("bold")}
      />
      <ToolbarButton
        icon={Italic}
        label="Italic (Ctrl+I)"
        onClick={() => onFormat("italic")}
      />
      <ToolbarButton
        icon={Underline}
        label="Underline (Ctrl+U)"
        onClick={() => onFormat("underline")}
      />
      <Separator orientation="vertical" className="h-5 mx-1" />

      <ToolbarButton
        icon={Heading1}
        label="Heading 1"
        onClick={() => onFormat("h1")}
      />
      <ToolbarButton
        icon={Heading2}
        label="Heading 2"
        onClick={() => onFormat("h2")}
      />
      <ToolbarButton
        icon={Heading3}
        label="Heading 3"
        onClick={() => onFormat("h3")}
      />
      <Separator orientation="vertical" className="h-5 mx-1" />

      <ToolbarButton
        icon={Quote}
        label="Block Quote"
        onClick={() => onFormat("quote")}
      />
      <ToolbarButton
        icon={List}
        label="Bullet List"
        onClick={() => onFormat("ul")}
      />
      <ToolbarButton
        icon={ListOrdered}
        label="Numbered List"
        onClick={() => onFormat("ol")}
      />
      <Separator orientation="vertical" className="h-5 mx-1" />

      <ToolbarButton
        icon={AlignLeft}
        label="Align Left"
        onClick={() => onFormat("alignLeft")}
      />
      <ToolbarButton
        icon={AlignCenter}
        label="Align Center"
        onClick={() => onFormat("alignCenter")}
      />
      <ToolbarButton
        icon={AlignRight}
        label="Align Right"
        onClick={() => onFormat("alignRight")}
      />
      <Separator orientation="vertical" className="h-5 mx-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <BookOpen className="h-3.5 w-3.5" />
            {citationLabel}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {CITATION_STYLES.map((style) => (
            <DropdownMenuItem
              key={style.value}
              onClick={() => onCitationStyleChange(style.value)}
              className={citationStyle === style.value ? "bg-muted" : ""}
            >
              {style.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs font-medium text-accent hover:text-accent hover:bg-accent/10"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Tools
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {PARAPHRASE_MODES.map((mode) => (
            <DropdownMenuItem
              key={mode.value}
              onClick={() => onAiCommand(mode.value)}
            >
              {mode.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex-1" />

      <span className="text-xs text-muted-foreground tabular-nums">
        {wordCount.toLocaleString()} words
      </span>
    </div>
  );
}
