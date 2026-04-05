import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, forwardRef, useImperativeHandle } from "react";

export type FormatAction =
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

export type ViewMode = "prose" | "paper" | "full";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string, text: string) => void;
  placeholder?: string;
  viewMode?: ViewMode;
  editorRef?: React.RefObject<{
    getSelectedText: () => string;
    getSelectionRange: () => { from: number; to: number };
    insertText: (text: string) => void;
    getPlainText: () => string;
  } | null>;
}

const RichTextEditor = forwardRef<
  {
    getSelectedText: () => string;
    getSelectionRange: () => { from: number; to: number };
    insertText: (text: string) => void;
    getPlainText: () => string;
  },
  RichTextEditorProps
>(
  (
    {
      content,
      onChange,
      placeholder = "Start writing your document...",
      viewMode = "prose",
    },
    ref,
  ) => {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          bulletList: {},
          orderedList: {},
          blockquote: {},
          bold: {},
          italic: {},
          underline: false,
        }),
        Underline,
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Placeholder.configure({ placeholder }),
      ],
      content,
      editorProps: {
        attributes: {
          class:
            viewMode === "prose"
              ? "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-full font-serif text-base leading-relaxed p-6"
              : viewMode === "paper"
                ? "paper-view max-w-[816px] mx-auto focus:outline-none min-h-[1056px] font-serif text-base leading-relaxed px-[96px] py-[96px] shadow-[0_0_20px_rgba(0,0,0,0.15)] rounded-sm"
                : "max-w-none focus:outline-none min-h-full font-serif text-base leading-relaxed p-6",
        },
      },
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML(), editor.getText());
      },
    });

    useImperativeHandle(ref, () => ({
      getSelectedText: () => {
        if (!editor) return "";
        const { from, to, empty } = editor.state.selection;
        if (empty) return "";
        return editor.state.doc.textBetween(from, to, " ");
      },
      getSelectionRange: () => {
        if (!editor) return { from: 0, to: 0 };
        const { from, to } = editor.state.selection;
        return { from, to };
      },
      insertText: (text: string) => {
        if (!editor) return;
        editor.commands.insertContent(text);
      },
      getPlainText: () => {
        if (!editor) return "";
        return editor.getText();
      },
    }));

    useEffect(() => {
      if (editor && content !== editor.getHTML()) {
        editor.commands.setContent(content);
      }
    }, [content, editor]);

    if (!editor) return null;

    return (
      <div
        className={`h-full overflow-y-auto ${viewMode === "paper" ? "bg-gray-200" : "bg-background"}`}
      >
        <div className={viewMode === "paper" ? "py-8" : ""}>
          <EditorContent editor={editor} className="" />
        </div>
      </div>
    );
  },
);

RichTextEditor.displayName = "RichTextEditor";

export default RichTextEditor;
