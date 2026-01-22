// 관리(추가/수정) modal 핸들러
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { loadInventory, saveInventory } from '../../database.js';
import { formatQuantity, getItemIcon, addHistory, sanitizeInput, sanitizeNumber, isValidName } from '../../utils.js';

/**
 * 물품/품목 추가 modal 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleAddItemModal(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[3]; // 'inventory' or 'crafting'
    const category = parts.slice(4).join('_');
    
    // 입력값 sanitization
    const itemNameRaw = interaction.fields.getTextInputValue('item_name').trim();
    const itemName = sanitizeInput(itemNameRaw, { maxLength: 50 });
    
    const initialSets = interaction.fields.getTextInputValue('initial_sets')?.trim() || '0';
    const initialItems = interaction.fields.getTextInputValue('initial_items')?.trim() || '0';
    const requiredSets = interaction.fields.getTextInputValue('required_sets')?.trim() || '0';
    const requiredItems = interaction.fields.getTextInputValue('required_items')?.trim() || '0';
    
    // 이름 검증
    if (!isValidName(itemName)) {
      return await interaction.reply({ 
        content: '❌ 아이템 이름이 유효하지 않습니다. (한글, 영문, 숫자, 공백, -, _, ()만 사용 가능, 최대 50자)', 
        ephemeral: true 
      });
    }
    
    // 숫자 검증
    const initialSetsNum = sanitizeNumber(initialSets, { min: 0, max: 100000 });
    const initialItemsNum = sanitizeNumber(initialItems, { min: 0, max: 63 });
    const requiredSetsNum = sanitizeNumber(requiredSets, { min: 0, max: 100000 });
    const requiredItemsNum = sanitizeNumber(requiredItems, { min: 0, max: 63 });
    
    if (initialSetsNum === null || initialItemsNum === null || requiredSetsNum === null || requiredItemsNum === null) {
      return await interaction.reply({ 
        content: '❌ 수량을 올바르게 입력해주세요. (세트: 0-100000, 개: 0-63)', 
        ephemeral: true 
      });
    }
    
    const initialQty = (initialSetsNum * 64) + initialItemsNum;
    const requiredQty = (requiredSetsNum * 64) + requiredItemsNum;
    
    if (requiredQty === 0) {
      return await interaction.reply({ 
        content: '❌ 충족 수량은 0보다 커야 합니다.', 
        ephemeral: true 
      });
    }
    
    const inventory = await loadInventory();
    
    if (type === 'inventory') {
      if (!inventory.categories[category]) {
        inventory.categories[category] = {};
      }
      
      if (inventory.categories[category][itemName]) {
        return await interaction.reply({ 
          content: `❌ "${itemName}" 아이템이 이미 존재합니다.`, 
          ephemeral: true 
        });
      }
      
      inventory.categories[category][itemName] = {
        quantity: initialQty,
        required: requiredQty
      };
      
      addHistory(inventory, 'inventory', category, itemName, 'add', 
        `초기: ${initialQty}개, 목표: ${requiredQty}개`, 
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
        quantity: initialQty,
        required: requiredQty
      };
      
      addHistory(inventory, 'crafting', category, itemName, 'add', 
        `초기: ${initialQty}개, 목표: ${requiredQty}개`, 
        interaction.user.displayName || interaction.user.username);
    }
    
    await saveInventory(inventory);
    
    const icon = getItemIcon(itemName, inventory);
    const initialFormatted = formatQuantity(initialQty);
    const requiredFormatted = formatQuantity(requiredQty);
    
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
        .setDescription(`**카테고리:** ${category}\n${icon} **${itemName}**이(가) 추가되었습니다!\n\n**초기 수량:** ${initialQty}개 (${initialFormatted.items}개/${initialFormatted.sets}세트/${initialFormatted.boxes}상자)\n**충족 수량:** ${requiredQty}개 (${requiredFormatted.items}개/${requiredFormatted.sets}세트/${requiredFormatted.boxes}상자)\n\n레시피를 추가하시겠습니까?`);
      
      await interaction.reply({ embeds: [successEmbed], components: [row], ephemeral: true });
    } else {
      const successEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ 추가 완료')
        .setDescription(`**카테고리:** ${category}\n${icon} **${itemName}**이(가) 추가되었습니다!\n\n**초기 수량:** ${initialQty}개 (${initialFormatted.items}개/${initialFormatted.sets}세트/${initialFormatted.boxes}상자)\n**충족 수량:** ${requiredQty}개 (${requiredFormatted.items}개/${requiredFormatted.sets}세트/${requiredFormatted.boxes}상자)`);
      
      await interaction.reply({ embeds: [successEmbed], ephemeral: true, fetchReply: true });
      
      // 15초 후 자동 삭제
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {}
      }, 15000);
    }
    
  } catch (error) {
    console.error('❌ 아이템 추가 모달 제출 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 아이템 추가 모달 응답 실패:', err);
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
