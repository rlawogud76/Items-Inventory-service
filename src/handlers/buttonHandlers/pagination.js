// 페이지네이션 핸들러
import { loadInventory } from '../../database-old.js';
import { createCraftingEmbed, createInventoryEmbed, createButtons } from '../../embeds.js';

export async function handlePageNavigation(interaction) {
  try {
    // customId 형식: page_prev_embed_inventory_해양_0 또는 page_next_embed_crafting_채광_2
    const parts = interaction.customId.split('_');
    const direction = parts[1]; // 'prev' or 'next'
    // parts[2]는 'embed'
    const type = parts[3]; // 'inventory' or 'crafting'
    const currentPage = parseInt(parts[parts.length - 1]);
    const category = parts.slice(4, -1).join('_');
    
    const newPage = direction === 'prev' ? currentPage - 1 : currentPage + 1;
    
    const inventory = await loadInventory();
    const uiMode = inventory.settings?.uiMode || 'normal';
    const barLength = inventory.settings?.barLength || 15;
    
    let embed, items, totalPages;
    
    if (type === 'crafting') {
      const crafting = inventory.crafting || { categories: {}, crafting: {} };
      items = Object.entries(crafting.categories[category] || {});
      totalPages = Math.ceil(items.length / 25);
      embed = createCraftingEmbed(crafting, category, uiMode, barLength, newPage);
    } else {
      items = Object.entries(inventory.categories[category] || {});
      totalPages = Math.ceil(items.length / 25);
      embed = createInventoryEmbed(inventory, category, uiMode, barLength, newPage);
    }
    
    const buttons = createButtons(category, true, type, uiMode, barLength, inventory, interaction.user.id, newPage, totalPages);
    
    await interaction.update({ embeds: [embed], components: buttons });
    console.log(`📄 임베드 페이지 이동: ${currentPage + 1} → ${newPage + 1}`);
  } catch (error) {
    console.error('❌ 페이지 이동 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '페이지 이동 중 오류가 발생했습니다.', flags: 64 }).catch((err) => {
        console.error('❌ 페이지 이동 에러 응답 실패:', err);
      });
    }
  }
}