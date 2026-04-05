import { useRef, useEffect, useState, useCallback } from "react";

const PAGE_WIDTH = 816;
const PAGE_HEIGHT = 1056;
const PAGE_PADDING = 96;
const CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_PADDING * 2;

interface PaperViewProps {
  content: string;
}

interface Page {
  html: string;
  pageNumber: number;
}

function parseContentToHtmlBlocks(content: string): string[] {
  const blocks = content.split(/\n\n+/);
  const htmlBlocks: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (
      trimmed.toLowerCase() === "[page-break]" ||
      trimmed.toLowerCase() === "[page break]"
    ) {
      htmlBlocks.push('<div data-type="page-break"></div>');
      continue;
    }

    const lines = trimmed.split(/\n/);
    const headingMatch = lines[0].match(/^(#{1,3})\s+(.+)$/);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = escapeHtml(headingMatch[2]);
      const rest = lines.slice(1).join("\n");
      let html = `<h${level}>${text}</h${level}>`;
      if (rest) {
        html += paragraphToHtml(rest);
      }
      htmlBlocks.push(html);
    } else {
      htmlBlocks.push(paragraphToHtml(trimmed));
    }
  }

  return htmlBlocks;
}

function paragraphToHtml(text: string): string {
  const escaped = escapeHtml(text);
  const processed = escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br/>");
  return `<p>${processed}</p>`;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function paginateHtmlBlocks(blocks: string[], containerWidth: number): Page[] {
  const pages: Page[] = [];
  let currentPageHtml = "";
  let currentPageHeight = 0;
  let pageNumber = 1;

  const measurer = createMeasurer(containerWidth);

  for (const block of blocks) {
    if (block.includes('data-type="page-break"')) {
      if (currentPageHtml) {
        pages.push({ html: currentPageHtml, pageNumber: pageNumber++ });
        currentPageHtml = "";
        currentPageHeight = 0;
      }
      continue;
    }

    const blockHeight = measureHtmlHeight(block, measurer);

    if (blockHeight > CONTENT_HEIGHT) {
      if (currentPageHtml) {
        pages.push({ html: currentPageHtml, pageNumber: pageNumber++ });
        currentPageHtml = "";
        currentPageHeight = 0;
      }

      const splitBlocks = splitBlockByHeight(block, CONTENT_HEIGHT, measurer);
      for (const splitBlock of splitBlocks) {
        const splitHeight = measureHtmlHeight(splitBlock, measurer);
        if (currentPageHeight + splitHeight > CONTENT_HEIGHT) {
          if (currentPageHtml) {
            pages.push({ html: currentPageHtml, pageNumber: pageNumber++ });
            currentPageHtml = "";
            currentPageHeight = 0;
          }
          currentPageHtml = splitBlock;
          currentPageHeight = splitHeight;
        } else {
          currentPageHtml = currentPageHtml
            ? currentPageHtml + splitBlock
            : splitBlock;
          currentPageHeight += splitHeight;
        }
      }
    } else if (currentPageHeight + blockHeight > CONTENT_HEIGHT) {
      if (currentPageHtml) {
        pages.push({ html: currentPageHtml, pageNumber: pageNumber++ });
      }
      currentPageHtml = block;
      currentPageHeight = blockHeight;
    } else {
      currentPageHtml = currentPageHtml ? currentPageHtml + block : block;
      currentPageHeight += blockHeight;
    }
  }

  if (currentPageHtml) {
    pages.push({ html: currentPageHtml, pageNumber: pageNumber++ });
  }

  if (pages.length === 0) {
    pages.push({ html: "", pageNumber: 1 });
  }

  removeMeasurer(measurer);
  return pages;
}

function splitBlockByHeight(
  html: string,
  maxHeight: number,
  measurer: HTMLDivElement,
): string[] {
  const parts: string[] = [];

  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;
  const paragraphs = tempDiv.querySelectorAll("p, h1, h2, h3, h4, h5, h6");

  if (paragraphs.length === 0) {
    return [html];
  }

  let currentHtml = "";
  let currentHeight = 0;

  for (const p of Array.from(paragraphs)) {
    const tag = p.tagName.toLowerCase();
    const text = p.textContent || "";
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    let sentenceBuffer = "";

    for (const sentence of sentences) {
      const testSentence = sentenceBuffer
        ? sentenceBuffer + " " + sentence
        : sentence;
      const testHtml = currentHtml + `<${tag}>${testSentence}</${tag}>`;
      const testHeight = measureHtmlHeight(testHtml, measurer);

      if (testHeight > maxHeight && sentenceBuffer) {
        parts.push(currentHtml + `<${tag}>${sentenceBuffer}</${tag}>`);
        currentHtml = "";
        currentHeight = 0;
        sentenceBuffer = sentence;
      } else {
        sentenceBuffer = testSentence;
      }
    }

    if (sentenceBuffer) {
      const testHtml = currentHtml + `<${tag}>${sentenceBuffer}</${tag}>`;
      const testHeight = measureHtmlHeight(testHtml, measurer);

      if (testHeight > maxHeight && currentHtml) {
        parts.push(currentHtml);
        currentHtml = `<${tag}>${sentenceBuffer}</${tag}>`;
        currentHeight = testHeight;
      } else {
        currentHtml = testHtml;
        currentHeight = testHeight;
      }
      sentenceBuffer = "";
    }
  }

  if (currentHtml) {
    parts.push(currentHtml);
  }

  return parts.length > 0 ? parts : [html];
}

function createMeasurer(width: number): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `
    width: ${width}px;
    padding: 0;
    font-family: Georgia, serif;
    font-size: 1rem;
    line-height: 1.75;
    position: absolute;
    visibility: hidden;
    pointer-events: none;
    top: -9999px;
    left: -9999px;
  `;
  document.body.appendChild(el);
  return el;
}

function removeMeasurer(measurer: HTMLDivElement) {
  if (measurer.parentNode) {
    document.body.removeChild(measurer);
  }
}

function measureHtmlHeight(html: string, measurer: HTMLDivElement): number {
  measurer.innerHTML = html;
  return measurer.offsetHeight;
}

export default function PaperView({ content }: PaperViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [contentWidth, setContentWidth] = useState(
    PAGE_WIDTH - PAGE_PADDING * 2,
  );

  const paginate = useCallback(() => {
    const blocks = parseContentToHtmlBlocks(content);
    const result = paginateHtmlBlocks(blocks, contentWidth);
    setPages(result);
  }, [content, contentWidth]);

  useEffect(() => {
    paginate();
  }, [paginate]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const availableWidth = containerRef.current.clientWidth - 64;
        setContentWidth(
          Math.min(availableWidth, PAGE_WIDTH - PAGE_PADDING * 2),
        );
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div ref={containerRef} className="pages-container">
      <div className="paper-view">
        {pages.map((page) => (
          <div key={page.pageNumber} className="paper-page">
            <div
              className="paper-content"
              dangerouslySetInnerHTML={{ __html: page.html }}
            />
            <div className="page-number">Page {page.pageNumber}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
