const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const equal = (first, second) => JSON.stringify(first) === JSON.stringify(second);
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isRecordArray = (value) => Array.isArray(value) && value.every((item) => isRecord(item) && item.id != null);

const mergeObject = (baseline, local, remote, path, conflicts) => {
  const merged = {};
  const keys = new Set([
    ...Object.keys(baseline || {}),
    ...Object.keys(local || {}),
    ...Object.keys(remote || {}),
  ]);
  keys.forEach((key) => {
    const baseValue = baseline?.[key];
    const localValue = local?.[key];
    const remoteValue = remote?.[key];
    const localChanged = !equal(baseValue, localValue);
    const remoteChanged = !equal(baseValue, remoteValue);
    const fieldPath = [...path, key];
    let value;

    if (!localChanged) value = remoteValue;
    else if (!remoteChanged) value = localValue;
    else if (equal(localValue, remoteValue)) value = remoteValue;
    else if (isRecord(baseValue) && isRecord(localValue) && isRecord(remoteValue)) {
      value = mergeObject(baseValue, localValue, remoteValue, fieldPath, conflicts);
    } else {
      conflicts.push({
        id: JSON.stringify(fieldPath),
        path: fieldPath,
        baseline: clone(baseValue),
        local: clone(localValue),
        remote: clone(remoteValue),
      });
      value = remoteValue;
    }

    if (value !== undefined) merged[key] = clone(value);
  });
  return merged;
};

const mergeRecordArray = (baseline, local, remote, path, conflicts) => {
  const toMap = (items) => new Map(items.map((item) => [String(item.id), item]));
  const baseById = toMap(baseline);
  const localById = toMap(local);
  const remoteById = toMap(remote);
  const order = [...remote.map((item) => String(item.id)), ...local.map((item) => String(item.id))]
    .filter((id, index, ids) => ids.indexOf(id) === index);
  const merged = [];

  order.forEach((id) => {
    const baseRecord = baseById.get(id);
    const localRecord = localById.get(id);
    const remoteRecord = remoteById.get(id);
    const localChanged = !equal(baseRecord, localRecord);
    const remoteChanged = !equal(baseRecord, remoteRecord);
    let record;
    const recordPath = [...path, { recordId: id }];

    if (!localChanged) record = remoteRecord;
    else if (!remoteChanged) record = localRecord;
    else if (equal(localRecord, remoteRecord)) record = remoteRecord;
    else if (isRecord(baseRecord) && isRecord(localRecord) && isRecord(remoteRecord)) {
      record = mergeObject(baseRecord, localRecord, remoteRecord, recordPath, conflicts);
    } else {
      conflicts.push({
        id: JSON.stringify(recordPath),
        path: recordPath,
        baseline: clone(baseRecord),
        local: clone(localRecord),
        remote: clone(remoteRecord),
      });
      record = remoteRecord;
    }

    if (record !== undefined) merged.push(clone(record));
  });
  return merged;
};

export function rebaseSharedStoreDraft(baseline, local, remote, keys) {
  const data = { ...remote };
  const conflicts = [];

  keys.forEach((key) => {
    const baseValue = baseline?.[key];
    const localValue = local?.[key];
    const remoteValue = remote?.[key];
    if (equal(baseValue, localValue)) return;

    if (isRecordArray(baseValue) && isRecordArray(localValue) && isRecordArray(remoteValue)) {
      data[key] = mergeRecordArray(baseValue, localValue, remoteValue, [key], conflicts);
    } else if (isRecord(baseValue) && isRecord(localValue) && isRecord(remoteValue)) {
      data[key] = mergeObject(baseValue, localValue, remoteValue, [key], conflicts);
    } else if (!equal(baseValue, remoteValue) && !equal(localValue, remoteValue)) {
      conflicts.push({
        id: JSON.stringify([key]),
        path: [key],
        baseline: clone(baseValue),
        local: clone(localValue),
        remote: clone(remoteValue),
      });
      data[key] = remoteValue;
    } else {
      data[key] = clone(localValue);
    }
  });

  return { data, conflicts };
}

export function applySharedStoreDraftChoice(data, conflict, choice) {
  const result = clone(data);
  const value = clone(conflict[choice]);
  let parent = result;

  for (let index = 0; index < conflict.path.length - 1; index += 1) {
    const part = conflict.path[index];
    if (typeof part === 'string') {
      parent = parent[part];
      continue;
    }
    const recordIndex = parent.findIndex((record) => String(record.id) === part.recordId);
    parent = parent[recordIndex];
  }

  const target = conflict.path[conflict.path.length - 1];
  if (typeof target === 'string') {
    if (value === undefined) delete parent[target];
    else parent[target] = value;
  } else {
    const recordIndex = parent.findIndex((record) => String(record.id) === target.recordId);
    if (recordIndex >= 0) {
      if (value === undefined) parent.splice(recordIndex, 1);
      else parent[recordIndex] = value;
    } else if (value !== undefined) {
      parent.push(value);
    }
  }
  return result;
}
