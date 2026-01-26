// 수량 관리 select 핸들러
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { loadInventory } from '../../database.js';
import { formatQuantity, getItemIcon, getTimeoutSettings, safeDeleteReply, safeErrorReply, encodeCustomIdPart } from '../../utils.js';

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
      .setCustomId(`quantity_add_${type}_${category}_${encodeCustomIdPart(selectedItem)}`)
      .setLabel('➕ 추가')
      .setStyle(ButtonStyle.Success);
    
    const editButton = new ButtonBuilder()
      .setCustomId(`quantity_edit_${type}_${category}_${encodeCustomIdPart(selectedItem)}`)
      .setLabel('✏️ 수정')
      .setStyle(ButtonStyle.Primary);
    
    const subtractButton = new ButtonBuilder()
      .setCustomId(`quantity_subtract_${type}_${category}_${encodeCustomIdPart(selectedItem)}`)
      .setLabel('➖ 차감')
      .setStyle(ButtonStyle.Danger);
    
    const editRequiredButton = new ButtonBuilder()
      .setCustomId(`quantity_edit_required_${type}_${category}_${encodeCustomIdPart(selectedItem)}`)
      .setLabel('🎯 목표 수정')
      .setStyle(ButtonStyle.Secondary);
    
    const row = new ActionRowBuilder().addComponents(addButton, editButton, subtractButton, editRequiredButton);
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory : inventory.crafting;
    
    // 안전한 데이터 접근
    if (!targetData?.categories?.[category]?.[selectedItem]) {
      return await safeErrorReply(interaction, `❌ "${selectedItem}" 아이템을 찾을 수 없습니다.`);
    }
    
    const itemData = targetData.categories[category][selectedItem];
    const formatted = formatQuantity(itemData.quantity);
    const icon = getItemIcon(selectedItem, inventory);
    
    await interaction.update({
      content: `📊 ${icon} **${selectedItem}** 수량관리\n\n**현재 수량:** ${formatted.items}개/${formatted.sets}세트/${formatted.boxes}상자 (총 ${itemData.quantity}개)\n**목표 수량:** ${itemData.required}개\n\n원하는 작업을 선택하세요:\n\n_이 메시지는 30초 후 자동 삭제됩니다_`,
      components: [row]
    });
    
    // 설정된 시간 후 자동 삭제
    const { selectTimeout } = getTimeoutSettings(inventory);
    setTimeout(() => safeDeleteReply(interaction), selectTimeout);
    
  } catch (error) {
    console.error('❌ 수량관리 선택 에러:', error);
    await safeErrorReply(interaction, '오류가 발생했습니다: ' + error.message);
  }
}
