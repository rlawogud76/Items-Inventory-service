// 중간 제작품 연동 복구 스크립트
// 재고에만 있고 제작에 없는 중간 제작품을 제작 섹션에도 생성

import { connectDatabase, loadInventory, saveInventory } from './src/database-old.js';

async function repairIntermediateItems() {
  console.log('🔄 중간 제작품 연동 복구 시작...\n');
  
  try {
    // DB 연결
    const connected = await connectDatabase();
    if (!connected) {
      console.error('❌ 데이터베이스 연결 실패');
      process.exit(1);
    }
    
    const inventory = await loadInventory();
    let repairedCount = 0;
    const repairedItems = [];
    
    // 재고 섹션의 모든 아이템 검사
    for (const [category, items] of Object.entries(inventory.categories || {})) {
      for (const [itemName, itemData] of Object.entries(items)) {
        // 중간 제작품인데 linkedItem이 있는 경우
        if (itemData.itemType === 'intermediate' && itemData.linkedItem) {
          const linkedPath = itemData.linkedItem.split('/');
          const [linkedType, linkedCategory, linkedName] = linkedPath;
          
          // 제작 섹션에 연동된 아이템이 없는 경우
          if (linkedType === 'crafting') {
            if (!inventory.crafting) {
              inventory.crafting = { categories: {}, recipes: {} };
            }
            if (!inventory.crafting.categories[linkedCategory]) {
              inventory.crafting.categories[linkedCategory] = {};
            }
            
            if (!inventory.crafting.categories[linkedCategory][linkedName]) {
              // 제작 섹션에 아이템 생성
              inventory.crafting.categories[linkedCategory][linkedName] = {
                quantity: itemData.quantity,
                required: itemData.required,
                itemType: 'intermediate',
                linkedItem: `inventory/${category}/${itemName}`
              };
              
              // 이모지가 있으면 복사
              if (itemData.emoji) {
                inventory.crafting.categories[linkedCategory][linkedName].emoji = itemData.emoji;
              }
              
              repairedCount++;
              repairedItems.push({
                category,
                itemName,
                quantity: itemData.quantity,
                required: itemData.required
              });
              
              console.log(`✅ 복구: ${category}/${itemName} → 제작 섹션에 생성`);
            }
          }
        }
      }
    }
    
    // 제작 섹션의 모든 아이템 검사 (반대 방향)
    for (const [category, items] of Object.entries(inventory.crafting?.categories || {})) {
      for (const [itemName, itemData] of Object.entries(items)) {
        // 중간 제작품인데 linkedItem이 있는 경우
        if (itemData.itemType === 'intermediate' && itemData.linkedItem) {
          const linkedPath = itemData.linkedItem.split('/');
          const [linkedType, linkedCategory, linkedName] = linkedPath;
          
          // 재고 섹션에 연동된 아이템이 없는 경우
          if (linkedType === 'inventory') {
            if (!inventory.categories[linkedCategory]) {
              inventory.categories[linkedCategory] = {};
            }
            
            if (!inventory.categories[linkedCategory][linkedName]) {
              // 재고 섹션에 아이템 생성
              inventory.categories[linkedCategory][linkedName] = {
                quantity: itemData.quantity,
                required: itemData.required,
                itemType: 'intermediate',
                linkedItem: `crafting/${category}/${itemName}`
              };
              
              // 이모지가 있으면 복사
              if (itemData.emoji) {
                inventory.categories[linkedCategory][linkedName].emoji = itemData.emoji;
              }
              
              repairedCount++;
              repairedItems.push({
                category,
                itemName,
                quantity: itemData.quantity,
                required: itemData.required
              });
              
              console.log(`✅ 복구: ${category}/${itemName} → 재고 섹션에 생성`);
            }
          }
        }
      }
    }
    
    if (repairedCount > 0) {
      await saveInventory(inventory);
      console.log(`\n✅ 복구 완료! ${repairedCount}개의 중간 제작품 연동이 복구되었습니다.\n`);
      
      console.log('📋 복구된 아이템 목록:');
      for (const item of repairedItems) {
        console.log(`  - ${item.category}/${item.itemName} (${item.quantity}/${item.required}개)`);
      }
    } else {
      console.log('✅ 복구가 필요한 아이템이 없습니다. 모든 중간 제작품이 정상적으로 연동되어 있습니다.');
    }
    
  } catch (error) {
    console.error('❌ 복구 중 오류 발생:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

repairIntermediateItems();
