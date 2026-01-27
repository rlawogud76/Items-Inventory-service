// 태그 서비스 유틸리티

const TAG_TYPES = ['inventory', 'crafting'];

export function normalizeTagsData(tags = {}) {
  const normalized = { inventory: {}, crafting: {} };
  let changed = false;

  for (const type of TAG_TYPES) {
    const typeTags = tags?.[type] || {};
    for (const [category, tagMap] of Object.entries(typeTags)) {
      if (!normalized[type][category]) normalized[type][category] = {};
      for (const [tagName, tagData] of Object.entries(tagMap || {})) {
        let data = tagData;
        if (Array.isArray(data)) {
          changed = true;
          data = { items: data, color: 'default' };
        }
        const items = Array.isArray(data?.items) ? data.items : [];
        const uniqueItems = Array.from(new Set(items));
        if (uniqueItems.length !== items.length) changed = true;
        const color = data?.color || 'default';
        if (!data?.color) changed = true;

        normalized[type][category][tagName] = {
          items: uniqueItems,
          color,
          createdAt: data?.createdAt || null,
          updatedAt: data?.updatedAt || null
        };
      }
    }
  }

  return { tags: normalized, changed };
}

export function ensureTag(tags, type, category, tagName, color = 'default') {
  if (!tags[type]) tags[type] = {};
  if (!tags[type][category]) tags[type][category] = {};
  if (!tags[type][category][tagName]) {
    tags[type][category][tagName] = {
      items: [],
      color,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
  return tags[type][category][tagName];
}

export function listTags(tags, type, category) {
  return Object.entries(tags?.[type]?.[category] || {}).map(([tagName, tagData]) => ({
    name: tagName,
    color: tagData?.color || 'default',
    items: tagData?.items || []
  }));
}

export function addItemsToTag(tags, type, category, tagName, items, moveFromOtherTags = true, inventory = null) {
  const tagData = ensureTag(tags, type, category, tagName);
  const uniqueItems = new Set(tagData.items);
  let addedCount = 0;
  let movedCount = 0;

  for (const itemName of items) {
    if (moveFromOtherTags) {
      for (const [otherTag, otherData] of Object.entries(tags?.[type]?.[category] || {})) {
        if (otherTag === tagName) continue;
        if (otherData?.items?.includes(itemName)) {
          otherData.items = otherData.items.filter(i => i !== itemName);
          otherData.updatedAt = new Date().toISOString();
          movedCount++;
        }
      }
    }

    if (!uniqueItems.has(itemName)) {
      uniqueItems.add(itemName);
      addedCount++;
    }

    // 연동된 아이템 동기화 (재고 <-> 제작)
    if (inventory) {
      const itemDef = type === 'inventory' 
        ? inventory.categories?.[category]?.[itemName]
        : inventory.crafting?.categories?.[category]?.[itemName];
      
      if (itemDef?.linkedItem) {
        const [linkedType, linkedCategory, linkedName] = itemDef.linkedItem.split('/');
        
        // 연동된 쪽에도 태그 생성 (색상은 현재 태그 색상 따름)
        const linkedTagData = ensureTag(tags, linkedType, linkedCategory, tagName, tagData.color);
        const linkedUniqueItems = new Set(linkedTagData.items);
        
        // 연동 아이템 이동 처리
        if (moveFromOtherTags) {
          for (const [otherTag, otherData] of Object.entries(tags?.[linkedType]?.[linkedCategory] || {})) {
            if (otherTag === tagName) continue;
            if (otherData?.items?.includes(linkedName)) {
              otherData.items = otherData.items.filter(i => i !== linkedName);
              otherData.updatedAt = new Date().toISOString();
            }
          }
        }
        
        if (!linkedUniqueItems.has(linkedName)) {
          linkedUniqueItems.add(linkedName);
        }
        linkedTagData.items = Array.from(linkedUniqueItems);
        linkedTagData.updatedAt = new Date().toISOString();
      }
    }
  }

  tagData.items = Array.from(uniqueItems);
  tagData.updatedAt = new Date().toISOString();

  return { addedCount, movedCount };
}

export function removeItemsFromTag(tags, type, category, tagName, items, inventory = null) {
  const tagData = tags?.[type]?.[category]?.[tagName];
  if (!tagData) return { removedCount: 0 };
  const before = tagData.items.length;
  const removeSet = new Set(items);
  
  // 연동된 아이템 동기화
  if (inventory) {
    for (const itemName of items) {
      const itemDef = type === 'inventory' 
        ? inventory.categories?.[category]?.[itemName]
        : inventory.crafting?.categories?.[category]?.[itemName];
      
      if (itemDef?.linkedItem) {
        const [linkedType, linkedCategory, linkedName] = itemDef.linkedItem.split('/');
        const linkedTagData = tags?.[linkedType]?.[linkedCategory]?.[tagName];
        
        if (linkedTagData) {
          const linkedBefore = linkedTagData.items.length;
          linkedTagData.items = linkedTagData.items.filter(i => i !== linkedName);
          if (linkedTagData.items.length !== linkedBefore) {
            linkedTagData.updatedAt = new Date().toISOString();
          }
        }
      }
    }
  }
  
  tagData.items = tagData.items.filter(i => !removeSet.has(i));
  tagData.updatedAt = new Date().toISOString();
  return { removedCount: before - tagData.items.length };
}

export function deleteTag(tags, type, category, tagName) {
  if (tags?.[type]?.[category]?.[tagName]) {
    delete tags[type][category][tagName];
    if (Object.keys(tags[type][category]).length === 0) {
      delete tags[type][category];
    }
    return true;
  }
  return false;
}

export function setTagColor(tags, type, category, tagName, color) {
  const tagData = ensureTag(tags, type, category, tagName);
  tagData.color = color || 'default';
  tagData.updatedAt = new Date().toISOString();
}

export function mergeTags(tags, type, category, sourceTag, targetTag) {
  if (!tags?.[type]?.[category]?.[sourceTag] || !tags?.[type]?.[category]?.[targetTag]) {
    return { mergedCount: 0 };
  }
  const sourceItems = tags[type][category][sourceTag].items || [];
  const { addedCount } = addItemsToTag(tags, type, category, targetTag, sourceItems, true);
  deleteTag(tags, type, category, sourceTag);
  return { mergedCount: addedCount };
}

export function cleanupEmptyTags(tags, type, category) {
  let removed = 0;
  const tagMap = tags?.[type]?.[category] || {};
  for (const [tagName, tagData] of Object.entries(tagMap)) {
    if (!tagData?.items || tagData.items.length === 0) {
      delete tagMap[tagName];
      removed++;
    }
  }
  return removed;
}

export function searchTags(tags, type, category, query) {
  const q = (query || '').toLowerCase();
  const results = [];
  for (const [tagName, tagData] of Object.entries(tags?.[type]?.[category] || {})) {
    const matchesTag = tagName.toLowerCase().includes(q);
    const matchedItems = (tagData.items || []).filter(item => item.toLowerCase().includes(q));
    if (matchesTag || matchedItems.length > 0) {
      results.push({
        tagName,
        color: tagData.color || 'default',
        matchedItems,
        totalItems: (tagData.items || []).length
      });
    }
  }
  return results;
}

export function syncLinkedTags(inventory) {
  const tags = inventory.tags || { inventory: {}, crafting: {} };
  let syncedCount = 0;
  const TAG_TYPES = ['inventory', 'crafting'];

  for (const type of TAG_TYPES) {
    const typeTags = tags[type] || {};
    for (const [category, tagMap] of Object.entries(typeTags)) {
      for (const [tagName, tagData] of Object.entries(tagMap)) {
        if (!tagData.items) continue;

        for (const itemName of tagData.items) {
          const itemDef = type === 'inventory' 
            ? inventory.categories?.[category]?.[itemName]
            : inventory.crafting?.categories?.[category]?.[itemName];
          
          if (itemDef?.linkedItem) {
            const [linkedType, linkedCategory, linkedName] = itemDef.linkedItem.split('/');
            
            // 연동된 쪽 태그 확인 및 생성
            const linkedTagData = ensureTag(tags, linkedType, linkedCategory, tagName, tagData.color);
            const linkedUniqueItems = new Set(linkedTagData.items || []);
            
            if (!linkedUniqueItems.has(linkedName)) {
              linkedUniqueItems.add(linkedName);
              linkedTagData.items = Array.from(linkedUniqueItems);
              linkedTagData.updatedAt = new Date().toISOString();
              syncedCount++;
              // console.log(`🔄 Sync tag: ${tagName} -> ${linkedName} (${linkedType})`);
            }
            
            // 색상 동기화 (기본값이면 원본 색상으로)
            if (linkedTagData.color === 'default' && tagData.color !== 'default') {
               linkedTagData.color = tagData.color;
            }
          }
        }
      }
    }
  }
  return syncedCount;
}
