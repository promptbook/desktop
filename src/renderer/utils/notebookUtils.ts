/**
 * Utility functions for notebook parameter handling
 */

/**
 * Extract parameters from text in the format {{name:value}}
 */
export function extractParams(text: string): Record<string, string> {
  const params: Record<string, string> = {};
  const regex = /\{\{([^:}]+):([^}]+)\}\}/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    params[match[1]] = match[2];
  }
  return params;
}

/**
 * Get parameter changes between old and new parameter sets
 */
export function getParamChanges(
  oldParams: Record<string, string>,
  newParams: Record<string, string>
): { added: string[]; removed: string[]; changed: Record<string, { old: string; new: string }> } {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: Record<string, { old: string; new: string }> = {};

  // Find added and changed params
  for (const [key, value] of Object.entries(newParams)) {
    if (!(key in oldParams)) {
      added.push(key);
    } else if (oldParams[key] !== value) {
      changed[key] = { old: oldParams[key], new: value };
    }
  }

  // Find removed params
  for (const key of Object.keys(oldParams)) {
    if (!(key in newParams)) {
      removed.push(key);
    }
  }

  return { added, removed, changed };
}

/**
 * Apply parameter changes to code by replacing old values with new values
 */
export function applyParamChangesToCode(
  code: string,
  changes: Record<string, { old: string; new: string }>
): string {
  let result = code;
  for (const [, { old, new: newVal }] of Object.entries(changes)) {
    // Escape special regex characters in old value
    const escaped = old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Replace all occurrences
    result = result.replace(new RegExp(escaped, 'g'), newVal);
  }
  return result;
}

/**
 * Apply parameter changes to description text
 */
export function applyParamChangesToDescription(
  text: string,
  changes: Record<string, { old: string; new: string }>
): string {
  let result = text;
  for (const [paramName, { new: newVal }] of Object.entries(changes)) {
    // Update the parameter syntax in descriptions: {{paramName:oldValue}} -> {{paramName:newValue}}
    const regex = new RegExp(`\\{\\{${paramName}:[^}]+\\}\\}`, 'g');
    result = result.replace(regex, `{{${paramName}:${newVal}}}`);
  }
  return result;
}
