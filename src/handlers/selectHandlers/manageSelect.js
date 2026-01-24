// 관리(삭제/수정) select 핸들러
import { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { loadInventory, removeItem } from '../../database.js';
import { addHistory } from '../../utils.js';

/**
 * 삭제 항목 선택 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRemoveSelect(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.slice(3).join('_');
    const selectedItem = interaction.values[0];
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    
    if (!targetData?.[category]?.[selectedItem]) {
      return await interaction.update({
        content: `❌ "${selectedItem}"을(를) 찾을 수 없습니다.`,
        components: []
      });
    }
    
    const itemData = targetData[category][selectedItem];
    
    // 제작품인지 확인 (레시피 삭제 여부 메시지용)
    const recipeDeleted = type === 'crafting' && inventory.crafting?.recipes?.[category]?.[selectedItem];
    
    // 아이템 삭제 (DB 반영)
    await removeItem(type, category, selectedItem);
    
    await addHistory(
      type,
      category,
      selectedItem,
      'remove',
      `수량: ${itemData.quantity}/${itemData.required}${recipeDeleted ? ' (레시피 포함)' : ''}`,
      interaction.user.displayName || interaction.user.username
    );

    const successEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('✅ 삭제 완료')
      .setDescription(`**카테고리:** ${category}\n**${selectedItem}**이(가) 삭제되었습니다.${recipeDeleted ? '\n🗑️ 연결된 레시피도 함께 삭제되었습니다.' : ''}`);
    
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
    
  } catch (error) {
    console.error('❌ 삭제 선택 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 삭제 선택 에러 응답 실패:', err);
    });
  }
}

/**
 * 수정 항목 선택 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleEditSelect(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.slice(3).join('_');
    const selectedItem = interaction.values[0];
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    
    if (!targetData?.[category]?.[selectedItem]) {
      return await interaction.update({
        content: `❌ "${selectedItem}"을(를) 찾을 수 없습니다.`,
        components: []
      });
    }
    
    // 이름 수정 모달 표시
    const modal = new ModalBuilder()
      .setCustomId(`edit_name_modal_${type}_${category}_${selectedItem}`)
      .setTitle(`✏️ 이름 수정: ${selectedItem}`);
    
    const nameInput = new TextInputBuilder()
      .setCustomId('new_name')
      .setLabel('새 이름')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 다이아몬드')
      .setValue(selectedItem)
      .setRequired(true);
    
    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
    
    await interaction.showModal(modal);
    
    // 모달 표시 후 원래 메시지는 유지 (모달 제출 후 삭제됨)
    
  } catch (error) {
    console.error('❌ 이름 수정 선택 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 이름 수정 선택 에러 응답 실패:', err);
    });
  }
}
