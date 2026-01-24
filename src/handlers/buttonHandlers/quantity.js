// 수량 관리 핸들러
import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { loadInventory } from '../../database.js';
import { formatQuantity, getItemIcon } from '../../utils.js';
import { paginateItems, createPaginationButtons, getPaginationInfo } from '../../paginationUtils.js';

/**
 * 이모지 검증 (유효한 유니코드 이모지만 허용)
 * @param {string} emoji - 검증할 이모지
 * @returns {string} - 유효한 이모지 또는 기본 이모지
 */
function validateEmoji(emoji) {
  if (!emoji) return '📦';
  // 커스텀 Discord 이모지 형식(<:name:id> 또는 <a:name:id>)이거나 잘못된 형식이면 기본 이모지 사용
  if (emoji.startsWith('<') || emoji.length > 10) {
    return '📦';
  }
  return emoji;
}

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
    
    if (!targetData?.categories?.[category]) {
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
      const itemData = targetData?.categories?.[category]?.[item];
      if (!itemData) return null;
      
      const customEmoji = itemData?.emoji;
      // Discord 제한: description은 최대 100자
      let description = `현재: ${itemData.quantity}개 / 목표: ${itemData.required}개`;
      if (description.length > 100) {
        description = description.substring(0, 97) + '...';
      }
      
      const emoji = validateEmoji(customEmoji || getItemIcon(item, inventory));
      
      return {
        label: item,
        value: item,
        emoji: emoji,
        description: description
      };
    }).filter(item => item !== null);
    
    // 페이지네이션 적용
    const page = 0; // 첫 페이지
    const { pagedItems, totalPages, startIndex, endIndex } = paginateItems(itemOptions, page);
    
    // 선택 메뉴 생성
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_quantity_${type}_${category}`)
      .setPlaceholder('수량을 관리할 아이템을 선택하세요')
      .addOptions(pagedItems);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼 추가 (2페이지 이상일 때)
    if (totalPages > 1) {
      const paginationRow = createPaginationButtons(`page_quantity_${type}_${category}`, page, totalPages);
      rows.push(paginationRow);
    }
    
    const paginationInfo = getPaginationInfo(page, totalPages, itemOptions.length, startIndex, endIndex);
    
    await interaction.reply({
      content: `📊 **${category}** 카테고리 수량 관리\n${paginationInfo}\n\n수량을 관리할 아이템을 선택하세요:\n\n_이 메시지는 30초 후 자동 삭제됩니다_`,
      components: rows,
      ephemeral: true
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
    // page_quantity_inventory_해양_next_0 형식 파싱
    const parts = interaction.customId.split('_');
    
    // 마지막이 페이지 번호, 마지막-1이 prev/next
    const currentPage = parseInt(parts[parts.length - 1]);
    const direction = parts[parts.length - 2]; // 'prev' or 'next'
    const isNext = direction === 'next';
    
    // page_quantity 제거하고 type과 category 추출
    // parts: ['page', 'quantity', 'inventory', '해양', 'next', '0']
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.slice(3, -2).join('_'); // 마지막 2개(direction, page) 제외
    
    const newPage = isNext ? currentPage + 1 : currentPage - 1;
    
    console.log('📄 수량관리 페이지 이동');
    console.log('  - type:', type);
    console.log('  - category:', category);
    console.log('  - currentPage:', currentPage);
    console.log('  - newPage:', newPage);
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory : inventory.crafting;
    const items = Object.keys(targetData?.categories?.[category] || {});
    
    if (items.length === 0) {
      return await interaction.reply({ 
        content: `❌ "${category}" 카테고리에 아이템이 없습니다.`, 
        ephemeral: true 
      }).catch(() => {});
    }
    
    const itemOptions = items.map(item => {
      const itemData = targetData?.categories?.[category]?.[item];
      if (!itemData) return null;
      
      const customEmoji = itemData?.emoji;
      // Discord 제한: description은 최대 100자
      let description = `현재: ${itemData.quantity}개 / 목표: ${itemData.required}개`;
      if (description.length > 100) {
        description = description.substring(0, 97) + '...';
      }
      
      const emoji = validateEmoji(customEmoji || getItemIcon(item, inventory));
      
      return {
        label: item,
        value: item,
        emoji: emoji,
        description: description
      };
    }).filter(item => item !== null);
    
    // 페이지네이션 적용
    const { pagedItems, totalPages, startIndex, endIndex } = paginateItems(itemOptions, newPage);
    
    if (pagedItems.length === 0) {
      return await interaction.reply({ 
        content: `❌ 해당 페이지에 아이템이 없습니다.`, 
        ephemeral: true 
      }).catch(() => {});
    }
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_quantity_${type}_${category}`)
      .setPlaceholder('수량을 관리할 아이템을 선택하세요')
      .addOptions(pagedItems);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼
    const paginationRow = createPaginationButtons(`page_quantity_${type}_${category}`, newPage, totalPages);
    rows.push(paginationRow);
    
    const paginationInfo = getPaginationInfo(newPage, totalPages, itemOptions.length, startIndex, endIndex);
    
    await interaction.update({
      content: `📊 **${category}** 카테고리 수량 관리\n${paginationInfo}\n\n수량을 관리할 아이템을 선택하세요:\n\n_이 메시지는 30초 후 자동 삭제됩니다_`,
      components: rows
    });
    
  } catch (error) {
    console.error('❌ 수량관리 페이지 이동 에러:', error);
    console.error('❌ 에러 스택:', error.stack);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 수량관리 페이지 이동 에러 응답 실패:', err);
    });
  }
}
