// 관리(추가/수정) modal 핸들러
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { loadInventory, saveInventory } from '../../database-old.js';
import { formatQuantity, getItemIcon, addHistory, sanitizeInput, sanitizeNumber, isValidName } from '../../utils.js';

/**
 * Step 1: 물품/품목 추가 modal 핸들러 (이름 + 초기 수량)
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleAddItemModalStep1(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[4]; // 'inventory' or 'crafting'
    const category = parts.slice(5).join('_');
    
    // 입력값 sanitization
    const itemNameRaw = interaction.fields.getTextInputValue('item_name').trim();
    const itemName = sanitizeInput(itemNameRaw, { maxLength: 50 });
    
    // 이름 검증
    if (!isValidName(itemName)) {
      return await interaction.reply({ 
        content: '❌ 아이템 이름이 유효하지 않습니다. (한글, 영문, 숫자, 공백, -, _, ()만 사용 가능, 최대 50자)', 
        ephemeral: true 
      });
    }
    
    // 초기 수량 파싱
    const initialBoxesRaw = interaction.fields.getTextInputValue('initial_boxes')?.trim() || '0';
    const initialSetsRaw = interaction.fields.getTextInputValue('initial_sets')?.trim() || '0';
    const initialItemsRaw = interaction.fields.getTextInputValue('initial_items')?.trim() || '0';
    
    const initialBoxes = sanitizeNumber(initialBoxesRaw, { min: 0, max: 10000 });
    const initialSets = sanitizeNumber(initialSetsRaw, { min: 0, max: 100000 });
    const initialItems = sanitizeNumber(initialItemsRaw, { min: 0, max: 63 });
    
    if (initialBoxes === null || initialSets === null || initialItems === null) {
      return await interaction.reply({ 
        content: '❌ 수량을 올바르게 입력해주세요. (상자: 0-10000, 세트: 0-100000, 개: 0-63)', 
        ephemeral: true 
      });
    }
    
    const initialTotal = Math.round(initialBoxes * 3456) + Math.round(initialSets * 64) + Math.round(initialItems);
    
    // 아이템 중복 확인
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    
    if (!targetData) {
      return await interaction.reply({ 
        content: '❌ 데이터를 불러올 수 없습니다.', 
        ephemeral: true 
      });
    }
    
    if (!targetData[category]) {
      targetData[category] = {};
    }
    
    if (targetData[category][itemName]) {
      return await interaction.reply({ 
        content: `❌ "${itemName}" ${type === 'inventory' ? '아이템' : '제작품'}이 이미 존재합니다.`, 
        ephemeral: true 
      });
    }
    
    // Step 2 모달 표시
    const { ModalBuilder, TextInputBuilder, TextInputStyle } = await import('discord.js');
    
    const modal = new ModalBuilder()
      .setCustomId(`add_item_modal_step2_${type}_${category}_${itemName}_${initialTotal}`)
      .setTitle(`➕ ${type === 'inventory' ? '물품' : '품목'} 추가 (2/2) - ${category}`);
    
    const requiredBoxesInput = new TextInputBuilder()
      .setCustomId('required_boxes')
      .setLabel('목표 수량 - 상자 (1상자 = 54세트 = 3456개)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 0')
      .setValue('0')
      .setRequired(false);
    
    const requiredSetsInput = new TextInputBuilder()
      .setCustomId('required_sets')
      .setLabel('목표 수량 - 세트 (1세트 = 64개)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 0')
      .setValue('0')
      .setRequired(false);
    
    const requiredItemsInput = new TextInputBuilder()
      .setCustomId('required_items')
      .setLabel('목표 수량 - 낱개')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 0')
      .setValue('0')
      .setRequired(false);
    
    modal.addComponents(
      new ActionRowBuilder().addComponents(requiredBoxesInput),
      new ActionRowBuilder().addComponents(requiredSetsInput),
      new ActionRowBuilder().addComponents(requiredItemsInput)
    );
    
    await interaction.showModal(modal);
    
  } catch (error) {
    console.error('❌ Step 1 모달 제출 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ Step 1 모달 응답 실패:', err);
    });
  }
}

/**
 * Step 2: 물품/품목 추가 modal 핸들러 (목표 수량 + 최종 저장)
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleAddItemModalStep2(interaction) {
  try {
    // add_item_modal_step2_inventory_해양_산호_1234 형식 파싱
    const parts = interaction.customId.split('_');
    const type = parts[4]; // 'inventory' or 'crafting'
    const initialTotal = parseInt(parts[parts.length - 1]); // 마지막 부분이 초기 수량
    const itemName = parts[parts.length - 2]; // 마지막에서 두번째가 아이템명
    const category = parts.slice(5, -2).join('_'); // 중간 부분이 카테고리
    
    // 목표 수량 파싱
    const requiredBoxesRaw = interaction.fields.getTextInputValue('required_boxes')?.trim() || '0';
    const requiredSetsRaw = interaction.fields.getTextInputValue('required_sets')?.trim() || '0';
    const requiredItemsRaw = interaction.fields.getTextInputValue('required_items')?.trim() || '0';
    
    const requiredBoxes = sanitizeNumber(requiredBoxesRaw, { min: 0, max: 10000 });
    const requiredSets = sanitizeNumber(requiredSetsRaw, { min: 0, max: 100000 });
    const requiredItems = sanitizeNumber(requiredItemsRaw, { min: 0, max: 63 });
    
    if (requiredBoxes === null || requiredSets === null || requiredItems === null) {
      return await interaction.reply({ 
        content: '❌ 수량을 올바르게 입력해주세요. (상자: 0-10000, 세트: 0-100000, 개: 0-63)', 
        ephemeral: true 
      });
    }
    
    const requiredTotal = Math.round(requiredBoxes * 3456) + Math.round(requiredSets * 64) + Math.round(requiredItems);
    
    if (requiredTotal === 0) {
      return await interaction.reply({ 
        content: '❌ 목표 수량은 0보다 커야 합니다.', 
        ephemeral: true 
      });
    }
    
    // DB에 저장
    const inventory = await loadInventory();
    
    if (type === 'inventory') {
      if (!inventory.categories[category]) {
        inventory.categories[category] = {};
      }
      
      // 중복 체크 (Step 1과 Step 2 사이에 추가되었을 수 있음)
      if (inventory.categories[category][itemName]) {
        return await interaction.reply({ 
          content: `❌ "${itemName}" 아이템이 이미 존재합니다.`, 
          ephemeral: true 
        });
      }
      
      inventory.categories[category][itemName] = {
        quantity: initialTotal,
        required: requiredTotal
      };
      
      addHistory(inventory, 'inventory', category, itemName, 'add', 
        `초기: ${initialTotal}개, 목표: ${requiredTotal}개`, 
        interaction.user.displayName || interaction.user.username);
      
    } else {
      if (!inventory.crafting) {
        inventory.crafting = { categories: {}, crafting: {}, recipes: {} };
      }
      if (!inventory.crafting.categories[category]) {
        inventory.crafting.categories[category] = {};
      }
      
      if (inventory.crafting.categories[category][itemName]) {
        return await interaction.reply({ 
          content: `❌ "${itemName}" 제작품이 이미 존재합니다.`, 
          ephemeral: true 
        });
      }
      
      inventory.crafting.categories[category][itemName] = {
        quantity: initialTotal,
        required: requiredTotal
      };
      
      addHistory(inventory, 'crafting', category, itemName, 'add', 
        `초기: ${initialTotal}개, 목표: ${requiredTotal}개`, 
        interaction.user.displayName || interaction.user.username);
    }
    
    await saveInventory(inventory);
    
    const icon = getItemIcon(itemName, inventory);
    const initialFormatted = formatQuantity(initialTotal);
    const requiredFormatted = formatQuantity(requiredTotal);
    
    // 제작 품목인 경우 레시피 입력 버튼 추가
    if (type === 'crafting') {
      const addRecipeButton = new ButtonBuilder()
        .setCustomId(`add_recipe_${category}_${itemName}`)
        .setLabel('📝 레시피 추가')
        .setStyle(ButtonStyle.Primary);
      
      const skipButton = new ButtonBuilder()
        .setCustomId(`skip_recipe_${category}_${itemName}`)
        .setLabel('⏭️ 나중에 추가')
        .setStyle(ButtonStyle.Secondary);
      
      const row = new ActionRowBuilder().addComponents(addRecipeButton, skipButton);
      
      const successEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ 제작품 추가 완료')
        .setDescription(`**카테고리:** ${category}\n${icon} **${itemName}**이(가) 추가되었습니다!\n\n**초기 수량:** ${initialTotal}개 (${initialFormatted.items}개/${initialFormatted.sets}세트/${initialFormatted.boxes}상자)\n**목표 수량:** ${requiredTotal}개 (${requiredFormatted.items}개/${requiredFormatted.sets}세트/${requiredFormatted.boxes}상자)\n\n레시피를 추가하시겠습니까?`);
      
      await interaction.reply({ embeds: [successEmbed], components: [row], ephemeral: true });
    } else {
      const successEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ 추가 완료')
        .setDescription(`**카테고리:** ${category}\n${icon} **${itemName}**이(가) 추가되었습니다!\n\n**초기 수량:** ${initialTotal}개 (${initialFormatted.items}개/${initialFormatted.sets}세트/${initialFormatted.boxes}상자)\n**목표 수량:** ${requiredTotal}개 (${requiredFormatted.items}개/${requiredFormatted.sets}세트/${requiredFormatted.boxes}상자)`);
      
      await interaction.reply({ embeds: [successEmbed], ephemeral: true, fetchReply: true });
      
      // 15초 후 자동 삭제
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {}
      }, 15000);
    }
    
  } catch (error) {
    console.error('❌ Step 2 모달 제출 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ Step 2 모달 응답 실패:', err);
    });
  }
}

/**
 * 이름 수정 modal 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleEditNameModal(interaction) {
  try {
    const parts = interaction.customId.replace('edit_name_modal_', '').split('_');
    const type = parts[0];
    const category = parts[1];
    const oldName = parts.slice(2).join('_');
    
    // 입력값 sanitization
    const newNameRaw = interaction.fields.getTextInputValue('new_name').trim();
    const newName = sanitizeInput(newNameRaw, { maxLength: 50 });
    
    // 이름 검증
    if (!isValidName(newName)) {
      return await interaction.reply({ 
        content: '❌ 새 이름이 유효하지 않습니다. (한글, 영문, 숫자, 공백, -, _, ()만 사용 가능, 최대 50자)', 
        ephemeral: true 
      });
    }
    
    if (oldName === newName) {
      return await interaction.reply({ 
        content: '❌ 기존 이름과 동일합니다.', 
        ephemeral: true 
      });
    }
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    
    if (!targetData?.[category]?.[oldName]) {
      return await interaction.reply({ 
        content: `❌ "${oldName}"을(를) 찾을 수 없습니다.`, 
        ephemeral: true 
      });
    }
    
    if (targetData[category][newName]) {
      return await interaction.reply({ 
        content: `❌ "${newName}"은(는) 이미 존재합니다.`, 
        ephemeral: true 
      });
    }
    
    // 이름 변경
    targetData[category][newName] = targetData[category][oldName];
    delete targetData[category][oldName];
    
    // 레시피도 함께 변경 (제작품인 경우)
    let recipeUpdated = false;
    if (type === 'crafting' && inventory.crafting?.recipes?.[category]?.[oldName]) {
      inventory.crafting.recipes[category][newName] = inventory.crafting.recipes[category][oldName];
      delete inventory.crafting.recipes[category][oldName];
      recipeUpdated = true;
    }
    
    // 태그도 함께 변경
    if (inventory.tags?.[type]?.[category]) {
      for (const [tagName, items] of Object.entries(inventory.tags[type][category])) {
        const index = items.indexOf(oldName);
        if (index !== -1) {
          items[index] = newName;
        }
      }
    }
    
    addHistory(inventory, type, category, newName, 'rename', 
      `"${oldName}" → "${newName}"${recipeUpdated ? ' (레시피 포함)' : ''}`, 
      interaction.user.displayName || interaction.user.username);
    
    await saveInventory(inventory);
    
    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ 이름 수정 완료')
      .setDescription(`**카테고리:** ${category}\n**${oldName}** → **${newName}**${recipeUpdated ? '\n🔄 레시피도 함께 변경되었습니다.' : ''}`);
    
    await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, 15000);
    
  } catch (error) {
    console.error('❌ 이름 수정 모달 제출 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 이름 수정 모달 응답 실패:', err);
    });
  }
}
