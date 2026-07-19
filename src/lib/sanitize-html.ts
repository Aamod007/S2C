/**
 * Hardened HTML sanitizer for AI-generated markup rendered via
 * dangerouslySetInnerHTML (spec §7.2 step 7 / §14 hardening item).
 *
 * Pure string/regex based — no DOM dependency, runs identically in the
 * browser, Node, and tests. Sanitization is applied repeatedly until the
 * output reaches a fixed point, which defeats nested/reassembling payloads
 * like `<scr<script>ipt>alert(1)</scr</script>ipt>` where removing an inner
 * tag would otherwise splice a new dangerous tag into existence.
 */

const MAX_PASSES = 10;

/** Tags removed entirely, including their inner content. */
const CONTENT_TAGS = ["script", "style", "iframe", "object", "embed", "form"];

/** Void-ish tags removed as standalone open/close tags (content preserved). */
const VOID_TAGS = ["link", "meta", "base", "frame", "frameset", "applet"];

// `<\s*script[\s>/]` style matching: allows whitespace after `<`, mixed case
// via the `i` flag, and any attribute soup up to the closing `>`.
const contentTagPatterns = CONTENT_TAGS.map(
  (tag) =>
    new RegExp(
      // opening tag ... matching closing tag (lazy, dotall via [\s\S])
      `<\\s*${tag}(?=[\\s/>])[^>]*>[\\s\\S]*?<\\s*/\\s*${tag}\\s*>`,
      "gi"
    )
);

// Unclosed/orphaned dangerous tags (e.g. `<script src=...>` with no close,
// or a stray `</script>`): strip the tag itself.
const orphanTagPatterns = [...CONTENT_TAGS, ...VOID_TAGS].map(
  (tag) => new RegExp(`<\\s*/?\\s*${tag}(?=[\\s/>])[^>]*>`, "gi")
);

// on* event handler attributes, quoted or bare:
//   onclick="..."  onmouseover='...'  onload=alert(1)
const EVENT_HANDLER_ATTR =
  /\son[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

// srcdoc can smuggle a full document into (removed) iframes; formaction can
// hijack buttons — strip both defensively.
const DANGEROUS_ATTRS =
  /\s(?:srcdoc|formaction)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

// href/src/xlink:href/action with a dangerous scheme. The value check runs
// on an entity/whitespace-normalized copy, so `java&#115;cript:` and
// `java\tscript:` are caught (see hasDangerousScheme).
const URL_ATTR =
  /\s((?:href|src|xlink:href|action)\s*=\s*)("([^"]*)"|'([^']*)'|([^\s>]+))/gi;

// CSS expression()/javascript: inside style attributes.
const STYLE_ATTR = /\s(style\s*=\s*)("([^"]*)"|'([^']*)'|([^\s>]+))/gi;

/** Decodes numeric/named entities & control chars enough to expose scheme tricks. */
function normalizeForSchemeCheck(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&tab;/gi, "\t")
    .replace(/&newline;/gi, "\n")
    .replace(/&colon;/gi, ":")
    // strip whitespace + control chars that browsers ignore inside schemes
    .replace(/[\u0000-\u0020\u007f\u00a0\s]+/g, "")
    .toLowerCase();
}

function hasDangerousScheme(rawValue: string): boolean {
  const normalized = normalizeForSchemeCheck(rawValue);
  if (
    normalized.startsWith("javascript:") ||
    normalized.startsWith("vbscript:")
  ) {
    return true;
  }
  // data: URLs — allow only images (data:image/png;base64,... is legitimate
  // for generated placeholder art); block data:text/html and everything else.
  if (normalized.startsWith("data:") && !normalized.startsWith("data:image/")) {
    return true;
  }
  return false;
}

function sanitizeOnce(html: string): string {
  let out = html;

  // 1. Dangerous tags with content, then orphaned/unclosed dangerous tags.
  for (const pattern of contentTagPatterns) out = out.replace(pattern, "");
  for (const pattern of orphanTagPatterns) out = out.replace(pattern, "");

  // 2. Inline event handlers + smuggling attributes.
  out = out.replace(EVENT_HANDLER_ATTR, "");
  out = out.replace(DANGEROUS_ATTRS, "");

  // 3. URL attributes with dangerous schemes → neutralized to "#".
  out = out.replace(
    URL_ATTR,
    (match, attrEq: string, _quoted, dq, sq, bare) => {
      const value = dq ?? sq ?? bare ?? "";
      return hasDangerousScheme(value) ? ` ${attrEq}"#"` : match;
    }
  );

  // 4. style attributes containing expression()/url(javascript:)/behavior.
  out = out.replace(
    STYLE_ATTR,
    (match, _attrEq, _quoted, dq, sq, bare) => {
      const value: string = dq ?? sq ?? bare ?? "";
      const normalized = normalizeForSchemeCheck(value);
      if (
        normalized.includes("expression(") ||
        normalized.includes("javascript:") ||
        normalized.includes("vbscript:") ||
        normalized.includes("behavior:") ||
        normalized.includes("-moz-binding")
      ) {
        return "";
      }
      return match;
    }
  );

  return out;
}

/**
 * Sanitizes an HTML fragment for safe injection via dangerouslySetInnerHTML.
 *
 * Removes: <script>/<style>/<iframe>/<object>/<embed>/<form> (with content),
 * <link>/<meta>/<base> and frame tags, on* event handler attributes,
 * srcdoc/formaction, javascript:/vbscript:/data:text URLs in
 * href/src/action, and CSS expression()/binding tricks in style attributes.
 *
 * Runs repeatedly until the output is stable so payloads that reassemble
 * after one pass (nested, split, or entity-obfuscated tags) are also caught.
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== "string" || html.length === 0) return "";

  let current = html;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const next = sanitizeOnce(current);
    if (next === current) return current;
    current = next;
  }

  // Failed to stabilize within the pass budget — the input is adversarial
  // beyond anything the model should ever emit. Refuse to render it.
  return "";
}

export default sanitizeHtml;
