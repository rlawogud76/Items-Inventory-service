// 레시피 modal 핸들러
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { loadInventory, saveInventory } from '../../database-old.js';
import { getItemIcon } from '../../utils.js';

/**
 * 레시피 수정 수량 modal 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeEditQuantityModal(interaction) {
  try {
    const parts = interaction.customId.replace('recipe_edit_quantity_modal_', '').split('_');
    const category = parts[0];
    const step = parseInt(parts[parts.length - 2]);
    const materialName = parts[parts.length - 1];
    const itemName = parts.slice(1, -2).join('_');
    
    const quantity = parseInt(interaction.fields.getTextInputValue('material_quantity').trim());
    
    if (isNaN(quantity) || quantity <= 0) {
      return await interaction.reply({
        content: '❌ 올바른 수량을 입력해주세요. (1 이상의 숫자)',
        ephemeral: true
      });
    }
    
    const inventory = await loadInventory();
    
    // 첫 번째 재료면 레시피 초기화
    if (step === 1) {
      inventory.crafting.recipes[category][itemName] = [];
    }
    
    // 재료 추가
    inventory.crafting.recipes[category][itemName].push({
      name: materialName,
      quantity: quantity,
      category: category
    });
    
    await saveInventory(inventory);
    
    const icon = getItemIcon(materialName, inventory);
    
    // 다음 재료 추가 또는 완료
    if (step < 7) {
      const addMoreButton = new ButtonBuilder()
        .setCustomId(`add_more_recipe_edit_${category}_${itemName}_${step + 1}`)
        .setLabel(`➕ 재료 ${step + 1} 추가`)
        .setStyle(ButtonStyle.Primary);
      
      const finishButton = new ButtonBuilder()
        .setCustomId(`finish_recipe_edit_${category}_${itemName}`)
        .setLabel('✅ 완료')
        .setStyle(ButtonStyle.Success);
      
      const row = new ActionRowBuilder().addComponents(addMoreButton, finishButton);
      
      const currentRecipe = inventory.crafting.recipes[category][itemName]
        .map(m => `${getItemIcon(m.name, inventory)} ${m.name} x${m.quantity}`)
        .join('\n');
      
      await interaction.reply({
        content: `✅ 재료 ${step} 추가 완료: ${icon} ${materialName} x${quantity}\n\n**현재 레시피:**\n${currentRecipe}\n\n더 추가하시겠습니까? (최대 7개)`,
        components: [row],
        ephemeral: true
      });
    } else {
      const currentRecipe = inventory.crafting.recipes[category][itemName]
        .map(m => `${getItemIcon(m.name, inventory)} ${m.name} x${m.quantity}`)
        .join('\n');
      
      await interaction.reply({
        content: `✅ ${itemName}\n레시피 수정 완료!\n\n**새 레시피:**\n${currentRecipe}`,
        ephemeral: true
      });
      
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {}
      }, 15000);
    }
    
  } catch (error) {
    console.error('❌ 레시피 수정 모달 제출 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 레시피 수정 모달 응답 실패:', err);
    });
  }
}

/**
 * 레시피 수량 modal 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeQuantityModal(interaction) {
  try {
    const parts = interaction.customId.replace('recipe_quantity_modal_', '').split('_');
    const category = parts[0];
    const step = parseInt(parts[parts.length - 2]);
    const materialName = parts[parts.length - 1];
    const itemName = parts.slice(1, -2).join('_');
    
    const quantity = parseInt(interaction.fields.getTextInputValue('material_quantity').trim());
    
    if (isNaN(quantity) || quantity <= 0) {
      return await interaction.reply({
        content: '❌ 올바른 수량을 입력해주세요. (1 이상의 숫자)',
        ephemeral: true
      });
    }
    
    const inventory = await loadInventory();
    
    // 레시피 구조 초기화
    if (!inventory.crafting.recipes) inventory.crafting.recipes = {};
    if (!inventory.crafting.recipes[category]) inventory.crafting.recipes[category] = {};
    
    // 첫 번째 재료면 레시피 초기화
    if (step === 1) {
      inventory.crafting.recipes[category][itemName] = [];
    }
    
    // 재료 추가
    inventory.crafting.recipes[category][itemName].push({
      name: materialName,
      quantity: quantity,
      category: category
    });
    
    await saveInventory(inventory);
    
    const icon = getItemIcon(materialName, inventory);
    
    // 다음 재료 추가 또는 완료
    if (step < 7) {
      const addMoreButton = new ButtonBuilder()
        .setCustomId(`add_more_recipe_${category}_${itemName}_${step + 1}`)
        .setLabel(`➕ 재료 ${step + 1} 추가`)
        .setStyle(ButtonStyle.Primary);
      
      const finishButton = new ButtonBuilder()
        .setCustomId(`finish_recipe_${category}_${itemName}`)
        .setLabel('✅ 완료')
        .setStyle(ButtonStyle.Success);
      
      const row = new ActionRowBuilder().addComponents(addMoreButton, finishButton);
      
      const currentRecipe = inventory.crafting.recipes[category][itemName]
        .map(m => `${getItemIcon(m.name, inventory)} ${m.name} x${m.quantity}`)
        .join('\n');
      
      await interaction.reply({
        content: `✅ 재료 ${step} 추가 완료: ${icon} ${materialName} x${quantity}\n\n**현재 레시피:**\n${currentRecipe}\n\n더 추가하시겠습니까? (최대 7개)`,
        components: [row],
        ephemeral: true
      });
    } else {
      const currentRecipe = inventory.crafting.recipes[category][itemName]
        .map(m => `${getItemIcon(m.name, inventory)} ${m.name} x${m.quantity}`)
        .join('\n');
      
      await interaction.reply({
        content: `✅ ${itemName}\n레시피 추가 완료!\n\n**레시피:**\n${currentRecipe}`,
        ephemeral: true
      });
      
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {}
      }, 15000);
    }
    
  } catch (error) {
    console.error('❌ 레시피 수량 모달 제출 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 레시피 수량 모달 응답 실패:', err);
    });
  }
}

/**
 * 레시피 추가 수량 modal 핸들러 (독립 실행)
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeStandaloneQuantityModal(interaction) {
  try {
    const parts = interaction.customId.replace('recipe_standalone_quantity_modal_', '').split('_');
    const category = parts[0];
    const step = parseInt(parts[parts.length - 2]);
    const materialName = parts[parts.length - 1];
    const itemName = parts.slice(1, -2).join('_');
    
    const quantity = parseInt(interaction.fields.getTextInputValue('material_quantity').trim());
    
    if (isNaN(quantity) || quantity <= 0) {
      return await interaction.reply({
        content: '❌ 올바른 수량을 입력해주세요. (1 이상의 숫자)',
        ephemeral: true
      });
    }
    
    const inventory = await loadInventory();
    
    // 레시피 구조 초기화
    if (!inventory.crafting.recipes) inventory.crafting.recipes = {};
    if (!inventory.crafting.recipes[category]) inventory.crafting.recipes[category] = {};
    
    // 첫 번째 재료면 레시피 초기화
    if (step === 1) {
      inventory.crafting.recipes[category][itemName] = [];
    }
    
    // 재료 추가
    inventory.crafting.recipes[category][itemName].push({
      name: materialName,
      quantity: quantity,
      category: category
    });
    
    await saveInventory(inventory);
    
    const icon = getItemIcon(materialName, inventory);
    
    // 다음 재료 추가 또는 완료
    if (step < 7) {
      const addMoreButton = new ButtonBuilder()
        .setCustomId(`add_more_recipe_standalone_${category}_${itemName}_${step + 1}`)
        .setLabel(`➕ 재료 ${step + 1} 추가`)
        .setStyle(ButtonStyle.Primary);
      
      const finishButton = new ButtonBuilder()
        .setCustomId(`finish_recipe_standalone_${category}_${itemName}`)
        .setLabel('✅ 완료')
        .setStyle(ButtonStyle.Success);
      
      const row = new ActionRowBuilder().addComponents(addMoreButton, finishButton);
      
      const currentRecipe = inventory.crafting.recipes[category][itemName]
        .map(m => `${getItemIcon(m.name, inventory)} ${m.name} x${m.quantity}`)
        .join('\n');
      
      await interaction.reply({
        content: `✅ 재료 ${step} 추가 완료: ${icon} ${materialName} x${quantity}\n\n**현재 레시피:**\n${currentRecipe}\n\n더 추가하시겠습니까? (최대 7개)`,
        components: [row],
        ephemeral: true
      });
    } else {
      const currentRecipe = inventory.crafting.recipes[category][itemName]
        .map(m => `${getItemIcon(m.name, inventory)} ${m.name} x${m.quantity}`)
        .join('\n');
      
      await interaction.reply({
        content: `✅ ${itemName}\n레시피 추가 완료!\n\n**레시피:**\n${currentRecipe}`,
        ephemeral: true
      });
      
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {}
      }, 15000);
    }
    
  } catch (error) {
    console.error('❌ 레시피 추가 모달 제출 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 레시피 추가 모달 응답 실패:', err);
    });
  }
}
