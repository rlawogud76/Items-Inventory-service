// 관리(삭제/수정/순서변경) select 핸들러
import { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { loadInventory, removeItem } from '../../database.js';
import { addHistory, formatQuantity } from '../../utils.js';

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
      .setDescription(`**카테고리:** ${category}\n**${selectedItem}**이(가) 삭제되었습니다.${recipeDeleted ? '\n🗑️ 연결된 레시피도 함께 삭제되었습니다.' : ''}\n\n_이 메시지는 15초 후 자동 삭제됩니다_`);
    
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
      interaction.user.displayName || interaction.user.username
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
    
    // 15초 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, 15000);
    
  } catch (error) {
    console.error('❌ 순서 변경 실행 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}
