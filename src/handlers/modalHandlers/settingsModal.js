// 설정 관련 modal 핸들러 (바 크기 등)
import { loadInventory, saveInventory } from '../../database.js';
import { createCraftingEmbed, createInventoryEmbed, createButtons } from '../../embeds.js';
import { getAutoRefreshTimers } from '../buttonHandlers/settings.js';

/**
 * 바 크기 설정 모달 제출 핸들러
 * bar_size_modal_${type}_${category || 'all'}
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleBarSizeModal(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[3]; // 'inventory' or 'crafting'
    const category = parts[4] === 'all' ? null : parts.slice(4).join('_');

    const barSizeValue = interaction.fields.getTextInputValue('bar_size_value').trim();
    const percentage = parseInt(barSizeValue, 10);

    if (isNaN(percentage) || percentage < 25 || percentage > 200) {
      return await interaction.reply({
        content: `❌ 25% ~ 200% 사이의 숫자를 입력해주세요. (입력값: ${barSizeValue})`,
        ephemeral: true
      });
    }

    const newLength = Math.round(percentage / 10);

    const inventory = await loadInventory();
    if (!inventory.settings) inventory.settings = {};
    inventory.settings.barLength = newLength;
    await saveInventory(inventory);

    const uiMode = inventory.settings?.uiMode || 'normal';
    let embed;
    let totalPages;

    if (type === 'crafting') {
      const crafting = inventory.crafting || { categories: {}, crafting: {} };
      const items = Object.entries(crafting.categories[category] || {});
      totalPages = Math.ceil(items.length / 25);
      embed = createCraftingEmbed(crafting, category, uiMode, newLength, 0, inventory);
    } else {
      const items = Object.entries(inventory.categories[category] || {});
      totalPages = Math.ceil(items.length / 25);
      embed = createInventoryEmbed(inventory, category, uiMode, newLength, 0);
    }

    const messageId = interaction.message?.id;
    const isAutoRefreshing = getAutoRefreshTimers().has(messageId);
    const buttons = createButtons(category, isAutoRefreshing, type || 'inventory', uiMode, newLength, inventory, interaction.user.id, 0, totalPages);

    await interaction.update({ embeds: [embed], components: buttons });
    console.log(`📊 바 크기 변경: ${percentage}% (길이: ${newLength})`);
  } catch (error) {
    console.error('❌ 바 크기 모달 제출 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 바 크기 모달 응답 실패:', err);
    });
  }
}
