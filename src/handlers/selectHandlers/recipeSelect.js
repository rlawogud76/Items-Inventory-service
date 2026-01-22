// 레시피 select 핸들러
import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

/**
 * 레시피 재료 선택 핸들러 (수정)
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeMaterialEditSelect(interaction) {
  try {
    const parts = interaction.customId.replace('select_recipe_material_edit_', '').split('_');
    const category = parts[0];
    const step = parseInt(parts[parts.length - 1]);
    const itemName = parts.slice(1, -1).join('_');
    const selectedMaterial = interaction.values[0];
    
    // 수량 입력 모달 표시
    const modal = new ModalBuilder()
      .setCustomId(`recipe_edit_quantity_modal_${category}_${itemName}_${step}_${selectedMaterial}`)
      .setTitle(`재료 ${step}: ${selectedMaterial}`);
    
    const quantityInput = new TextInputBuilder()
      .setCustomId('material_quantity')
      .setLabel(`${selectedMaterial} 필요 수량`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 5')
      .setRequired(true);
    
    modal.addComponents(new ActionRowBuilder().addComponents(quantityInput));
    
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
    console.error('❌ 레시피 수정 재료 선택 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 레시피 재료 선택 핸들러 (추가)
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeMaterialSelect(interaction) {
  try {
    const parts = interaction.customId.replace('select_recipe_material_', '').split('_');
    const category = parts[0];
    const step = parts[parts.length - 1]; // 1, 2, 3
    const itemName = parts.slice(1, -1).join('_');
    const selectedMaterial = interaction.values[0];
    
    // 수량 입력 모달 표시
    const modal = new ModalBuilder()
      .setCustomId(`recipe_quantity_modal_${category}_${itemName}_${step}_${selectedMaterial}`)
      .setTitle(`재료 ${step}: ${selectedMaterial}`);
    
    const quantityInput = new TextInputBuilder()
      .setCustomId('material_quantity')
      .setLabel(`${selectedMaterial} 필요 수량`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 5')
      .setRequired(true);
    
    modal.addComponents(new ActionRowBuilder().addComponents(quantityInput));
    
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
    console.error('❌ 재료 선택 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}
