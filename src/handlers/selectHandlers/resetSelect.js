// 초기화 select 핸들러
import { EmbedBuilder } from 'discord.js';
import { loadInventory, saveInventory } from '../../database.js';
import { getItemIcon, addHistory } from '../../utils.js';

/**
 * 초기화 항목 선택 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleResetSelect(interaction) {
  try {
    const parts = interaction.customId.replace('select_reset_', '').split('_');
    const type = parts[0]; // 'inventory' or 'crafting'
    const category = parts.slice(1).join('_');
    const selectedItem = interaction.values[0];
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory : inventory.crafting;
    
    if (!targetData.categories[category][selectedItem]) {
      return await interaction.update({
        content: `❌ "${selectedItem}"을(를) 찾을 수 없습니다.`,
        components: []
      });
    }
    
    const oldQuantity = targetData.categories[category][selectedItem].quantity;
    
    if (oldQuantity === 0) {
      return await interaction.update({
        content: `⚠️ **${selectedItem}**은(는) 이미 0개입니다.`,
        components: []
      });
    }
    
    targetData.categories[category][selectedItem].quantity = 0;
    
    addHistory(inventory, type, category, selectedItem, 'reset', 
      `${oldQuantity}개 → 0개`, 
      interaction.user.displayName || interaction.user.username);
    
    await saveInventory(inventory);
    
    const icon = getItemIcon(selectedItem, inventory);
    const successEmbed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('🔄 개별 초기화 완료')
      .setDescription(`**카테고리:** ${category}\n${icon} **${selectedItem}**\n${oldQuantity}개 → 0개`);
    
    await interaction.update({
      embeds: [successEmbed],
      components: []
    });
    
    // 15초 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, 15000);
    
    console.log(`🔄 ${interaction.user.displayName}님이 ${category} - ${selectedItem} 초기화: ${oldQuantity} -> 0`);
    
  } catch (error) {
    console.error('❌ 초기화 선택 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}
