// 관리(삭제/수정/순서변경) select 핸들러
import { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { loadInventory, removeItem, updateItemsOrder } from '../../database.js';
import { formatQuantity, getTimeoutSettings, addHistory, encodeCustomIdPart, decodeCustomIdPart, getItemTag } from '../../utils.js';

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
      interaction.user.username,
      interaction.user.displayName || interaction.user.username
    );

    const successEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('✅ 삭제 완료')
      .setDescription(`**카테고리:** ${category}\n**${selectedItem}**이(가) 삭제되었습니다.${recipeDeleted ? '\n🗑️ 연결된 레시피도 함께 삭제되었습니다.' : ''}\n\n_이 메시지는 15초 후 자동 삭제됩니다_`);
    
    await interaction.update({
      embeds: [successEmbed],
      components: []
    });
    
    // 설정된 시간 후 자동 삭제
    const { infoTimeout } = getTimeoutSettings(inventory);
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, infoTimeout);
    
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
      .setCustomId(`edit_name_modal_${type}_${category}_${encodeCustomIdPart(selectedItem)}`)
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

/**
 * 순서 변경 첫 번째 항목 선택 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleReorderFirstSelect(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[3]; // 'inventory' or 'crafting'
    const category = parts.slice(4).join('_');
    const firstIndex = parseInt(interaction.values[0]);
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    
    if (!targetData?.[category]) {
      return await interaction.update({
        content: `❌ 카테고리를 찾을 수 없습니다.`,
        components: []
      });
    }
    
    const items = Object.keys(targetData[category]);
    const selectedItem = items[firstIndex];
    
    // 두 번째 선택: 이동할 위치
    const itemOptions = items.map((item, index) => {
      const formatted = formatQuantity(targetData[category][item].quantity);
      const isCurrent = index === firstIndex;
      return {
        label: `${index + 1}. ${item}${isCurrent ? ' (현재 위치)' : ''}`,
        value: `${index}`,
        description: isCurrent ? '현재 선택된 항목' : `이 위치로 이동 (${formatted.items}개)`.substring(0, 100)
      };
    });
    
    // Discord 제한: 최대 25개 옵션
    const pageSize = 25;
    const totalPages = Math.ceil(itemOptions.length / pageSize);
    const page = 0;
    const startIdx = page * pageSize;
    const endIdx = startIdx + pageSize;
    const limitedOptions = itemOptions.slice(startIdx, endIdx);
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_reorder_second_${type}_${category}_${firstIndex}`)
      .setPlaceholder('이동할 위치를 선택하세요 (2단계)')
      .addOptions(limitedOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼 (2페이지 이상일 때)
    if (totalPages > 1) {
      const prevButton = new ButtonBuilder()
        .setCustomId(`page_prev_reorder_second_${type}_${category}_${firstIndex}_${page}`)
        .setLabel('◀ 이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0);
      
      const nextButton = new ButtonBuilder()
        .setCustomId(`page_next_reorder_second_${type}_${category}_${firstIndex}_${page}`)
        .setLabel('다음 ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === totalPages - 1);
      
      const pageInfo = new ButtonBuilder()
        .setCustomId(`page_info_${page}`)
        .setLabel(`${page + 1} / ${totalPages}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true);
      
      rows.push(new ActionRowBuilder().addComponents(prevButton, pageInfo, nextButton));
    }
    
    let contentMessage = `🔀 **${category}** 카테고리 순서 변경\n\n`;
    contentMessage += `**선택한 항목:** ${firstIndex + 1}. ${selectedItem}\n\n`;
    contentMessage += `**현재 순서:**\n`;
    items.slice(0, 10).forEach((item, idx) => {
      const marker = idx === firstIndex ? ' ← 선택됨' : '';
      contentMessage += `${idx + 1}. ${item}${marker}\n`;
    });
    if (items.length > 10) {
      contentMessage += `... 외 ${items.length - 10}개\n`;
    }
    contentMessage += `\n이동할 위치를 선택하세요 (2/2 단계)`;
    
    if (totalPages > 1) {
      contentMessage += `\n\n📄 페이지 ${page + 1}/${totalPages}`;
    }
    contentMessage += `\n\n_이 메시지는 30초 후 자동 삭제됩니다_`;
    
    await interaction.update({
      content: contentMessage,
      components: rows
    });
    
  } catch (error) {
    console.error('❌ 순서 변경 첫 번째 선택 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}

/**
 * 순서 변경 두 번째 항목 선택 핸들러 (실제 순서 변경 실행)
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleReorderSecondSelect(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[3]; // 'inventory' or 'crafting'
    const firstIndex = parseInt(parts[parts.length - 1]);
    const category = parts.slice(4, -1).join('_');
    const secondIndex = parseInt(interaction.values[0]);
    
    if (firstIndex === secondIndex) {
      return await interaction.update({
        content: `❌ 같은 위치로는 이동할 수 없습니다.`,
        components: []
      });
    }
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    
    if (!targetData?.[category]) {
      return await interaction.update({
        content: `❌ 카테고리를 찾을 수 없습니다.`,
        components: []
      });
    }
    
    // 현재 순서를 배열로 변환
    const items = Object.keys(targetData[category]);
    const itemData = items.map(name => ({
      name,
      data: targetData[category][name]
    }));
    
    // 순서 변경: firstIndex 항목을 secondIndex 위치로 이동
    const [movedItem] = itemData.splice(firstIndex, 1);
    itemData.splice(secondIndex, 0, movedItem);
    
    // 새로운 순서로 객체 재구성
    const newCategoryData = {};
    itemData.forEach(item => {
      newCategoryData[item.name] = item.data;
    });
    
    // DB 업데이트
    if (type === 'inventory') {
      inventory.categories[category] = newCategoryData;
    } else {
      inventory.crafting.categories[category] = newCategoryData;
    }
    
    // 데이터베이스에 저장 (새 스키마 방식)
    const { Item } = await import('../../models/Item.js');
    
    // 모든 아이템의 순서를 업데이트 (order 필드 추가)
    const bulkOps = itemData.map((item, index) => ({
      updateOne: {
        filter: { type, category, name: item.name },
        update: { $set: { order: index } }
      }
    }));
    
    await Item.bulkWrite(bulkOps);
    
    await addHistory(
      type,
      category,
      movedItem.name,
      'reorder',
      `${firstIndex + 1}번 → ${secondIndex + 1}번 위치로 이동`,
      interaction.user.username
    );
    
    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ 순서 변경 완료')
      .setDescription([
        `**카테고리:** ${category}`,
        `**항목:** ${movedItem.name}`,
        `**변경:** ${firstIndex + 1}번 → ${secondIndex + 1}번 위치`,
        ``,
        `**새로운 순서:**`,
        ...itemData.slice(0, 10).map((item, idx) => `${idx + 1}. ${item.name}`),
        itemData.length > 10 ? `... 외 ${itemData.length - 10}개` : '',
        ``,
        `_이 메시지는 15초 후 자동 삭제됩니다_`
      ].join('\n'));
    
    await interaction.update({
      embeds: [successEmbed],
      components: []
    });
    
    // 설정된 시간 후 자동 삭제
    const { infoTimeout } = getTimeoutSettings(inventory);
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, infoTimeout);
    
  } catch (error) {
    console.error('❌ 순서 변경 실행 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}

/**
 * 위/아래 이동 항목 선택 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleReorderMoveSelect(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[3]; // 'inventory' or 'crafting'
    const category = parts.slice(4).join('_');
    const selectedIndex = parseInt(interaction.values[0]);
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    const items = Object.keys(targetData[category]);
    const selectedItem = items[selectedIndex];
    
    // 이동 방향 버튼 생성
    const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = await import('discord.js');
    
    const buttons = [];
    
    // 맨 위로
    if (selectedIndex > 0) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`move_item_top_${type}_${category}_${selectedIndex}`)
          .setLabel('⬆️⬆️ 맨 위로')
          .setStyle(ButtonStyle.Primary)
      );
    }
    
    // 위로 5칸
    if (selectedIndex >= 5) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`move_item_up5_${type}_${category}_${selectedIndex}`)
          .setLabel('⬆️ 위로 5칸')
          .setStyle(ButtonStyle.Secondary)
      );
    }
    
    // 위로 1칸
    if (selectedIndex > 0) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`move_item_up1_${type}_${category}_${selectedIndex}`)
          .setLabel('⬆️ 위로 1칸')
          .setStyle(ButtonStyle.Secondary)
      );
    }
    
    // 아래로 1칸
    if (selectedIndex < items.length - 1) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`move_item_down1_${type}_${category}_${selectedIndex}`)
          .setLabel('⬇️ 아래로 1칸')
          .setStyle(ButtonStyle.Secondary)
      );
    }
    
    // 아래로 5칸
    if (selectedIndex <= items.length - 6) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`move_item_down5_${type}_${category}_${selectedIndex}`)
          .setLabel('⬇️ 아래로 5칸')
          .setStyle(ButtonStyle.Secondary)
      );
    }
    
    // 맨 아래로
    if (selectedIndex < items.length - 1) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`move_item_bottom_${type}_${category}_${selectedIndex}`)
          .setLabel('⬇️⬇️ 맨 아래로')
          .setStyle(ButtonStyle.Primary)
      );
    }
    
    // 지정 위치로 (항목이 3개 이상일 때만)
    if (items.length >= 3) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`move_item_position_${type}_${category}_${selectedIndex}`)
          .setLabel('📍 지정 위치로')
          .setStyle(ButtonStyle.Success)
      );
    }
    
    // 버튼을 5개씩 나눠서 행 생성
    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
      rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
    }
    
    let contentMessage = `↕️ **${category}** 카테고리 위/아래 이동\n\n`;
    contentMessage += `**선택한 항목:** ${selectedIndex + 1}. ${selectedItem}\n\n`;
    contentMessage += `**현재 순서:**\n`;
    items.slice(0, 10).forEach((item, idx) => {
      const marker = idx === selectedIndex ? ' ← 선택됨' : '';
      contentMessage += `${idx + 1}. ${item}${marker}\n`;
    });
    if (items.length > 10) {
      contentMessage += `... 외 ${items.length - 10}개\n`;
    }
    contentMessage += `\n이동 방향을 선택하세요:`;
    
    const { selectTimeout } = getTimeoutSettings(inventory);
    contentMessage += `\n\n_이 메시지는 ${selectTimeout/1000}초 후 자동 삭제됩니다_`;
    
    await interaction.update({
      content: contentMessage,
      components: rows
    });
    
    // 설정된 시간 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, selectTimeout);
    
  } catch (error) {
    console.error('❌ 위/아래 이동 선택 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 자동 정렬 옵션 선택 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleSortOptionSelect(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[3]; // 'inventory' or 'crafting'
    const category = parts.slice(4).join('_');
    const sortOption = interaction.values[0]; // 'name_asc', 'quantity_desc', etc.
    
    const inventory = await loadInventory();
    const { infoTimeout } = getTimeoutSettings(inventory);
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    
    if (!sortOption || !sortOption.includes('_')) {
      return await interaction.update({
        content: '❌ 정렬 옵션이 올바르지 않습니다.',
        components: []
      });
    }
    
    // 정렬 실행
    const [sortBy, sortOrder] = sortOption.split('_');
    
    if (sortBy === 'category') {
      const categories = Object.keys(targetData || {});
      if (categories.length === 0) {
        return await interaction.update({
          content: '❌ 정렬할 카테고리가 없습니다.',
          components: []
        });
      }
      
      const sortedCategories = categories.sort((a, b) => {
        return sortOrder === 'asc' ? a.localeCompare(b, 'ko') : b.localeCompare(a, 'ko');
      });
      
      let globalOrder = 0;
      for (const catName of sortedCategories) {
        const itemNames = Object.keys(targetData[catName] || {});
        const sortedItemsInCategory = itemNames.sort((a, b) => a.localeCompare(b, 'ko'));
        const itemsToUpdate = sortedItemsInCategory.map(itemName => ({
          name: itemName,
          order: globalOrder++
        }));
        if (itemsToUpdate.length > 0) {
          await updateItemsOrder(type, catName, itemsToUpdate);
        }
      }
      
      const sortNames = {
        'category_asc': '카테고리별 (가나다)',
        'category_desc': '카테고리별 (역순)'
      };
      await addHistory(type, '전체', null, 'reorder', `자동 정렬: ${sortNames[sortOption]}`, interaction.user.username);
      
      let successMessage = `✅ **${type === 'inventory' ? '재고' : '제작'} 전체 카테고리**가 **${sortNames[sortOption]}**으로 정렬되었습니다!\n\n**카테고리 순서:**\n`;
      sortedCategories.slice(0, 15).forEach((catName, idx) => {
        successMessage += `${idx + 1}. ${catName}\n`;
      });
      if (sortedCategories.length > 15) {
        successMessage += `... 외 ${sortedCategories.length - 15}개\n`;
      }
      successMessage += `\n_이 메시지는 ${infoTimeout/1000}초 후 자동 삭제됩니다_`;
      
      await interaction.update({
        content: successMessage,
        components: []
      });
      
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {}
      }, infoTimeout);
      return;
    }
    
    if (!targetData?.[category]) {
      return await interaction.update({
        content: `❌ "${category}" 카테고리를 찾을 수 없습니다.`,
        components: []
      });
    }
    
    const items = Object.keys(targetData[category]);
    if (items.length === 0) {
      return await interaction.update({
        content: `❌ "${category}" 카테고리에 항목이 없습니다.`,
        components: []
      });
    }
    
    let sortedItems;
    if (sortBy === 'name') {
      sortedItems = items.sort((a, b) => {
        return sortOrder === 'asc' ? a.localeCompare(b, 'ko') : b.localeCompare(a, 'ko');
      });
    } else if (sortBy === 'tag') {
      // 태그별 정렬: 태그명으로 먼저 정렬, 같은 태그 내에서는 이름순
      sortedItems = items.sort((a, b) => {
        const tagA = getItemTag(a, category, type, inventory) || '태그없음';
        const tagB = getItemTag(b, category, type, inventory) || '태그없음';
        
        // 태그가 다르면 태그로 정렬
        if (tagA !== tagB) {
          return sortOrder === 'asc' ? tagA.localeCompare(tagB, 'ko') : tagB.localeCompare(tagA, 'ko');
        }
        
        // 같은 태그면 이름으로 정렬
        return a.localeCompare(b, 'ko');
      });
    } else if (sortBy === 'quantity') {
      sortedItems = items.sort((a, b) => {
        const qtyA = targetData[category][a].quantity || 0;
        const qtyB = targetData[category][b].quantity || 0;
        return sortOrder === 'desc' ? qtyB - qtyA : qtyA - qtyB;
      });
    } else if (sortBy === 'required') {
      sortedItems = items.sort((a, b) => {
        const reqA = targetData[category][a].required || 0;
        const reqB = targetData[category][b].required || 0;
        return sortOrder === 'desc' ? reqB - reqA : reqA - reqB;
      });
    }
    
    // 데이터베이스 업데이트 - 새로운 순서로 모든 아이템 업데이트
    const itemsToUpdate = sortedItems.map((itemName, index) => ({
      name: itemName,
      order: index
    }));
    
    await updateItemsOrder(type, category, itemsToUpdate);
    
    // 히스토리 기록
    const sortNames = {
      'category_asc': '카테고리별 (가나다)',
      'category_desc': '카테고리별 (역순)',
      'name_asc': '이름순 (가나다)',
      'name_desc': '이름순 (역순)',
      'tag_asc': '태그별 (가나다)',
      'tag_desc': '태그별 (역순)',
      'quantity_desc': '현재 수량순 (많은순)',
      'quantity_asc': '현재 수량순 (적은순)',
      'required_desc': '목표 수량순 (많은순)',
      'required_asc': '목표 수량순 (적은순)'
    };
    await addHistory(type, category, null, 'reorder', `자동 정렬: ${sortNames[sortOption]}`, interaction.user.username);
    
    // 성공 메시지
    let successMessage = `✅ **${category}** 카테고리가 **${sortNames[sortOption]}**으로 정렬되었습니다!\n\n**새로운 순서:**\n`;
    
    // 태그별 정렬인 경우 태그 정보도 표시
    if (sortBy === 'tag') {
      let currentTag = null;
      sortedItems.slice(0, 15).forEach((item, idx) => {
        const itemTag = getItemTag(item, category, type, inventory) || '태그없음';
        if (currentTag !== itemTag) {
          if (currentTag !== null) successMessage += '\n';
          successMessage += `[${itemTag}]\n`;
          currentTag = itemTag;
        }
        successMessage += `${idx + 1}. ${item}\n`;
      });
    } else {
      sortedItems.slice(0, 15).forEach((item, idx) => {
        successMessage += `${idx + 1}. ${item}\n`;
      });
    }
    
    if (sortedItems.length > 15) {
      successMessage += `... 외 ${sortedItems.length - 15}개\n`;
    }
    successMessage += `\n_이 메시지는 ${infoTimeout/1000}초 후 자동 삭제됩니다_`;
    
    await interaction.update({
      content: successMessage,
      components: []
    });
    
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, infoTimeout);
    
    console.log(`✅ 자동 정렬 완료: ${type}/${category} - ${sortNames[sortOption]}`);
    
  } catch (error) {
    console.error('❌ 자동 정렬 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}

/**
 * 태그 묶음 이동 첫 번째 선택 (이동할 태그 선택) 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleReorderTagFirstSelect(interaction) {
  try {
    const parts = interaction.customId.replace('select_reorder_tag_first_', '').split('_');
    const type = parts[0];
    const category = parts.slice(1).join('_');
    const sourceTagName = interaction.values[0];
    
    const inventory = await loadInventory();
    const tags = inventory.tags?.[type]?.[category] || {};
    
    // 이동할 위치 옵션 생성
    // 1. 맨 위로
    // 2. 맨 아래로
    // 3. 다른 태그들 뒤로
    
    // 자기 자신 제외한 다른 태그 목록
    const otherTags = Object.keys(tags).filter(t => t !== sourceTagName);
    
    const options = [
      {
        label: '⬆️ 맨 위로 이동',
        value: 'move_to_top',
        description: '목록의 가장 위로 이동합니다.',
        emoji: '⬆️'
      },
      ...otherTags.map(tagName => ({
        label: `${tagName} 뒤로 이동`,
        value: `move_after_${tagName}`,
        description: `"${tagName}" 태그 묶음 바로 뒤로 이동합니다.`,
        emoji: '🏷️'
      })),
      {
        label: '⬇️ 맨 아래로 이동',
        value: 'move_to_bottom',
        description: '목록의 가장 아래로 이동합니다.',
        emoji: '⬇️'
      }
    ];
    
    // 페이지네이션 처리 (옵션이 많을 경우)
    const { StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
    
    // Discord 제한: 최대 25개 옵션
    // 옵션이 많으면 페이지네이션 필요하지만, 여기서는 일단 25개까지만 표시하고 (Top/Bottom 포함)
    // 태그가 매우 많으면 복잡해지므로, 현재는 25개 제한으로 구현.
    // 필요시 페이지네이션 추가 가능.
    
    const limitedOptions = options.slice(0, 25);
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_reorder_tag_second_${type}_${category}_${encodeCustomIdPart(sourceTagName)}`)
      .setPlaceholder('이동할 위치를 선택하세요')
      .addOptions(limitedOptions);
      
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    let contentMessage = `🏷️ **태그 묶음 이동: ${sourceTagName}**\n\n"${sourceTagName}" 태그 묶음을 어디로 이동할까요?\n선택한 위치로 해당 태그의 모든 항목이 이동합니다.`;
    
    await interaction.update({
      content: contentMessage,
      components: [row]
    });
    
  } catch (error) {
    console.error('❌ 태그 묶음 이동 첫 번째 선택 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 태그 묶음 이동 두 번째 선택 (위치 확정) 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleReorderTagSecondSelect(interaction) {
  try {
    const parts = interaction.customId.replace('select_reorder_tag_second_', '').split('_');
    const sourceTagName = decodeCustomIdPart(parts.pop());
    const type = parts[0];
    const category = parts.slice(1).join('_');
    const selection = interaction.values[0];
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    
    if (!targetData?.[category]) {
      return await interaction.update({
        content: `❌ 카테고리를 찾을 수 없습니다.`,
        components: []
      });
    }
    
    const items = Object.keys(targetData[category]);
    
    // 1. 이동할 아이템들 식별 (Source Tag Items)
    const sourceItems = [];
    const otherItems = [];
    
    for (const item of items) {
      if (getItemTag(item, category, type, inventory) === sourceTagName) {
        sourceItems.push(item);
      } else {
        otherItems.push(item);
      }
    }
    
    if (sourceItems.length === 0) {
      return await interaction.update({
        content: `❌ "${sourceTagName}" 태그에 포함된 항목이 없습니다.`,
        components: []
      });
    }
    
    // 2. 새로운 순서 구성
    let newOrder = [];
    
    if (selection === 'move_to_top') {
      newOrder = [...sourceItems, ...otherItems];
    } else if (selection === 'move_to_bottom') {
      newOrder = [...otherItems, ...sourceItems];
    } else if (selection.startsWith('move_after_')) {
      const targetTagName = selection.replace('move_after_', '');
      
      // Target Tag의 마지막 아이템 위치 찾기 (otherItems 기준)
      let insertIndex = -1;
      
      // otherItems를 순회하며 Target Tag를 가진 마지막 아이템의 인덱스를 찾음
      for (let i = 0; i < otherItems.length; i++) {
        const item = otherItems[i];
        if (getItemTag(item, category, type, inventory) === targetTagName) {
          insertIndex = i;
        }
      }
      
      if (insertIndex === -1) {
        // Target Tag 아이템이 없으면 그냥 맨 뒤에 추가 (혹은 맨 앞에? 일단 맨 뒤로)
        newOrder = [...otherItems, ...sourceItems];
      } else {
        // 해당 위치 바로 뒤에 삽입
        const before = otherItems.slice(0, insertIndex + 1);
        const after = otherItems.slice(insertIndex + 1);
        newOrder = [...before, ...sourceItems, ...after];
      }
    }
    
    // 3. DB 업데이트
    const itemsToUpdate = newOrder.map((itemName, index) => ({
      name: itemName,
      order: index
    }));
    
    await updateItemsOrder(type, category, itemsToUpdate);
    
    // 4. 결과 메시지
    const { infoTimeout } = getTimeoutSettings(inventory);
    const directionText = {
      'move_to_top': '맨 위로',
      'move_to_bottom': '맨 아래로'
    }[selection] || `"${selection.replace('move_after_', '')}" 뒤로`;
    
    await addHistory(type, category, null, 'reorder', `태그 이동: ${sourceTagName} → ${directionText}`, interaction.user.username);
    
    let successMessage = `✅ **${sourceTagName}** 태그 묶음(${sourceItems.length}개)을 **${directionText}** 이동했습니다!\n\n**새로운 순서:**\n`;
    
    // 상위 15개만 표시
    newOrder.slice(0, 15).forEach((item, idx) => {
      const isMoved = sourceItems.includes(item);
      const marker = isMoved ? ' 📍' : '';
      successMessage += `${idx + 1}. ${item}${marker}\n`;
    });
    
    if (newOrder.length > 15) {
      successMessage += `... 외 ${newOrder.length - 15}개\n`;
    }
    successMessage += `\n_이 메시지는 ${infoTimeout/1000}초 후 자동 삭제됩니다_`;
    
    await interaction.update({
      content: successMessage,
      components: []
    });
    
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, infoTimeout);
    
  } catch (error) {
    console.error('❌ 태그 묶음 이동 실행 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}
