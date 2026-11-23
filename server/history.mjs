// Limits describe the application's input budget, not a model's maximum context window.
export function buildHistory(history, { maxMessages = 80, maxChars = 64000 } = {}) {
  if (!Array.isArray(history)) return [];
  const clean = history.filter(m => m && ['user', 'assistant'].includes(m.role)
    && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.trim() })).slice(-maxMessages);
  const out = [];
  let total = 0;
  for (let i = clean.length - 1; i >= 0; i--) {
    if (total + clean[i].content.length > maxChars) break;
    out.unshift(clean[i]);
    total += clean[i].content.length;
  }
  return out;
}
