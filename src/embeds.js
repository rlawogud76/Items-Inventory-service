// 임베드 및 버튼 생성 함수들
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { 
  formatQuantity, 
  getItemTag, 
  getItemTagColor,
  applyTagColor,
  getStatusEmoji, 
  getItemIcon, 
  createProgressBar,
  getLinkedStatusText
} from './utils.js';

// 제작 임베드 생성
export function createCraftingEmbed(crafting, categoryName = null, uiMode = 'normal', barLength = 10, page = 0, fullInventory = null) {
  const embed = new EmbedBuilder()
    .setColor(0xFFA500)
    .setTimestamp()
    .setFooter({ text: '마지막 업데이트' });

  // 특정 카테고리만 표시
  if (categoryName) {
    embed.setTitle(`🔨 ${categoryName} 제작 관리`);
    
    if (!crafting.categories[categoryName] || Object.keys(crafting.categories[categoryName]).length === 0) {
      embed.setDescription('⚠️ 등록된 제작품이 없습니다.');
      return embed;
    }

    // fullInventory가 제공되지 않으면 crafting만 포함한 객체 생성
    if (!fullInventory) {
      fullInventory = { crafting: crafting };
    }

    const items = Object.entries(crafting.categories[categoryName]);
    
    // Discord 제한: 최대 25개 필드
    const maxFields = 25;
    const totalPages = Math.ceil(items.length / maxFields);
    const startIndex = page * maxFields;
    const endIndex = Math.min(startIndex + maxFields, items.length);
    const limitedItems = items.slice(startIndex, endIndex);
    
    if (totalPages > 1) {
      embed.setDescription(`📄 페이지 ${page + 1}/${totalPages} (전체 ${items.length}개 제작품)`);
    }
    
    limitedItems.forEach(([itemName, data], index) => {
      const status = getStatusEmoji(data.quantity, data.required);
      const icon = getItemIcon(itemName, fullInventory);
      const progressBar = createProgressBar(data.quantity, data.required, barLength);
      const percentage = Math.round((data.quantity / data.required) * 100);
      
      // 상자/세트/개 계산
      const current = formatQuantity(data.quantity);
      const required = formatQuantity(data.required);
      
      // 태그 확인
      const tag = getItemTag(itemName, categoryName, 'crafting', fullInventory);
      const tagColor = getItemTagColor(itemName, categoryName, 'crafting', fullInventory);
      const tagText = tag ? ` [${tag}]` : '';
      
      // 아이템 이름에 색상 적용
      const coloredItemName = tagColor ? applyTagColor(itemName, tagColor) : itemName;
      
      // 제작 중인 사람 확인
      const craftingInfo = crafting.crafting?.[categoryName]?.[itemName];
      const craftingText = craftingInfo 
        ? `\n> 🔨 **제작중:** ${craftingInfo.userName}` 
        : '';
      
      // 연동 상태 확인
      const linkedStatus = getLinkedStatusText('crafting', categoryName, itemName, fullInventory);
      
      let fieldValue;
      
      if (uiMode === 'detailed') {
        // 상세 모드: 더 많은 정보
        fieldValue = [
          `**현재:** ${current.items}개/${current.sets}세트/${current.boxes}상자 (${data.quantity}개)`,
          `**목표:** ${required.items}개/${required.sets}세트/${required.boxes}상자 (${data.required}개)`,
          `**진행률:** ${percentage}% ${status}`,
          `${progressBar}${craftingText}${linkedStatus}`
        ].join('\n');
      } else {
        // 일반 모드
        fieldValue = [
          `**현재:** ${current.items}개/${current.sets}세트/${current.boxes}상자 │ **목표:** ${required.items}개/${required.sets}세트/${required.boxes}상자`,
          `${progressBar} ${percentage}% ${status}${craftingText}${linkedStatus}`
        ].join('\n');
      }
      
      // 마지막 아이템이 아니면 구분선 추가
      if (index < limitedItems.length - 1) {
        fieldValue += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
      }

      embed.addFields({
        name: `${icon} ${coloredItemName}${tagText}`,
        value: fieldValue,
        inline: false
      });
    });
  } else {
    // 전체 카테고리 표시
    embed.setTitle('🔨 제작 관리 시스템');
    
    if (!crafting.categories || Object.keys(crafting.categories).length === 0) {
      embed.setDescription('⚠️ 등록된 카테고리가 없습니다.');
      return embed;
    }

    // fullInventory가 제공되지 않으면 crafting만 포함한 객체 생성
    if (!fullInventory) {
      fullInventory = { crafting: crafting };
    }
    const categories = Object.entries(crafting.categories);
    
    // Discord 제한: 최대 25개 필드
    const maxFields = 25;
    let fieldCount = 0;
    let truncated = false;

    for (const [catName, items] of categories) {
      if (fieldCount >= maxFields) {
        truncated = true;
        break;
      }
      
      let categoryText = '';
      const itemEntries = Object.entries(items);
      
      itemEntries.forEach(([itemName, data], index) => {
        const status = getStatusEmoji(data.quantity, data.required);
        const icon = getItemIcon(itemName, fullInventory);
        const percentage = Math.round((data.quantity / data.required) * 100);
        
        // 제작 중인 사람 확인
        const craftingInfo = crafting.crafting?.[catName]?.[itemName];
        const craftingText = craftingInfo ? ` 🔨 **${craftingInfo.userName}**` : '';
        
        if (uiMode === 'detailed') {
          categoryText += `${icon} ${itemName}\n**현재:** ${data.quantity}개 / **목표:** ${data.required}개\n**진행률:** ${percentage}% ${status}${craftingText}\n`;
        } else {
          categoryText += `${icon} ${itemName}\n**${data.quantity}/${data.required}** (${percentage}%) ${status}${craftingText}\n`;
        }
        
        // 마지막 아이템이 아니면 구분선 추가
        if (index < itemEntries.length - 1) {
          categoryText += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        }
      });
      
      // Field value 길이 검증 (1024자 제한)
      if (categoryText.length > 1024) {
        categoryText = categoryText.substring(0, 1000) + '\n...(내용이 잘렸습니다)';
      }
      
      embed.addFields({
        name: `📦 **${catName}**`,
        value: categoryText || '제작품 없음',
        inline: false
      });
      
      fieldCount++;
    }
    
    if (truncated) {
      embed.setFooter({ text: `⚠️ 일부 카테고리가 표시되지 않았습니다 (최대 ${maxFields}개 제한) • 마지막 업데이트` });
    }
  }

  return embed;
}

