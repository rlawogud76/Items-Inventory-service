// 초기화 핸들러
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { loadInventory, updateMultipleItems } from '../../database.js';
import { getItemIcon, sendTemporaryReply } from '../../utils.js';

/**
 * 이모지 검증 함수 - Select Menu는 유니코드 이모지만 허용
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
 * 초기화 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleResetButton(interaction) {
  try {
    // 이미 응답했는지 확인
    if (interaction.replied || interaction.deferred) {
      console.log('⚠️ 이미 응답한 인터랙션, 무시');
      return;
    }
    
    const parts = interaction.customId.split('_');
    const type = parts[1]; // 'inventory' or 'crafting'
    const category = parts.length > 2 ? parts.slice(2).join('_') : null;
    
    console.log('🔄 초기화 버튼 클릭');
    console.log('  - 타입:', type);
    console.log('  - 카테고리:', category || '전체');
    
    if (!category) {
      return await sendTemporaryReply(interaction, 
        `❌ 특정 카테고리를 선택한 후 초기화 버튼을 사용해주세요.\n\`/${type === 'inventory' ? '재고' : '제작'} 카테고리:해양\` 처럼 카테고리를 지정해주세요.`
      );
    }
    
    // 초기화 방식 선택 버튼 생성
    const individualButton = new ButtonBuilder()
      .setCustomId(`reset_individual_${type}_${category}`)
      .setLabel('개별 초기화')
      .setStyle(ButtonStyle.Primary);
    
    const batchButton = new ButtonBuilder()
      .setCustomId(`reset_batch_${type}_${category}`)
      .setLabel('일괄 초기화')
      .setStyle(ButtonStyle.Danger);
    
    const row = new ActionRowBuilder().addComponents(individualButton, batchButton);
    
    await sendTemporaryReply(interaction, {
      content: `🔄 **${category}** 카테고리 초기화 방식을 선택하세요:\n\n**개별 초기화**: 특정 ${type === 'inventory' ? '아이템' : '제작품'}만 선택하여 초기화\n**일괄 초기화**: 카테고리 전체를 0으로 초기화`,
      components: [row]
    }, 15000);
    
  } catch (error) {
    console.error('❌ 초기화 버튼 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await sendTemporaryReply(interaction, '오류가 발생했습니다: ' + error.message).catch((err) => {
        console.error('❌ 초기화 버튼 에러 응답 실패:', err);
      });
    }
  }
}

/**
 * 초기화 타입 선택 핸들러 (개별/일괄)
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleResetTypeButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const resetType = parts[1]; // 'individual' or 'batch'
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.slice(3).join('_');
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory : inventory.crafting;
    
    if (!targetData?.categories?.[category]) {
      return await interaction.update({ 
        content: `❌ "${category}" 카테고리를 찾을 수 없습니다.`,
        components: []
      });
    }
    
    if (resetType === 'batch') {
      // 일괄 초기화
      let resetCount = 0;
      let resetItems = [];
      
      const updates = [];
      const historyEntries = [];
      
      for (const [itemName, data] of Object.entries(targetData.categories[category])) {
        if (data.quantity > 0) {
          const oldQuantity = data.quantity;
          
          updates.push({
            type: type, // 'inventory' or 'crafting'
            category: category,
            itemName: itemName,
            value: 0,
            operation: 'set',
            field: 'quantity'
          });
          
          historyEntries.push({
            timestamp: new Date().toISOString(),
            type: type,
            category: category,
            itemName: itemName,
            action: 'reset',
            details: `${oldQuantity}개 → 0개`,
            userName: interaction.user.displayName || interaction.user.username
          });
          
          resetCount++;
          resetItems.push(`${getItemIcon(itemName, inventory)} ${itemName} (${oldQuantity}개)`);
        }
      }
      
      if (resetCount === 0) {
        return await interaction.update({
          content: '⚠️ 초기화할 항목이 없습니다. (이미 모두 0개입니다)',
          components: []
        });
      }
      
      await updateMultipleItems(updates, historyEntries);
      
      const itemList = resetItems.slice(0, 10).join('\n');
      const moreText = resetItems.length > 10 ? `\n... 외 ${resetItems.length - 10}개` : '';
      
      const successEmbed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('🔄 일괄 초기화 완료')
        .setDescription(`**${category}** 카테고리의 ${type === 'inventory' ? '아이템' : '제작품'} **${resetCount}개**가 초기화되었습니다.\n\n${itemList}${moreText}`);
      
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
      
    } else {
      // 개별 초기화 - 아이템 선택 메뉴 표시
      const items = Object.keys(targetData.categories[category]);
      
      if (items.length === 0) {
        return await interaction.update({
          content: `❌ "${category}" 카테고리에 ${type === 'inventory' ? '아이템' : '제작품'}이 없습니다.`,
          components: []
        });
      }
      
      const itemOptions = items.map(item => {
        const itemData = targetData?.categories?.[category]?.[item];
        if (!itemData) return null;
        
        const customEmoji = itemData?.emoji;
        const fallbackEmoji = getItemIcon(item, inventory);
        const validEmoji = validateEmoji(customEmoji || fallbackEmoji);
        
        return {
          label: item,
          value: item,
          emoji: validEmoji,
          description: `현재: ${itemData.quantity}개`
        };
      }).filter(item => item !== null);
      
      // Discord 제한: 최대 25개 옵션 - 페이지네이션
      const pageSize = 25;
      const totalPages = Math.ceil(itemOptions.length / pageSize);
      const page = 0; // 첫 페이지
      const startIdx = page * pageSize;
      const endIdx = startIdx + pageSize;
      const limitedOptions = itemOptions.slice(startIdx, endIdx);
      
      const { StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_reset_${type}_${category}`)
        .setPlaceholder('초기화할 항목을 선택하세요')
        .addOptions(limitedOptions);
      
      const rows = [new ActionRowBuilder().addComponents(selectMenu)];
      
      // 페이지네이션 버튼 추가 (2페이지 이상일 때)
      if (totalPages > 1) {
        const prevButton = new ButtonBuilder()
          .setCustomId(`page_prev_reset_${type}_${category}_${page}`)
          .setLabel('◀ 이전')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0);
        
        const nextButton = new ButtonBuilder()
          .setCustomId(`page_next_reset_${type}_${category}_${page}`)
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
      
      let contentMessage = `🔄 **${category}** 카테고리에서 초기화할 ${type === 'inventory' ? '아이템' : '제작품'}을 선택하세요:`;
      if (totalPages > 1) {
        contentMessage += `\n\n📄 페이지 ${page + 1}/${totalPages} (전체 ${itemOptions.length}개 항목)`;
      }
      
      await interaction.update({
        content: contentMessage,
        components: rows
      });
      
      // 30초 후 자동 삭제
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {}
      }, 30000);
    }
    
  } catch (error) {
    console.error('❌ 초기화 타입 선택 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await sendTemporaryReply(interaction, '오류가 발생했습니다: ' + error.message).catch((err) => {
        console.error('❌ 초기화 타입 선택 에러 응답 실패:', err);
      });
    }
  }
}


/**
 * 초기화 페이지 이동 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleResetPageButton(interaction) {
  try {
    const isNext = interaction.customId.startsWith('page_next_');
    const prefix = isNext ? 'page_next_reset_' : 'page_prev_reset_';
    const parts = interaction.customId.replace(prefix, '').split('_');
    const type = parts[0]; // 'inventory' or 'crafting'
    const currentPage = parseInt(parts[parts.length - 1]);
    const category = parts.slice(1, -1).join('_');
    
    const newPage = isNext ? currentPage + 1 : currentPage - 1;
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory : inventory.crafting;
    const items = Object.keys(targetData?.categories?.[category] || {});
    
    const itemOptions = items.map(item => {
      const itemData = targetData?.categories?.[category]?.[item];
      if (!itemData) return null;
      
      const customEmoji = itemData?.emoji;
      const fallbackEmoji = getItemIcon(item, inventory);
      const validEmoji = validateEmoji(customEmoji || fallbackEmoji);
      
      return {
        label: item,
        value: item,
        emoji: validEmoji,
        description: `현재: ${itemData.quantity}개`
      };
    }).filter(item => item !== null);
    
    // 페이지네이션
    const pageSize = 25;
    const totalPages = Math.ceil(itemOptions.length / pageSize);
    const startIdx = newPage * pageSize;
    const endIdx = startIdx + pageSize;
    const limitedOptions = itemOptions.slice(startIdx, endIdx);
    
    const { StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_reset_${type}_${category}`)
      .setPlaceholder('초기화할 항목을 선택하세요')
      .addOptions(limitedOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼
    const prevButton = new ButtonBuilder()
      .setCustomId(`page_prev_reset_${type}_${category}_${newPage}`)
      .setLabel('◀ 이전')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === 0);
    
    const nextButton = new ButtonBuilder()
      .setCustomId(`page_next_reset_${type}_${category}_${newPage}`)
      .setLabel('다음 ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === totalPages - 1);
    
    const pageInfo = new ButtonBuilder()
      .setCustomId(`page_info_${newPage}`)
      .setLabel(`${newPage + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true);
    
    rows.push(new ActionRowBuilder().addComponents(prevButton, pageInfo, nextButton));
    
    let contentMessage = `🔄 **${category}** 카테고리에서 초기화할 ${type === 'inventory' ? '아이템' : '제작품'}을 선택하세요:`;
    contentMessage += `\n\n📄 페이지 ${newPage + 1}/${totalPages} (전체 ${itemOptions.length}개 항목)`;
    
    await interaction.update({
      content: contentMessage,
      components: rows
    });
    
  } catch (error) {
    console.error('❌ 초기화 페이지 이동 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
      console.error('❌ 초기화 페이지 이동 에러 응답 실패:', err);
    });
  }
}
