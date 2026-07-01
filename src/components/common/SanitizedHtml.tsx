import DOMPurify from "isomorphic-dompurify";
import { cn } from "@/lib/utils";

// Conservative allowlist for user-editable / migrated rich-text descriptions.
// Everything else (scripts, event handlers, styles, iframes, etc.) is stripped,
// so rendering the result via dangerouslySetInnerHTML is XSS-safe. Runs on both
// the server (RSC) and the client (isomorphic-dompurify picks the right impl).
const SANITIZE_CONFIG = {
    ALLOWED_TAGS: [
        "a", "b", "strong", "i", "em", "u", "s", "br", "p", "span",
        "ul", "ol", "li", "blockquote", "code", "pre",
        "h1", "h2", "h3", "h4", "h5", "h6",
    ],
    ALLOWED_ATTR: ["href", "title"],
};

/** Sanitize an untrusted HTML string down to the allowlist above. */
export function sanitizeHtml(html: string | null | undefined): string {
    return DOMPurify.sanitize(html ?? "", SANITIZE_CONFIG);
}

/** Strip all markup to plain text (e.g. for `<meta>` descriptions / previews). */
export function htmlToPlainText(html: string | null | undefined): string {
    return DOMPurify.sanitize(html ?? "", { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
        .replace(/\s+/g, " ")
        .trim();
}

// Minimal styling for the sanitized elements (no typography plugin in this
// project): links, lists, and paragraph spacing. `whitespace-pre-wrap` keeps
// line breaks for plain-text descriptions that use "\n" instead of tags.
const RICH_TEXT =
    "whitespace-pre-wrap break-words " +
    "[&_a]:text-primary [&_a]:underline [&_a]:break-words " +
    "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 " +
    "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0";

/**
 * Renders an untrusted HTML string safely. Use for region descriptions and any
 * other stored rich text.
 */
export default function SanitizedHtml({
    html,
    className,
}: {
    html: string | null | undefined;
    className?: string;
}) {
    return (
        <div
            className={cn(RICH_TEXT, className)}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
        />
    );
}
