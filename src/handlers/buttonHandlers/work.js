// 수집/제작 작업 핸들러
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { loadInventory, updateItemWorker } from '../../database.js';
import { getItemIcon, formatQuantity, getAllTags, getItemsByTag, getItemTag } from '../../utils.js';

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
 * 수집/제작 시작 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleWorkButton(interaction) {
  try {
    // crafting_가 아니라 crafting으로 시작하는지 확인 (단, crafting_stop은 제외)
    const isCrafting = interaction.customId.startsWith('crafting') && !interaction.customId.startsWith('crafting_stop');
    const isCollecting = interaction.customId.startsWith('collecting');
    
    // 둘 다 아니면 무시
    if (!isCrafting && !isCollecting) return;
    
    let category;
    if (isCrafting) {
      // crafting 또는 crafting_카테고리
      if (interaction.customId === 'crafting') {
        category = null;
      } else {
        category = interaction.customId.replace('crafting_', '');
      }
    } else {
      // collecting 또는 collecting_카테고리
      if (interaction.customId === 'collecting') {
        category = null;
      } else {
        category = interaction.customId.replace('collecting_', '');
      }
    }
    
    console.log(isCrafting ? '🔨 제작중 버튼 클릭' : '📦 수집중 버튼 클릭');
    console.log('  - 사용자:', interaction.user.tag);
    console.log('  - 카테고리:', category || '전체');
    
    const inventory = await loadInventory();
    const userId = interaction.user.id;
    const userName = interaction.user.displayName || interaction.user.username;
    
    if (!category) {
      return await interaction.reply({ 
        content: `❌ 특정 카테고리를 선택한 후 ${isCrafting ? '제작중' : '수집중'} 버튼을 사용해주세요.\n\`/${isCrafting ? '제작' : '재고'} 카테고리:${isCrafting ? '해양' : '해양'}\` 처럼 카테고리를 지정해주세요.`, 
        ephemeral: true 
      });
    }
    
    const targetData = isCrafting ? inventory.crafting : inventory;
    
    if (!targetData?.categories?.[category]) {
      return await interaction.reply({ 
        content: `❌ "${category}" 카테고리를 찾을 수 없습니다.`, 
        ephemeral: true 
      });
    }
    
    // 사용자가 현재 카테고리에서 작업 중인 항목 확인
    const workingData = isCrafting ? inventory.crafting?.crafting : inventory.collecting;
    const myWorkingItems = [];
    
    if (workingData?.[category]) {
      for (const [itemName, worker] of Object.entries(workingData[category])) {
        if (worker.userId === userId) {
          myWorkingItems.push(itemName);
        }
      }
    }
    
    // 이미 작업 중이면 일괄 중단
    if (myWorkingItems.length > 0) {
      // 모든 작업 중인 항목 중단
      for (const itemName of myWorkingItems) {
        try {
          await updateItemWorker(
            isCrafting ? 'crafting' : 'inventory', 
            category, 
            itemName, 
            null
          );
        } catch (e) {
          console.error('Failed to stop worker:', e);
        }
      }
      
      const itemList = myWorkingItems.map(item => `${getItemIcon(item, inventory)} ${item}`).join(', ');
      
      return await interaction.reply({
        content: `✅ **${category}** 카테고리에서 ${isCrafting ? '제작' : '수집'} 중단 완료!\n\n중단된 항목 (${myWorkingItems.length}개):\n${itemList}`,
        ephemeral: true
      });
    }
    
    // 작업 중이 아니면 시작 메뉴 표시
    // 작업 중인 사람 정보 초기화
    if (isCrafting) {
      if (!inventory.crafting.crafting) {
        inventory.crafting.crafting = {};
      }
      if (!inventory.crafting.crafting[category]) {
        inventory.crafting.crafting[category] = {};
      }
    } else {
      if (!inventory.collecting) {
        inventory.collecting = {};
      }
      if (!inventory.collecting[category]) {
        inventory.collecting[category] = {};
      }
    }
    
    // 현재 카테고리의 아이템 목록 생성
    const items = Object.keys(targetData.categories[category]);
    const tags = getAllTags(category, isCrafting ? 'crafting' : 'inventory', inventory);
    
    const itemOptions = items.map(item => {
      const itemData = targetData?.categories?.[category]?.[item];
      if (!itemData) return null;
      
      const customEmoji = itemData?.emoji;
      const percentage = (itemData.quantity / itemData.required) * 100;
      const tag = getItemTag(item, category, isCrafting ? 'crafting' : 'inventory', inventory);
      
      // 작업 중인 사람 확인
      let workingUser = null;
      if (isCrafting) {
        workingUser = inventory.crafting?.crafting?.[category]?.[item];
      } else {
        workingUser = inventory.collecting?.[category]?.[item];
      }
      
      let label = item;
      let description = undefined;
      
      if (percentage >= 100) {
        label = `${item} (완료됨 ${Math.round(percentage)}%)`;
        description = `✅ 이미 목표 수량을 달성했습니다 (${Math.round(percentage)}%)${tag ? ` [${tag}]` : ''}`;
      } else if (workingUser) {
        label = `${item} (${workingUser.userName} 작업중)`;
        description = `⚠️ ${workingUser.userName}님이 ${isCrafting ? '제작' : '수집'} 중입니다${tag ? ` [${tag}]` : ''}`;
      } else if (tag) {
        description = `🏷️ ${tag}`;
      }
      
      const fallbackEmoji = getItemIcon(item, inventory);
      const validEmoji = validateEmoji(customEmoji || fallbackEmoji);
      
      return {
        label: label,
        value: `item_${item}`,
        emoji: validEmoji,
        description: description
      };
    }).filter(item => item !== null);
    
    // 태그 옵션 추가
    const tagOptions = tags.map(tagName => {
      const tagItems = getItemsByTag(tagName, category, isCrafting ? 'crafting' : 'inventory', inventory);
      return {
        label: `🏷️ ${tagName} (${tagItems.length}개 항목)`,
        value: `tag_${tagName}`,
        description: `"${tagName}" 태그의 모든 항목 선택`
      };
    });
    
    const allOptions = [...tagOptions, ...itemOptions];
    
    if (allOptions.length === 0) {
      return await interaction.reply({ 
        content: `❌ "${category}" 카테고리에 아이템이 없습니다.`, 
        ephemeral: true 
      });
    }
    
    // Discord 제한: 최대 25개 옵션 - 페이지네이션
    const pageSize = 25;
    const totalPages = Math.ceil(allOptions.length / pageSize);
    const page = 0; // 첫 페이지
    const startIdx = page * pageSize;
    const endIdx = startIdx + pageSize;
    const limitedOptions = allOptions.slice(startIdx, endIdx);
    
    // 선택 메뉴 생성
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_item_${isCrafting ? 'crafting' : 'collecting'}_${category}`)
      .setPlaceholder(`${isCrafting ? '제작' : '수집'}할 아이템 또는 태그를 선택하세요`)
      .addOptions(limitedOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼 추가 (2페이지 이상일 때)
    if (totalPages > 1) {
      const prevButton = new ButtonBuilder()
        .setCustomId(`page_prev_${isCrafting ? 'crafting' : 'collecting'}_${category}_${page}`)
        .setLabel('◀ 이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0);
      
      const nextButton = new ButtonBuilder()
        .setCustomId(`page_next_${isCrafting ? 'crafting' : 'collecting'}_${category}_${page}`)
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
    
    let contentMessage = `${isCrafting ? '🔨' : '📦'} **${category}** 카테고리에서 ${isCrafting ? '제작' : '수집'}할 아이템 또는 태그를 선택하세요:`;
    if (tags.length > 0) {
      contentMessage += '\n\n💡 태그를 선택하면 해당 태그의 모든 항목이 선택됩니다.';
    }
    if (totalPages > 1) {
      contentMessage += `\n\n📄 페이지 ${page + 1}/${totalPages} (전체 ${allOptions.length}개 항목)`;
    }
    
    await interaction.reply({
      content: contentMessage,
      components: rows,
      ephemeral: true
    });
    
  } catch (error) {
    console.error('❌ 버튼 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 작업 버튼 에러 응답 실패:', err);
    });
  }
}

/**
 * 작업 선택 페이지 이동 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleWorkPageButton(interaction) {
  try {
    const isNext = interaction.customId.startsWith('page_next_');
    const prefix = isNext ? 'page_next_' : 'page_prev_';
    const parts = interaction.customId.replace(prefix, '').split('_');
    const actionType = parts[0]; // 'crafting' or 'collecting'
    const currentPage = parseInt(parts[parts.length - 1]);
    const category = parts.slice(1, -1).join('_');
    
    const isCrafting = actionType === 'crafting';
    const newPage = isNext ? currentPage + 1 : currentPage - 1;
    
    const inventory = await loadInventory();
    const targetData = isCrafting ? inventory.crafting : inventory;
    const tags = getAllTags(category, isCrafting ? 'crafting' : 'inventory', inventory);
    const items = Object.keys(targetData?.categories?.[category] || {});
    
    // 태그 옵션
    const tagOptions = tags.map(tagName => {
      const tagItems = getItemsByTag(tagName, category, isCrafting ? 'crafting' : 'inventory', inventory);
      return {
        label: `🏷️ ${tagName} (${tagItems.length}개 항목)`,
        value: `tag_${tagName}`,
        description: `"${tagName}" 태그의 모든 항목 선택`
      };
    });
    
    // 아이템 옵션
    const itemOptions = items.map(item => {
      const itemData = targetData?.categories?.[category]?.[item];
      if (!itemData) return null;
      
      const customEmoji = itemData?.emoji;
      const percentage = (itemData.quantity / itemData.required) * 100;
      const tag = getItemTag(item, category, isCrafting ? 'crafting' : 'inventory', inventory);
      
      let workingUser = null;
      if (isCrafting) {
        workingUser = inventory.crafting?.crafting?.[category]?.[item];
      } else {
        workingUser = inventory.collecting?.[category]?.[item];
      }
      
      let label = item;
      let description = undefined;
      
      if (percentage >= 100) {
        label = `${item} (완료됨 ${Math.round(percentage)}%)`;
        description = `✅ 이미 목표 수량을 달성했습니다 (${Math.round(percentage)}%)${tag ? ` [${tag}]` : ''}`;
      } else if (workingUser) {
        label = `${item} (${workingUser.userName} 작업중)`;
        description = `⚠️ ${workingUser.userName}님이 ${isCrafting ? '제작' : '수집'} 중입니다${tag ? ` [${tag}]` : ''}`;
      } else if (tag) {
        description = `🏷️ ${tag}`;
      }
      
      const fallbackEmoji = getItemIcon(item, inventory);
      const validEmoji = validateEmoji(customEmoji || fallbackEmoji);
      
      return {
        label: label,
        value: `item_${item}`,
        emoji: validEmoji,
        description: description
      };
    }).filter(item => item !== null);
    
    const allOptions = [...tagOptions, ...itemOptions];
    
    // 페이지네이션
    const pageSize = 25;
    const totalPages = Math.ceil(allOptions.length / pageSize);
    const startIdx = newPage * pageSize;
    const endIdx = startIdx + pageSize;
    const limitedOptions = allOptions.slice(startIdx, endIdx);
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_item_${isCrafting ? 'crafting' : 'collecting'}_${category}`)
      .setPlaceholder(`${isCrafting ? '제작' : '수집'}할 아이템 또는 태그를 선택하세요`)
      .addOptions(limitedOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼
    const prevButton = new ButtonBuilder()
      .setCustomId(`page_prev_${isCrafting ? 'crafting' : 'collecting'}_${category}_${newPage}`)
      .setLabel('◀ 이전')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === 0);
    
    const nextButton = new ButtonBuilder()
      .setCustomId(`page_next_${isCrafting ? 'crafting' : 'collecting'}_${category}_${newPage}`)
      .setLabel('다음 ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === totalPages - 1);
    
    const pageInfo = new ButtonBuilder()
      .setCustomId(`page_info_${newPage}`)
      .setLabel(`${newPage + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true);
    
    rows.push(new ActionRowBuilder().addComponents(prevButton, pageInfo, nextButton));
    
    let contentMessage = `${isCrafting ? '🔨' : '📦'} **${category}** 카테고리에서 ${isCrafting ? '제작' : '수집'}할 아이템 또는 태그를 선택하세요:`;
    if (tags.length > 0) {
      contentMessage += '\n\n💡 태그를 선택하면 해당 태그의 모든 항목이 선택됩니다.';
    }
    contentMessage += `\n\n📄 페이지 ${newPage + 1}/${totalPages} (전체 ${allOptions.length}개 항목)`;
    
    await interaction.update({
      content: contentMessage,
      components: rows
    });
    
  } catch (error) {
    console.error('❌ 페이지 이동 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
      console.error('❌ 작업 페이지 이동 에러 응답 실패:', err);
    });
  }
}

/**
 * 작업 중단 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleStopWorkButton(interaction) {
  try {
    const isCrafting = interaction.customId.startsWith('stop_crafting_');
    const prefix = isCrafting ? 'stop_crafting_' : 'stop_collecting_';
    const parts = interaction.customId.replace(prefix, '').split('_');
    const category = parts[0];
    const itemName = parts.slice(1).join('_');
    
    console.log(`${isCrafting ? '🔨' : '📦'} 중단 버튼 클릭`);
    console.log('  - 카테고리:', category);
    console.log('  - 아이템:', itemName);
    
    const inventory = await loadInventory();
    
    if (isCrafting) {
      if (inventory.crafting?.crafting?.[category]?.[itemName]) {
        await updateItemWorker('crafting', category, itemName, null);
        
        await interaction.update({
          content: `✅ ${itemName}\n제작을 중단했습니다.\n\n_이 메시지는 15초 후 자동 삭제됩니다_`,
          components: []
        });
        console.log(`✅ ${itemName} 제작 중단 완료`);
        
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {}
        }, 15000);
      } else {
        await interaction.update({
          content: `⚠️ ${itemName}\n제작 정보를 찾을 수 없습니다.\n\n_이 메시지는 15초 후 자동 삭제됩니다_`,
          components: []
        });
        console.log(`⚠️ ${itemName} 제작 정보 없음`);
        
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {}
        }, 15000);
      }
    } else {
      if (inventory.collecting?.[category]?.[itemName]) {
        await updateItemWorker('inventory', category, itemName, null);
        
        await interaction.update({
          content: `✅ ${itemName}\n수집을 중단했습니다.\n\n_이 메시지는 15초 후 자동 삭제됩니다_`,
          components: []
        });
        console.log(`✅ ${itemName} 수집 중단 완료`);
        
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {}
        }, 15000);
      } else {
        await interaction.update({
          content: `⚠️ ${itemName}\n수집 정보를 찾을 수 없습니다.\n\n_이 메시지는 15초 후 자동 삭제됩니다_`,
          components: []
        });
        console.log(`⚠️ ${itemName} 수집 정보 없음`);
        
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {}
        }, 15000);
      }
    }
  } catch (error) {
    console.error('❌ 중단 에러:', error);
    await interaction.reply({ 
      content: `❌ 오류가 발생했습니다: ${error.message}`, 
      ephemeral: true 
    }).catch((err) => {
      console.error('❌ 작업 확인 에러 응답 실패:', err);
    });
  }
}
