// 중간 제작품 연동 복구 커맨드
import { EmbedBuilder } from 'discord.js';
import { loadInventory, addItem } from '../../database.js';
import { sendTemporaryReply } from '../../utils.js';

/**
 * /복구 커맨드 처리 - 중간 제작품 연동 복구
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRepairCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  try {
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
            if (!inventory.crafting?.categories?.[linkedCategory]?.[linkedName]) {
              // 제작 섹션에 아이템 생성 (DB 반영)
              await addItem({
                name: linkedName,
                category: linkedCategory,
                type: 'crafting',
                itemType: 'intermediate',
                quantity: itemData.quantity,
                required: itemData.required,
                linkedItem: `inventory/${category}/${itemName}`,
                emoji: itemData.emoji
              });
              
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
            if (!inventory.categories?.[linkedCategory]?.[linkedName]) {
              // 재고 섹션에 아이템 생성 (DB 반영)
              await addItem({
                name: linkedName,
                category: linkedCategory,
                type: 'inventory',
                itemType: 'intermediate',
                quantity: itemData.quantity,
                required: itemData.required,
                linkedItem: `crafting/${category}/${itemName}`,
                emoji: itemData.emoji
              });
              
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
      const itemList = repairedItems
        .map(item => `• ${item.category}/${item.itemName} (${item.quantity}/${item.required}개)`)
        .join('\n');
      
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ 중간 제작품 연동 복구 완료')
        .setDescription(`${repairedCount}개의 중간 제작품 연동이 복구되었습니다.\n\n**복구된 아이템:**\n${itemList}`);
      
      await interaction.editReply({ embeds: [embed] });
    } else {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('✅ 복구 완료')
        .setDescription('복구가 필요한 아이템이 없습니다.\n모든 중간 제작품이 정상적으로 연동되어 있습니다.');
      
      await interaction.editReply({ embeds: [embed] });
    }
    
  } catch (error) {
    console.error('❌ 복구 커맨드 에러:', error);
    await interaction.editReply({ 
      content: `❌ 복구 중 오류가 발생했습니다.\n${error.message}` 
    }).catch(() => {});
  }
}
