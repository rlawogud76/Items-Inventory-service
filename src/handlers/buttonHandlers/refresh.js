// 새로고침 핸들러
import { loadInventory } from '../../database-old.js';
import { createCraftingEmbed, createInventoryEmbed, createButtons } from '../../embeds.js';

export async function handleRefresh(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[1]; // 'inventory' or 'crafting'
    const category = parts.length > 2 ? parts.slice(2).join('_') : null;
    
    console.log('🔄 새로고침 버튼 클릭');
    console.log('  - customId:', interaction.customId);
    console.log('  - 타입:', type);
    console.log('  - 카테고리:', category || '전체');
    
    const inventory = await loadInventory();
    const uiMode = inventory.settings?.uiMode || 'normal';
    const barLength = inventory.settings?.barLength || 15;
    let embed, buttons, items, totalPages;
    
    if (type === 'crafting') {
      const crafting = inventory.crafting || { categories: {}, crafting: {} };
      items = Object.entries(crafting.categories[category] || {});
      totalPages = Math.ceil(items.length / 25);
      embed = createCraftingEmbed(crafting, category, uiMode, barLength, 0);
    } else {
      items = Object.entries(inventory.categories[category] || {});
      totalPages = Math.ceil(items.length / 25);
      embed = createInventoryEmbed(inventory, category, uiMode, barLength, 0);
    }
    
    buttons = createButtons(category, true, type || 'inventory', uiMode, barLength, inventory, interaction.user.id, 0, totalPages);
    
    await interaction.update({ embeds: [embed], components: buttons });
    console.log('✅ 새로고침 완료');
  } catch (error) {
    console.error('❌ 새로고침 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '새로고침 중 오류가 발생했습니다.', flags: 64 }).catch((err) => {
        console.error('❌ 새로고침 에러 응답 실패:', err);
      });
    }
  }
}
