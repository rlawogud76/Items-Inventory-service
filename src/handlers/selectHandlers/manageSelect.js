// 관리(삭제/수정) select 핸들러
import { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { loadInventory, saveInventory } from '../../database.js';
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
    delete targetData[category][selectedItem];
    
    // 제작품 삭제 시 레시피도 함께 삭제
    let recipeDeleted = false;
    if (type === 'crafting' && inventory.crafting?.recipes?.[category]?.[selectedItem]) {
      delete inventory.crafting.recipes[category][selectedItem];
      recipeDeleted = true;
    }
    
    addHistory(
      inventory, 
      type, 
      category, 
      selectedItem, 
      'remove', 
      `수량: ${itemData.quantity}/${itemData.required}${recipeDeleted ? ' (레시피 포함)' : ''}`, 
      interaction.user.displayName || interaction.user.username
    );
    
    await saveInventory(inventory);
    
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
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
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
    
    // 모달 표시 후 원래 메시지 삭제
    setTimeout(async () => {
      try {
        await interaction.message.delete();
      } catch (error) {
        // 이미 삭제되었거나 삭제할 수 없는 경우 무시
      }
    }, 500);
    
  } catch (error) {
    console.error('❌ 이름 수정 선택 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}
