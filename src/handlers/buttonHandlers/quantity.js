// 수량 관리 핸들러
import { ActionRowBuilder } from 'discord.js';
import { loadInventory } from '../../database.js';
import { formatQuantity, getItemIcon } from '../../utils.js';

/**
 * 수량 관리 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleQuantityButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[1]; // 'inventory' or 'crafting'
    const category = parts.length > 2 ? parts.slice(2).join('_') : null;
    
    console.log('📊 수량관리 버튼 클릭');
    console.log('  - 타입:', type);
    console.log('  - 카테고리:', category || '전체');
    
    const inventory = await loadInventory();
    
    if (!category) {
      return await interaction.reply({ 
        content: `❌ 특정 카테고리를 선택한 후 수량관리 버튼을 사용해주세요.\n\`/${type === 'inventory' ? '재고' : '제작'} 카테고리:해양\` 처럼 카테고리를 지정해주세요.`, 
        ephemeral: true 
      });
    }
    
    const targetData = type === 'inventory' ? inventory : inventory.crafting;
    
    if (!targetData.categories[category]) {
      return await interaction.reply({ 
        content: `❌ "${category}" 카테고리를 찾을 수 없습니다.`, 
        ephemeral: true 
      });
    }
    
    // 현재 카테고리의 아이템 목록 생성
    const items = Object.keys(targetData.categories[category]);
    
    if (items.length === 0) {
      return await interaction.reply({ 
        content: `❌ "${category}" 카테고리에 아이템이 없습니다.`, 
        ephemeral: true 
      });
    }
    
    const itemOptions = items.map(item => {
      const itemData = targetData.categories[category][item];
      const customEmoji = itemData?.emoji;
      const { boxes, sets, items: remainder } = formatQuantity(itemData.quantity);
      return {
        label: item,
        value: item,
        emoji: customEmoji || getItemIcon(item, inventory),
        description: `현재: ${remainder}개/${sets}세트/${boxes}상자 (${itemData.quantity}개) / 목표: ${itemData.required}개`
      };
    });
    
    // Discord 제한: 최대 25개 옵션 - 페이지네이션
    const pageSize = 25;
    const totalPages = Math.ceil(itemOptions.length / pageSize);
    const page = 0; // 첫 페이지
    const startIdx = page * pageSize;
    const endIdx = startIdx + pageSize;
    const limitedOptions = itemOptions.slice(startIdx, endIdx);
    
    // 선택 메뉴 생성
    const { StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_quantity_${type}_${category}`)
      .setPlaceholder('수량을 관리할 아이템을 선택하세요')
      .addOptions(limitedOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼 추가 (2페이지 이상일 때)
    if (totalPages > 1) {
      const prevButton = new ButtonBuilder()
        .setCustomId(`page_prev_quantity_${type}_${category}_${page}`)
        .setLabel('◀ 이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0);
      
      const nextButton = new ButtonBuilder()
        .setCustomId(`page_next_quantity_${type}_${category}_${page}`)
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
    
    let contentMessage = `📊 **${category}** 카테고리에서 수량을 관리할 아이템을 선택하세요:`;
    if (totalPages > 1) {
      contentMessage += `\n\n📄 페이지 ${page + 1}/${totalPages} (전체 ${itemOptions.length}개 항목)`;
    }
    
    const reply = await interaction.reply({
      content: contentMessage,
      components: rows,
      ephemeral: true,
      fetchReply: true
    });
    
    // 15초 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {
        // 이미 삭제되었거나 삭제할 수 없는 경우 무시
      }
    }, 15000);
    
  } catch (error) {
    console.error('❌ 버튼 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 수량관리 버튼 에러 응답 실패:', err);
    });
  }
}


/**
 * 수량관리 페이지 이동 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleQuantityPageButton(interaction) {
  try {
    const isNext = interaction.customId.startsWith('page_next_');
    const prefix = isNext ? 'page_next_quantity_' : 'page_prev_quantity_';
    const parts = interaction.customId.replace(prefix, '').split('_');
    const type = parts[0]; // 'inventory' or 'crafting'
    const currentPage = parseInt(parts[parts.length - 1]);
    const category = parts.slice(1, -1).join('_');
    
    const newPage = isNext ? currentPage + 1 : currentPage - 1;
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory : inventory.crafting;
    const items = Object.keys(targetData.categories[category]);
    
    const itemOptions = items.map(item => {
      const itemData = targetData.categories[category][item];
      const customEmoji = itemData?.emoji;
      const { boxes, sets, items: remainder } = formatQuantity(itemData.quantity);
      return {
        label: item,
        value: item,
        emoji: customEmoji || getItemIcon(item, inventory),
        description: `현재: ${remainder}개/${sets}세트/${boxes}상자 (${itemData.quantity}개) / 목표: ${itemData.required}개`
      };
    });
    
    // 페이지네이션
    const pageSize = 25;
    const totalPages = Math.ceil(itemOptions.length / pageSize);
    const startIdx = newPage * pageSize;
    const endIdx = startIdx + pageSize;
    const limitedOptions = itemOptions.slice(startIdx, endIdx);
    
    const { StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_quantity_${type}_${category}`)
      .setPlaceholder('수량을 관리할 아이템을 선택하세요')
      .addOptions(limitedOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼
    const prevButton = new ButtonBuilder()
      .setCustomId(`page_prev_quantity_${type}_${category}_${newPage}`)
      .setLabel('◀ 이전')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === 0);
    
    const nextButton = new ButtonBuilder()
      .setCustomId(`page_next_quantity_${type}_${category}_${newPage}`)
      .setLabel('다음 ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === totalPages - 1);
    
    const pageInfo = new ButtonBuilder()
      .setCustomId(`page_info_${newPage}`)
      .setLabel(`${newPage + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true);
    
    rows.push(new ActionRowBuilder().addComponents(prevButton, pageInfo, nextButton));
    
    let contentMessage = `📊 **${category}** 카테고리에서 수량을 관리할 아이템을 선택하세요:`;
    contentMessage += `\n\n📄 페이지 ${newPage + 1}/${totalPages} (전체 ${itemOptions.length}개 항목)`;
    
    await interaction.update({
      content: contentMessage,
      components: rows
    });
    
  } catch (error) {
    console.error('❌ 수량관리 페이지 이동 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
      console.error('❌ 수량관리 페이지 이동 에러 응답 실패:', err);
    });
  }
}
