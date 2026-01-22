// 수량 관리 select 핸들러
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { loadInventory } from '../../database.js';
import { formatQuantity, getItemIcon } from '../../utils.js';

/**
 * 수량 관리 항목 선택 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleQuantitySelect(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.slice(3).join('_');
    const selectedItem = interaction.values[0];
    
    // 추가/수정/차감 선택 버튼 생성
    const addButton = new ButtonBuilder()
      .setCustomId(`quantity_add_${type}_${category}_${selectedItem}`)
      .setLabel('➕ 추가')
      .setStyle(ButtonStyle.Success);
    
    const editButton = new ButtonBuilder()
      .setCustomId(`quantity_edit_${type}_${category}_${selectedItem}`)
      .setLabel('✏️ 수정')
      .setStyle(ButtonStyle.Primary);
    
    const subtractButton = new ButtonBuilder()
      .setCustomId(`quantity_subtract_${type}_${category}_${selectedItem}`)
      .setLabel('➖ 차감')
      .setStyle(ButtonStyle.Danger);
    
    const editRequiredButton = new ButtonBuilder()
      .setCustomId(`quantity_edit_required_${type}_${category}_${selectedItem}`)
      .setLabel('🎯 목표 수정')
      .setStyle(ButtonStyle.Secondary);
    
    const row = new ActionRowBuilder().addComponents(addButton, editButton, subtractButton, editRequiredButton);
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory : inventory.crafting;
    const itemData = targetData.categories[category][selectedItem];
    const formatted = formatQuantity(itemData.quantity);
    const icon = getItemIcon(selectedItem, inventory);
    
    await interaction.update({
      content: `📊 ${icon} **${selectedItem}** 수량관리\n\n**현재 수량:** ${formatted.boxes}상자/${formatted.sets}세트/${formatted.items}개 (총 ${itemData.quantity}개)\n**목표 수량:** ${itemData.required}개\n\n원하는 작업을 선택하세요:`,
      components: [row]
    });
    
    // 30초 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, 30000);
    
  } catch (error) {
    console.error('❌ 수량관리 선택 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}
