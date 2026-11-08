const readDrafts = (storage, key) => {
  const raw = storage.getItem(key);
  if (!raw) return {};
  const parsed = JSON.parse(raw);

  // Migrate the former single-import format without discarding its retry IDs.
  if (parsed?.fingerprint && Array.isArray(parsed.ids)) {
    return { [parsed.fingerprint]: parsed };
  }

  return parsed?.version === 2 && parsed.imports && typeof parsed.imports === 'object'
    ? parsed.imports
    : {};
};

export function getPendingImportDraft(storage, key, fingerprint) {
  const draft = readDrafts(storage, key)[fingerprint];
  return draft?.fingerprint === fingerprint && Array.isArray(draft.ids) ? draft : null;
}

export function rememberPendingImportDraft(storage, key, draft) {
  if (!draft?.fingerprint || !Array.isArray(draft.ids)) return;
  const imports = readDrafts(storage, key);
  imports[draft.fingerprint] = draft;
  storage.setItem(key, JSON.stringify({ version: 2, imports }));
}

export function clearPendingImportDraft(storage, key, fingerprint) {
  const imports = readDrafts(storage, key);
  if (!Object.prototype.hasOwnProperty.call(imports, fingerprint)) return;
  delete imports[fingerprint];
  if (Object.keys(imports).length) {
    storage.setItem(key, JSON.stringify({ version: 2, imports }));
  } else {
    storage.removeItem(key);
  }
}
