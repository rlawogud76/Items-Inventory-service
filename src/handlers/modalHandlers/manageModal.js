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
    
    // Step 1.5로 넘어가는 버튼 표시 (물품 유형 선택)
    const initialFormatted = formatQuantity(initialTotal);
    
    const continueButton = new ButtonBuilder()
      .setCustomId(`add_item_type_btn_${type}_${category}_${itemName}_${initialTotal}`)
      .setLabel('➡️ 다음: 물품 유형 선택')
      .setStyle(ButtonStyle.Primary);
    
    const row = new ActionRowBuilder().addComponents(continueButton);
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`✅ Step 1 완료`)
      .setDescription(`**아이템:** ${itemName}\n**초기 수량:** ${initialTotal}개 (${initialFormatted.items}개/${initialFormatted.sets}세트/${initialFormatted.boxes}상자)\n\n다음 버튼을 눌러 물품 유형을 선택하세요.`);
    
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    
    // 30초 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, 30000);
    
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
    // add_item_modal_step2_inventory_해양_산호_1234_material 형식 파싱
    const parts = interaction.customId.split('_');
    const type = parts[4]; // 'inventory' or 'crafting'
    const itemType = parts[parts.length - 1]; // 'material', 'intermediate', 'final'
    const initialTotal = parseInt(parts[parts.length - 2]); // 마지막에서 두번째가 초기 수량
    const itemName = parts[parts.length - 3]; // 마지막에서 세번째가 아이템명
    const category = parts.slice(5, -3).join('_'); // 중간 부분이 카테고리
    
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
    
    // DB에 저장 (물품 유형에 따른 처리)
    const inventory = await loadInventory();
    
    if (type === 'inventory') {
      if (!inventory.categories[category]) {
        inventory.categories[category] = {};
      }
      
      // 중복 체크
      if (inventory.categories[category][itemName]) {
        return await interaction.reply({ 
          content: `❌ "${itemName}" 아이템이 이미 존재합니다.`, 
          ephemeral: true 
        });
      }
      
      inventory.categories[category][itemName] = {
        quantity: initialTotal,
        required: requiredTotal,
        itemType: itemType || 'material'
      };
      
      // 중간 제작품인 경우 제작 레시피도 준비
      if (itemType === 'intermediate') {
        if (!inventory.crafting) {
          inventory.crafting = { categories: {}, recipes: {} };
        }
        if (!inventory.crafting.categories[category]) {
          inventory.crafting.categories[category] = {};
        }
        // 연동 정보 저장
        inventory.categories[category][itemName].linkedItem = `crafting/${category}/${itemName}`;
      }
      
      addHistory(inventory, 'inventory', category, itemName, 'add', 
        `초기: ${initialTotal}개, 목표: ${requiredTotal}개, 유형: ${itemType}`, 
        interaction.user.displayName || interaction.user.username);
      
    } else {
      if (!inventory.crafting) {
        inventory.crafting = { categories: {}, recipes: {} };
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
        required: requiredTotal,
        itemType: itemType || 'final'
      };
      
      // 중간 제작품인 경우 재고와 연동
      if (itemType === 'intermediate') {
        if (!inventory.categories[category]) {
          inventory.categories[category] = {};
        }
        if (!inventory.categories[category][itemName]) {
          inventory.categories[category][itemName] = {
            quantity: initialTotal,
            required: requiredTotal,
            itemType: 'intermediate',
            linkedItem: `crafting/${category}/${itemName}`
          };
        }
        inventory.crafting.categories[category][itemName].linkedItem = `inventory/${category}/${itemName}`;
      }
      
      addHistory(inventory, 'crafting', category, itemName, 'add', 
        `초기: ${initialTotal}개, 목표: ${requiredTotal}개, 유형: ${itemType}`, 
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
        .setDescription(`**카테고리:** ${category}\n${icon} ${itemName}\n이(가) 추가되었습니다!\n\n**초기 수량:** ${initialTotal}개 (${initialFormatted.items}개/${initialFormatted.sets}세트/${initialFormatted.boxes}상자)\n**목표 수량:** ${requiredTotal}개 (${requiredFormatted.items}개/${requiredFormatted.sets}세트/${requiredFormatted.boxes}상자)\n\n레시피를 추가하시겠습니까?`);
      
      await interaction.reply({ embeds: [successEmbed], components: [row], ephemeral: true });
    } else {
      const successEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ 추가 완료')
        .setDescription(`**카테고리:** ${category}\n${icon} ${itemName}\n이(가) 추가되었습니다!\n\n**초기 수량:** ${initialTotal}개 (${initialFormatted.items}개/${initialFormatted.sets}세트/${initialFormatted.boxes}상자)\n**목표 수량:** ${requiredTotal}개 (${requiredFormatted.items}개/${requiredFormatted.sets}세트/${requiredFormatted.boxes}상자)`);
      
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
      .setDescription(`**카테고리:** ${category}\n${oldName} → ${newName}\n${recipeUpdated ? '🔄 레시피도 함께 변경되었습니다.' : ''}`);
    
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
/**
 * Step 1.5: 물품 유형 선택 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleAddItemTypeButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[4]; // 'inventory' or 'crafting'
    const initialTotal = parseInt(parts[parts.length - 1]); // 마지막 부분이 초기 수량
    const itemName = parts[parts.length - 2]; // 마지막에서 두번째가 아이템명
    const category = parts.slice(5, -2).join('_'); // 중간 부분이 카테고리
    
    // 물품 유형 선택 메뉴 생성
    const { StringSelectMenuBuilder } = await import('discord.js');
    const itemTypeSelect = new StringSelectMenuBuilder()
      .setCustomId(`select_item_type_${type}_${category}_${itemName}_${initialTotal}`)
      .setPlaceholder('물품 유형을 선택하세요')
      .addOptions([
        {
          label: '📦 재료',
          value: 'material',
          description: '채굴/수집하는 기본 재료 (재고에만 등록)',
          emoji: '📦'
        },
        {
          label: '🔄 중간 제작품',
          value: 'intermediate', 
          description: '제작하며, 다른 제작의 재료로도 사용 (재고+제작 연동)',
          emoji: '🔄'
        },
        {
          label: '⭐ 최종 제작품',
          value: 'final',
          description: '최종 완성품, 재료로 사용 안함 (제작에만 등록)',
          emoji: '⭐'
        }
      ]);
    
    const row = new ActionRowBuilder().addComponents(itemTypeSelect);
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`🔄 Step 1.5: 물품 유형 선택`)
      .setDescription([
        `**아이템:** ${itemName}`,
        `**카테고리:** ${category}`,
        ``,
        `물품의 용도에 따라 유형을 선택하세요:`,
        ``,
        `📦 **재료** - 기본 재료 (철광석, 나무 등)`,
        `🔄 **중간 제작품** - 제작하면서 재료로도 사용 (철괴, 판자 등)`,
        `⭐ **최종 제작품** - 완성품 (검, 갑옷, 음식 등)`
      ].join('\n'));
    
    await interaction.update({ embeds: [embed], components: [row] });
    
  } catch (error) {
    console.error('❌ 물품 유형 선택 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}