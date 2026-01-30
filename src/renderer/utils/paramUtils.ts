// Helper functions for parameter handling in cell descriptions

export function extractParams(text: string): Record<string, string> {
  const params: Record<string, string> = {};
  const regex = /\{\{([^:}]+):([^}]+)\}\}/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    params[match[1].trim()] = match[2].trim();
  }
  return params;
}

export interface ParamChanges {
  added: string[];
  removed: string[];
  changed: Record<string, { old: string; new: string }>;
}

export function getParamChanges(
  oldParams: Record<string, string>,
  newParams: Record<string, string>
): ParamChanges {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: Record<string, { old: string; new: string }> = {};

  // Check for changed and removed params
  for (const [name, oldValue] of Object.entries(oldParams)) {
    if (!(name in newParams)) {
      removed.push(name);
    } else if (newParams[name] !== oldValue) {
      changed[name] = { old: oldValue, new: newParams[name] };
    }
  }

  // Check for added params
  for (const name of Object.keys(newParams)) {
    if (!(name in oldParams)) {
      added.push(name);
    }
  }

  return { added, removed, changed };
}

export function applyParamChangesToCode(
  code: string,
  changes: Record<string, { old: string; new: string }>
): string {
  let result = code;
  for (const { old: oldValue, new: newValue } of Object.values(changes)) {
    // Replace old value with new value in code
    // Be careful to replace as whole values, not partial matches
    const escapedOld = oldValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match the value as a standalone token (number, string literal, or identifier)
    const patterns = [
      new RegExp(`\\b${escapedOld}\\b`, 'g'), // As a word/number
      new RegExp(`"${escapedOld}"`, 'g'),     // As a double-quoted string
      new RegExp(`'${escapedOld}'`, 'g'),     // As a single-quoted string
    ];
    for (const pattern of patterns) {
      if (pattern.test(result)) {
        result = result.replace(pattern, (match) => {
          if (match.startsWith('"')) return `"${newValue}"`;
          if (match.startsWith("'")) return `'${newValue}'`;
          return newValue;
        });
        break; // Found and replaced
      }
    }
  }
  return result;
}

export function applyParamChangesToDescription(
  text: string,
  changes: Record<string, { old: string; new: string }>
): string {
  let result = text;
  for (const [name, { old: oldValue, new: newValue }] of Object.entries(changes)) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedOld = oldValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\{\\{${escapedName}:${escapedOld}\\}\\}`, 'g');
    result = result.replace(regex, `{{${name}:${newValue}}}`);
  }
  return result;
}
