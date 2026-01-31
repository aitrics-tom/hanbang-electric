/**
 * parseStepContent - Parse step content that might contain raw JSON strings
 *
 * This utility handles cases where LLM responses may include JSON objects
 * instead of plain text, extracting readable content for display.
 */

export interface ParsedStepContent {
  text: string;
  latex?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Parses step content that might contain raw JSON strings
 * Returns clean text content with extracted data
 */
export function parseStepContent(content: string): ParsedStepContent {
  // If content is empty or not a string
  if (!content || typeof content !== 'string') {
    return { text: String(content || '') };
  }

  const trimmed = content.trim();

  // Check if content looks like JSON (starts with { or [)
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      const parsed = JSON.parse(trimmed);

      // Handle array of objects (e.g., steps array nested inside)
      if (Array.isArray(parsed)) {
        const texts = parsed.map((item) => {
          if (typeof item === 'string') return item;
          if (item.content) return item.content;
          if (item.text) return item.text;
          if (item.description) return item.description;
          return JSON.stringify(item, null, 2);
        });
        return { text: texts.join('\n') };
      }

      // Handle object with common text fields
      if (typeof parsed === 'object' && parsed !== null) {
        // Priority order for text extraction
        const textFields = ['content', 'text', 'description', 'explanation', 'detail', 'body'];
        for (const field of textFields) {
          if (parsed[field] && typeof parsed[field] === 'string') {
            return {
              text: parsed[field],
              latex: parsed.latex || parsed.formula,
              metadata: parsed,
            };
          }
        }

        // If object has title/steps structure, format it nicely
        if (parsed.title || parsed.steps) {
          const parts: string[] = [];
          if (parsed.title) parts.push(parsed.title);
          if (parsed.steps && Array.isArray(parsed.steps)) {
            parsed.steps.forEach((step: { title?: string; content?: string }, i: number) => {
              parts.push(`${i + 1}. ${step.title || ''}: ${step.content || ''}`);
            });
          }
          if (parts.length > 0) {
            return { text: parts.join('\n'), metadata: parsed };
          }
        }

        // Fallback: stringify with readable formatting
        return { text: formatJsonForDisplay(parsed) };
      }
    } catch {
      // Not valid JSON, treat as regular text
    }
  }

  // Regular text content
  return { text: content };
}

/**
 * Format JSON object for readable display
 */
export function formatJsonForDisplay(obj: Record<string, unknown>): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    // Skip certain metadata keys
    if (['id', 'order', 'type', 'timestamp'].includes(key)) continue;

    const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');

    if (typeof value === 'string') {
      parts.push(`${label}: ${value}`);
    } else if (Array.isArray(value)) {
      if (value.length > 0) {
        const items = value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(', ');
        parts.push(`${label}: ${items}`);
      }
    } else if (value !== null && typeof value === 'object') {
      parts.push(`${label}: ${JSON.stringify(value)}`);
    } else if (value !== null && value !== undefined) {
      parts.push(`${label}: ${String(value)}`);
    }
  }

  return parts.join('\n');
}