// 재고 임베드 생성
export function createInventoryEmbed(inventory, categoryName = null, uiMode = 'normal', barLength = 10, page = 0) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTimestamp()
    .setFooter({ text: '마지막 업데이트' });

  // 특정 카테고리만 표시
  if (categoryName) {
    embed.setTitle(`🏘️ ${categoryName} 재고 관리`);
    
    if (!inventory.categories[categoryName] || Object.keys(inventory.categories[categoryName]).length === 0) {
      embed.setDescription('⚠️ 등록된 아이템이 없습니다.');
      return embed;
    }

    const items = Object.entries(inventory.categories[categoryName]);
    
    // Discord 제한: 최대 25개 필드
    const maxFields = 25;
    const totalPages = Math.ceil(items.length / maxFields);
    const startIndex = page * maxFields;
    const endIndex = Math.min(startIndex + maxFields, items.length);
    const limitedItems = items.slice(startIndex, endIndex);
    
    if (totalPages > 1) {
      embed.setDescription(`📄 페이지 ${page + 1}/${totalPages} (전체 ${items.length}개 아이템)`);
    }
    
    limitedItems.forEach(([itemName, data], index) => {
      const status = getStatusEmoji(data.quantity, data.required);
      const icon = getItemIcon(itemName, inventory);
      const progressBar = createProgressBar(data.quantity, data.required, barLength);
      const percentage = Math.round((data.quantity / data.required) * 100);
      
      // 상자/세트/개 계산
      const current = formatQuantity(data.quantity);
      const required = formatQuantity(data.required);
      
      // 태그 확인
      const tag = getItemTag(itemName, categoryName, 'inventory', inventory);
      const tagColor = getItemTagColor(itemName, categoryName, 'inventory', inventory);
      const tagText = tag ? ` [${tag}]` : '';
      
      // 아이템 이름에 색상 적용
      const coloredItemName = tagColor ? applyTagColor(itemName, tagColor) : itemName;
      
      // 수집 중인 사람 확인
      const collectingInfo = inventory.collecting?.[categoryName]?.[itemName];
      const collectingText = collectingInfo 
        ? `\n> 👤 **수집중:** ${collectingInfo.userName}` 
        : '';
      
      // 연동 상태 확인
      const linkedStatus = getLinkedStatusText('inventory', categoryName, itemName, inventory);
      
      let fieldValue;
      
      if (uiMode === 'detailed') {
        // 상세 모드: 더 많은 정보
        fieldValue = [
          `**현재:** ${current.items}개/${current.sets}세트/${current.boxes}상자 (${data.quantity}개)`,
          `**목표:** ${required.items}개/${required.sets}세트/${required.boxes}상자 (${data.required}개)`,
          `**진행률:** ${percentage}% ${status}`,
          `${progressBar}${collectingText}${linkedStatus}`
        ].join('\n');
      } else {
        // 일반 모드
        fieldValue = [
          `**현재:** ${current.items}개/${current.sets}세트/${current.boxes}상자 │ **목표:** ${required.items}개/${required.sets}세트/${required.boxes}상자`,
          `${progressBar} ${percentage}% ${status}${collectingText}${linkedStatus}`
        ].join('\n');
      }
      
      // 마지막 아이템이 아니면 구분선 추가
      if (index < limitedItems.length - 1) {
        fieldValue += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
      }

      embed.addFields({
        name: `${icon} ${coloredItemName}${tagText}`,
        value: fieldValue,
        inline: false
      });
    });
  } else {
    // 전체 카테고리 표시
    embed.setTitle('🏘️ 마을 재고 관리 시스템');
    
    if (!inventory.categories || Object.keys(inventory.categories).length === 0) {
      embed.setDescription('⚠️ 등록된 카테고리가 없습니다.');
      return embed;
    }

    const categories = Object.entries(inventory.categories);
    
    // Discord 제한: 최대 25개 필드
    const maxFields = 25;
    let fieldCount = 0;
    let truncated = false;

    for (const [catName, items] of categories) {
      if (fieldCount >= maxFields) {
        truncated = true;
        break;
      }
      
      let categoryText = '';
      const itemEntries = Object.entries(items);
      
      itemEntries.forEach(([itemName, data], index) => {
        const status = getStatusEmoji(data.quantity, data.required);
        const icon = getItemIcon(itemName, inventory);
        const percentage = Math.round((data.quantity / data.required) * 100);
        
        // 수집 중인 사람 확인
        const collectingInfo = inventory.collecting?.[catName]?.[itemName];
        const collectingText = collectingInfo ? ` 👤 **${collectingInfo.userName}**` : '';
        
        if (uiMode === 'detailed') {
          categoryText += `${icon} ${itemName}\n**현재:** ${data.quantity}개 / **목표:** ${data.required}개\n**진행률:** ${percentage}% ${status}${collectingText}\n`;
        } else {
          categoryText += `${icon} ${itemName}\n**${data.quantity}/${data.required}** (${percentage}%) ${status}${collectingText}\n`;
        }
        
        // 마지막 아이템이 아니면 구분선 추가
        if (index < itemEntries.length - 1) {
          categoryText += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        }
      });
      
      // Field value 길이 검증 (1024자 제한)
      if (categoryText.length > 1024) {
        categoryText = categoryText.substring(0, 1000) + '\n...(내용이 잘렸습니다)';
      }
      
      embed.addFields({
        name: `📦 **${catName}**`,
        value: categoryText || '아이템 없음',
        inline: false
      });
      
      fieldCount++;
    }
    
    if (truncated) {
      embed.setFooter({ text: `⚠️ 일부 카테고리가 표시되지 않았습니다 (최대 ${maxFields}개 제한) • 마지막 업데이트` });
    }
  }

  return embed;
}

