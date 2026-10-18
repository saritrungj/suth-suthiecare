import { decodeHTML } from "entities";
import { marked, Renderer } from "marked";

const blockRenderer = new Renderer();
blockRenderer.html = ({ text, block }) =>
  block ? marked.parseInline(text, { async: false }) : text;

// Legacy content can be escaped more than once by editors/translations.
export function decodeTextEntities(value) {
  let text = String(value ?? "");
  for (let pass = 0; pass < 4; pass++) {
    const decoded = decodeHTML(text);
    if (decoded === text) break;
    text = decoded;
  }
  return text.replace(/\u00a0/g, " ");
}

// This is an intermediate HTML representation. Rich-text callers must pass it
// through DOMPurify; plain-text callers never insert it into the DOM.
export function contentMarkup(value) {
  // A leading numeric comparison is content, rather than a Markdown quote.
  const text = decodeTextEntities(value).replace(
    /(^|\n)( {0,3})>(?=\s*[=+\-\d])/g,
    "$1$2&gt;",
  );
  const block =
    /(?:^|\n) {0,3}(?:#{1,6}\s|[-+*]\s|\d+[.)]\s|>(?!\s*[=+\-\d])\s|```|~~~)/.test(
      text,
    ) || /\|[^\n]*\n\s*\|?\s*:?-{3,}/.test(text);
  return block
    ? marked.parse(text, {
        async: false,
        breaks: true,
        renderer: blockRenderer,
      })
    : marked.parseInline(text, { async: false, breaks: true });
}

export function toDisplayText(value) {
  if (value == null) return "";
  const html = contentMarkup(value)
    .replace(
      /<(script|style|iframe|object)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,
      "",
    )
    .replace(/<!--[^]*?-->/g, "")
    .replace(
      /<\/?(?:p|div|li|ul|ol|br|h[1-6]|blockquote|tr|td|th|pre)\b[^>]*>/gi,
      " ",
    )
    .replace(/<\/?[a-z][a-z0-9:-]*(?:\s[^<>]*?)?\s*\/?>/gi, "");
  return decodeTextEntities(html).replace(/\s+/g, " ").trim();
}
