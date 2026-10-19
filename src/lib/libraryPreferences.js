export function readPreference(key, fallback) {
  try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); }
  catch { return fallback; }
}
export function writePreference(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
export const accountKey = (userId, kind) => `tonghop.${kind}.${userId}`;
export function readAccountIds(userId, kind) {
  const key = accountKey(userId, kind);
  const ids = readPreference(key, []);
  return Array.isArray(ids) ? [...new Set(ids.filter(id => typeof id === 'string'))].slice(0, kind === 'recent' ? 8 : 500) : [];
}
export function readSavedIds(userId) {
  const ids = readAccountIds(userId, 'saved');
  if (ids.length || readPreference(accountKey(userId, 'saved'), null) !== null) return ids;
  const legacy = readPreference('tonghop.saved-solutions', []);
  if (!Array.isArray(legacy) || !legacy.length) return ids;
  const migrated = [...new Set(legacy.filter(id => typeof id === 'string'))].slice(0, 500);
  writePreference(accountKey(userId, 'saved'), migrated);
  try { localStorage.removeItem('tonghop.saved-solutions'); } catch {}
  return migrated;
}