// 버튼 생성
export function createButtons(categoryName = null, autoRefresh = false, type = 'inventory', uiMode = 'normal', barLength = 10, inventory = null, userId = null, page = 0, totalPages = 1) {
  const actionId = categoryName ? `${type === 'inventory' ? 'collecting' : 'crafting'}_${categoryName}` : (type === 'inventory' ? 'collecting' : 'crafting');
  const uiModeId = categoryName ? `ui_mode_${type}_${categoryName}` : `ui_mode_${type}`;
  const barSizeId = categoryName ? `bar_size_${type}_${categoryName}` : `bar_size_${type}`;
  const quantityId = categoryName ? `quantity_${type}_${categoryName}` : `quantity_${type}`;
  const resetId = categoryName ? `reset_${type}_${categoryName}` : `reset_${type}`;
  const manageId = categoryName ? `manage_${type}_${categoryName}` : `manage_${type}`;
  const recipeId = categoryName ? `recipe_${type}_${categoryName}` : `recipe_${type}`;
  const refreshId = categoryName ? `refresh_${type}_${categoryName}` : `refresh_${type}`;
  
  // 사용자가 현재 카테고리에서 작업 중인지 확인
  let isWorking = false;
  if (inventory && userId && categoryName) {
    const workingData = type === 'inventory' ? inventory.collecting : inventory.crafting?.crafting;
    if (workingData?.[categoryName]) {
      // 이 카테고리에서 작업 중인 항목이 있는지 확인
      for (const [itemName, worker] of Object.entries(workingData[categoryName])) {
        if (worker.userId === userId) {
          isWorking = true;
          break;
        }
      }
    }
  }
  
  // UI 모드 버튼 라벨
  let uiModeLabel = '📏 일반';
  if (uiMode === 'detailed') uiModeLabel = '📏 상세';
  
  const row1Buttons = [
    new ButtonBuilder()
      .setCustomId(actionId)
      .setLabel(isWorking 
        ? (type === 'inventory' ? '⏹️ 수집중단' : '⏹️ 제작중단')
        : (type === 'inventory' ? '📦 수집하기' : '🔨 제작하기'))
      .setStyle(isWorking ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(quantityId)
      .setLabel('📊 수량관리')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(manageId)
      .setLabel(type === 'inventory' ? '📋 물품관리' : '📦 품목관리')
      .setStyle(ButtonStyle.Primary)
  ];
  
  if (type === 'crafting') {
    row1Buttons.push(
      new ButtonBuilder()
        .setCustomId(recipeId)
        .setLabel('📋 레시피')
        .setStyle(ButtonStyle.Primary)
    );
  }
  
  row1Buttons.push(
    new ButtonBuilder()
      .setCustomId(resetId)
      .setLabel('♻️ 초기화')
      .setStyle(ButtonStyle.Secondary)
  );
  
  const row1 = new ActionRowBuilder().addComponents(row1Buttons);
  
  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(uiModeId)
        .setLabel(uiModeLabel)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(barSizeId)
        .setLabel(`📊 바 크기: ${Math.round(barLength * 10)}%`)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(refreshId)
        .setLabel('🔄 새로고침')
        .setStyle(ButtonStyle.Secondary)
    );
  
  const rows = [row1, row2];
  
  // 페이지네이션 버튼 (25개 초과 시) - 임베드 전용
  if (totalPages > 1) {
    const pageButtons = [];
    
    // 이전 페이지 버튼
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_prev_embed_${type}_${categoryName}_${page}`)
        .setLabel('◀ 이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0)
    );
    
    // 페이지 정보 버튼 (비활성화)
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_info_embed_${type}_${categoryName}_${page}`)
        .setLabel(`페이지 ${page + 1}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    
    // 다음 페이지 버튼
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_next_embed_${type}_${categoryName}_${page}`)
        .setLabel('다음 ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1)
    );
    
    const row3 = new ActionRowBuilder().addComponents(pageButtons);
    rows.push(row3);
  }
  
  return rows;
}
