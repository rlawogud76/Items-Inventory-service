// 관리(추가/수정) modal 핸들러
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { loadInventory, addItem, updateItemDetails } from '../../database.js';
import { formatQuantity, getItemIcon, addHistory, sanitizeInput, sanitizeNumber, isValidName, getTimeoutSettings } from '../../utils.js';
import { STACK, LIMITS } from '../../constants.js';

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
    const itemName = sanitizeInput(itemNameRaw, { maxLength: LIMITS.NAME_MAX_LENGTH });
    
    // 이름 검증
    if (!isValidName(itemName)) {
      return await interaction.reply({ 
        content: `❌ 아이템 이름이 유효하지 않습니다. (한글, 영문, 숫자, 공백, -, _, ()만 사용 가능, 최대 ${LIMITS.NAME_MAX_LENGTH}자)`, 
        ephemeral: true 
      });
    }
    
    // 초기 수량 파싱
    const initialBoxesRaw = interaction.fields.getTextInputValue('initial_boxes')?.trim() || '0';
    const initialSetsRaw = interaction.fields.getTextInputValue('initial_sets')?.trim() || '0';
    const initialItemsRaw = interaction.fields.getTextInputValue('initial_items')?.trim() || '0';
    
    const initialBoxes = sanitizeNumber(initialBoxesRaw, { min: 0, max: LIMITS.MAX_BOXES });
    const initialSets = sanitizeNumber(initialSetsRaw, { min: 0, max: LIMITS.MAX_SETS });
    const initialItems = sanitizeNumber(initialItemsRaw, { min: 0, max: LIMITS.MAX_ITEMS });
    
    if (initialBoxes === null || initialSets === null || initialItems === null) {
      return await interaction.reply({ 
        content: `❌ 수량을 올바르게 입력해주세요. (상자: 0-${LIMITS.MAX_BOXES}, 세트: 0-${LIMITS.MAX_SETS}, 개: 0-${LIMITS.MAX_ITEMS})`, 
        ephemeral: true 
      });
    }
    
    const initialTotal = Math.round(initialBoxes * STACK.ITEMS_PER_BOX) + Math.round(initialSets * STACK.ITEMS_PER_SET) + Math.round(initialItems);
    
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
      .setDescription(`**아이템:** ${itemName}\n**초기 수량:** ${initialTotal}개 (${initialFormatted.items}개/${initialFormatted.sets}세트/${initialFormatted.boxes}상자)\n\n다음 버튼을 눌러 물품 유형을 선택하세요.\n\n_이 메시지는 30초 후 자동 삭제됩니다_`);
    
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    
    // 설정된 시간 후 자동 삭제
    const { selectTimeout } = getTimeoutSettings(inventory);
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, selectTimeout);
    
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
    
    const requiredBoxes = sanitizeNumber(requiredBoxesRaw, { min: 0, max: LIMITS.MAX_BOXES });
    const requiredSets = sanitizeNumber(requiredSetsRaw, { min: 0, max: LIMITS.MAX_SETS });
    const requiredItems = sanitizeNumber(requiredItemsRaw, { min: 0, max: LIMITS.MAX_ITEMS });
    
    if (requiredBoxes === null || requiredSets === null || requiredItems === null) {
      return await interaction.reply({ 
        content: `❌ 수량을 올바르게 입력해주세요. (상자: 0-${LIMITS.MAX_BOXES}, 세트: 0-${LIMITS.MAX_SETS}, 개: 0-${LIMITS.MAX_ITEMS})`, 
        ephemeral: true 
      });
    }
    
    const requiredTotal = Math.round(requiredBoxes * STACK.ITEMS_PER_BOX) + Math.round(requiredSets * STACK.ITEMS_PER_SET) + Math.round(requiredItems);
    
    if (requiredTotal === 0) {
      return await interaction.reply({ 
        content: '❌ 목표 수량은 0보다 커야 합니다.', 
        ephemeral: true 
      });
    }
    
    // DB에 저장 (물품 유형에 따른 처리)
    // const inventory = await loadInventory(); // 중복 체크는 addItem에서 수행됨
    
    if (type === 'inventory') {
      try {
        // 1. 일반 아이템 추가
        await addItem({
          name: itemName,
          category: category,
          type: 'inventory',
          itemType: itemType || 'material',
          quantity: initialTotal,
          required: requiredTotal,
          linkedItem: itemType === 'intermediate' ? `crafting/${category}/${itemName}` : null
        });
        
        // 2. 중간 제작품인 경우 제작 섹션에도 추가
        if (itemType === 'intermediate') {
          await addItem({
            name: itemName,
            category: category,
            type: 'crafting',
            itemType: 'intermediate',
            quantity: initialTotal,
            required: requiredTotal,
            linkedItem: `inventory/${category}/${itemName}`
          });
        }
        
        await addHistory('inventory', category, itemName, 'add',
          `초기: ${initialTotal}개, 목표: ${requiredTotal}개, 유형: ${itemType}`,
          interaction.user.displayName || interaction.user.username);
          
      } catch (error) {
        if (error.message.includes('이미 존재')) {
          return await interaction.reply({ 
            content: `❌ "${itemName}" 아이템이 이미 존재합니다.`, 
            ephemeral: true 
          });
        }
        throw error;
      }
      
    } else {
      try {
        // 1. 제작품 추가
        await addItem({
          name: itemName,
          category: category,
          type: 'crafting',
          itemType: itemType || 'final',
          quantity: initialTotal,
          required: requiredTotal,
          linkedItem: itemType === 'intermediate' ? `inventory/${category}/${itemName}` : null
        });
        
        // 2. 중간 제작품인 경우 재고 섹션에도 추가
        if (itemType === 'intermediate') {
          await addItem({
            name: itemName,
            category: category,
            type: 'inventory',
            itemType: 'intermediate',
            quantity: initialTotal,
            required: requiredTotal,
            linkedItem: `crafting/${category}/${itemName}`
          });
        }
        
        await addHistory('crafting', category, itemName, 'add',
          `초기: ${initialTotal}개, 목표: ${requiredTotal}개, 유형: ${itemType}`,
          interaction.user.displayName || interaction.user.username);
          
      } catch (error) {
        if (error.message.includes('이미 존재')) {
          return await interaction.reply({ 
            content: `❌ "${itemName}" 제작품이 이미 존재합니다.`, 
            ephemeral: true 
          });
        }
        throw error;
      }
    }
    
    
    // 임베드 생성용 재고 로드 (아이콘 등 확인)
    const inventory = await loadInventory();
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
        .setDescription(`**카테고리:** ${category}\n${icon} ${itemName}\n이(가) 추가되었습니다!\n\n**초기 수량:** ${initialTotal}개 (${initialFormatted.items}개/${initialFormatted.sets}세트/${initialFormatted.boxes}상자)\n**목표 수량:** ${requiredTotal}개 (${requiredFormatted.items}개/${requiredFormatted.sets}세트/${requiredFormatted.boxes}상자)\n\n_이 메시지는 15초 후 자동 삭제됩니다_`);
      
      await interaction.reply({ embeds: [successEmbed], ephemeral: true, fetchReply: true });
      
      // 설정된 시간 후 자동 삭제
      const { infoTimeout } = getTimeoutSettings(inventory);
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {}
      }, infoTimeout);
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
    const newName = sanitizeInput(newNameRaw, { maxLength: LIMITS.NAME_MAX_LENGTH });
    
    // 이름 검증
    if (!isValidName(newName)) {
      return await interaction.reply({ 
        content: `❌ 새 이름이 유효하지 않습니다. (한글, 영문, 숫자, 공백, -, _, ()만 사용 가능, 최대 ${LIMITS.NAME_MAX_LENGTH}자)`, 
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
    
    // 이름 변경 (DB 반영)
    // updateItemDetails가 레시피 이름 변경 및 태그 내 이름 업데이트도 처리함
    await updateItemDetails(type, category, oldName, { name: newName });
    
    const recipeUpdated = type === 'crafting' && inventory.crafting?.recipes?.[category]?.[oldName];

    await addHistory(type, category, newName, 'rename',
      `"${oldName}" → "${newName}"${recipeUpdated ? ' (레시피 포함)' : ''}`,
      interaction.user.displayName || interaction.user.username);
    
    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ 이름 수정 완료')
      .setDescription(`**카테고리:** ${category}\n${oldName} → ${newName}\n${recipeUpdated ? '🔄 레시피도 함께 변경되었습니다.' : ''}\n\n_이 메시지는 15초 후 자동 삭제됩니다_`);
    
    await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    
    const { infoTimeout } = getTimeoutSettings(inventory);
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, infoTimeout);
    
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

/**
 * 순서 변경 모달 제출 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleReorderModal(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.slice(3).join('_');
    
    const newOrderInput = interaction.fields.getTextInputValue('new_order').trim();
    
    const inventory = await loadInventory();
    const { infoTimeout } = getTimeoutSettings(inventory);
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    const items = Object.keys(targetData[category]);
    
    // 입력 파싱 (쉼표로 구분된 번호)
    const newOrderNumbers = newOrderInput.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    
    // 검증
    if (newOrderNumbers.length !== items.length) {
      return await interaction.reply({
        content: `❌ 입력한 번호 개수(${newOrderNumbers.length}개)가 항목 개수(${items.length}개)와 일치하지 않습니다.\n\n_이 메시지는 ${infoTimeout/1000}초 후 자동 삭제됩니다_`,
        ephemeral: true
      }).then(() => {
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {}
        }, infoTimeout);
      });
    }
    
    // 1부터 items.length까지의 모든 번호가 있는지 확인
    const sortedNumbers = [...newOrderNumbers].sort((a, b) => a - b);
    const expectedNumbers = Array.from({ length: items.length }, (_, i) => i + 1);
    const isValid = sortedNumbers.every((num, idx) => num === expectedNumbers[idx]);
    
    if (!isValid) {
      return await interaction.reply({
        content: `❌ 잘못된 번호가 있습니다. 1부터 ${items.length}까지의 번호를 모두 사용해야 합니다.\n\n_이 메시지는 ${infoTimeout/1000}초 후 자동 삭제됩니다_`,
        ephemeral: true
      }).then(() => {
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {}
        }, infoTimeout);
      });
    }
    
    // 새로운 순서로 재배열
    const newItems = newOrderNumbers.map(num => items[num - 1]);
    
    // 데이터베이스 업데이트
    const { saveInventory } = await import('../../database.js');
    const newCategoryData = {};
    
    newItems.forEach((itemName, newIndex) => {
      const itemData = targetData[category][itemName];
      itemData.order = newIndex;
      newCategoryData[itemName] = itemData;
    });
    
    // 카테고리 데이터 교체
    if (type === 'inventory') {
      inventory.categories[category] = newCategoryData;
    } else {
      inventory.crafting.categories[category] = newCategoryData;
    }
    
    inventory.markModified('categories');
    inventory.markModified('crafting');
    await saveInventory(inventory);
    
    // 히스토리 기록
    const { addHistory } = await import('../../database.js');
    await addHistory(interaction.user.id, 'reorder', type, category, null, `순서 변경 (수동)`);
    
    // 성공 메시지
    let successMessage = `✅ **${category}** 카테고리 순서가 변경되었습니다!\n\n**새로운 순서:**\n`;
    newItems.forEach((item, idx) => {
      successMessage += `${idx + 1}. ${item}\n`;
    });
    successMessage += `\n_이 메시지는 ${infoTimeout/1000}초 후 자동 삭제됩니다_`;
    
    await interaction.reply({
      content: successMessage,
      ephemeral: true
    });
    
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, infoTimeout);
    
    console.log(`✅ 순서 변경 완료 (수동): ${type}/${category} - ${newItems.length}개 항목`);
    
  } catch (error) {
    console.error('❌ 순서 변경 모달 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}


/**
 * 지정 위치로 이동 모달 제출 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleMovePositionModal(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[3]; // 'inventory' or 'crafting'
    const category = parts.slice(4, -1).join('_');
    const currentIndex = parseInt(parts[parts.length - 1]);
    
    const positionInput = interaction.fields.getTextInputValue('target_position').trim();
    const targetPosition = parseInt(positionInput);
    
    const { loadInventory } = await import('../../database.js');
    const inventory = await loadInventory();
    const { infoTimeout } = await import('../../utils.js').then(m => ({ infoTimeout: m.getTimeoutSettings(inventory).infoTimeout }));
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    const items = Object.keys(targetData[category]);
    
    // 위치 검증
    if (isNaN(targetPosition) || targetPosition < 1 || targetPosition > items.length) {
      return await interaction.reply({
        content: `❌ 잘못된 위치입니다. 1부터 ${items.length}까지 입력해주세요.\n\n_이 메시지는 ${infoTimeout/1000}초 후 자동 삭제됩니다_`,
        ephemeral: true
      }).then(() => {
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {}
        }, infoTimeout);
      });
    }
    
    const newIndex = targetPosition - 1; // 0-based index
    
    // 같은 위치면 무시
    if (newIndex === currentIndex) {
      return await interaction.reply({
        content: `ℹ️ 이미 ${targetPosition}번 위치에 있습니다.\n\n_이 메시지는 ${infoTimeout/1000}초 후 자동 삭제됩니다_`,
        ephemeral: true
      }).then(() => {
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {}
        }, infoTimeout);
      });
    }
    
    const selectedItem = items[currentIndex];
    
    // 순서 변경
    items.splice(currentIndex, 1);
    items.splice(newIndex, 0, selectedItem);
    
    // 데이터베이스 업데이트
    const { updateItemsOrder } = await import('../../database.js');
    const itemsToUpdate = items.map((itemName, index) => ({
      name: itemName,
      order: index
    }));
    
    await updateItemsOrder(type, category, itemsToUpdate);
    
    // 히스토리 기록
    const { addHistory } = await import('../../utils.js');
    await addHistory(type, category, selectedItem, 'reorder', `지정 위치로 이동 (${currentIndex + 1} → ${newIndex + 1})`, interaction.user.username);
    
    // 성공 메시지
    let successMessage = `✅ **${selectedItem}**을(를) **${targetPosition}번 위치**로 이동했습니다!\n`;
    successMessage += `(${currentIndex + 1}번 → ${newIndex + 1}번)\n\n`;
    successMessage += `**새로운 순서:**\n`;
    items.slice(0, 15).forEach((item, idx) => {
      const marker = idx === newIndex ? ' ← 이동됨' : '';
      successMessage += `${idx + 1}. ${item}${marker}\n`;
    });
    if (items.length > 15) {
      successMessage += `... 외 ${items.length - 15}개\n`;
    }
    successMessage += `\n_이 메시지는 ${infoTimeout/1000}초 후 자동 삭제됩니다_`;
    
    await interaction.reply({
      content: successMessage,
      ephemeral: true
    });
    
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, infoTimeout);
    
    console.log(`✅ 지정 위치 이동 완료: ${type}/${category}/${selectedItem} - ${currentIndex + 1} → ${newIndex + 1}`);
    
  } catch (error) {
    console.error('❌ 지정 위치 이동 모달 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}
