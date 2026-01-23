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
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
      console.error('❌ 레시피 수정 재료 선택 에러 응답 실패:', err);
    });
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
    const step = parseInt(parts[parts.length - 1]); // 문자열을 숫자로 변환
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
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
      console.error('❌ 재료 선택 에러 응답 실패:', err);
    });
  }
}

/**
 * 레시피 추가 제작품 선택 핸들러 (독립 실행)
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeAddSelect(interaction) {
  try {
    const parts = interaction.customId.replace('select_recipe_add_', '').split('_');
    const category = parts.join('_');
    const selectedItem = interaction.values[0];
    
    // 재료 선택 메뉴로 이동
    const { loadInventory } = await import('../../database-old.js');
    const { getItemIcon } = await import('../../utils.js');
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = await import('discord.js');
    
    const inventory = await loadInventory();
    
    // 같은 카테고리의 재고 아이템 목록 가져오기
    if (!inventory.categories[category] || Object.keys(inventory.categories[category]).length === 0) {
      return await interaction.update({
        content: `❌ "${category}" 카테고리에 재료가 없습니다. 먼저 재고 목록에 재료를 추가해주세요.`,
        components: []
      });
    }
    
    /**
     * 이모지 검증 함수
     */
    function validateEmoji(emoji) {
      if (!emoji) return '📦';
      if (emoji.startsWith('<') || emoji.length > 10) {
        return '📦';
      }
      return emoji;
    }
    
    const materials = Object.keys(inventory.categories[category]);
    const page = 0;
    const itemsPerPage = 25;
    const totalPages = Math.ceil(materials.length / itemsPerPage);
    const startIndex = page * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, materials.length);
    const pageMaterials = materials.slice(startIndex, endIndex);
    
    const materialOptions = pageMaterials.map(mat => ({
      label: mat,
      value: mat,
      emoji: validateEmoji(getItemIcon(mat, inventory))
    }));
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_recipe_material_standalone_${category}_${selectedItem}_1`)
      .setPlaceholder('재료 1을 선택하세요 (필수)')
      .addOptions(materialOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼 추가 (25개 초과 시)
    if (totalPages > 1) {
      const pageButtons = [];
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_prev_recipe_material_standalone_${category}_${selectedItem}_1_${page}`)
          .setLabel('◀ 이전')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0)
      );
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_info_recipe_material_standalone_${category}_${selectedItem}_1_${page}`)
          .setLabel(`페이지 ${page + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_next_recipe_material_standalone_${category}_${selectedItem}_1_${page}`)
          .setLabel('다음 ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1)
      );
      
      rows.push(new ActionRowBuilder().addComponents(pageButtons));
    }
    
    await interaction.update({
      content: `📝 ${selectedItem}\n레시피 추가\n\n**1단계:** 첫 번째 재료를 선택하세요${totalPages > 1 ? ` (${materials.length}개 중 ${startIndex + 1}-${endIndex}번째)` : ''}`,
      components: rows
    });
    
  } catch (error) {
    console.error('❌ 레시피 추가 제작품 선택 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
      console.error('❌ 레시피 추가 제작품 선택 에러 응답 실패:', err);
    });
  }
}

/**
 * 레시피 추가 재료 선택 핸들러 (독립 실행)
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeMaterialStandaloneSelect(interaction) {
  try {
    const parts = interaction.customId.replace('select_recipe_material_standalone_', '').split('_');
    const category = parts[0];
    const step = parseInt(parts[parts.length - 1]);
    const itemName = parts.slice(1, -1).join('_');
    const selectedMaterial = interaction.values[0];
    
    // 수량 입력 모달 표시
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
    
    const modal = new ModalBuilder()
      .setCustomId(`recipe_standalone_quantity_modal_${category}_${itemName}_${step}_${selectedMaterial}`)
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
    console.error('❌ 레시피 추가 재료 선택 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
      console.error('❌ 레시피 추가 재료 선택 에러 응답 실패:', err);
    });
  }
}
