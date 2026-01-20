import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fs from 'fs/promises';
import dotenv from 'dotenv';

// .env 파일 로드
dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// 재고 데이터 로드
async function loadInventory() {
  try {
    const data = await fs.readFile('inventory.json', 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('재고 파일 로드 실패:', error);
    return { items: {} };
  }
}

// 재고 데이터 저장
async function saveInventory(data) {
  try {
    await fs.writeFile('inventory.json', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('재고 파일 저장 실패:', error);
  }
}

// 수정 내역 추가
function addHistory(inventory, type, category, itemName, action, details, userName) {
  if (!inventory.history) {
    inventory.history = [];
  }
  
  inventory.history.unshift({
    timestamp: new Date().toISOString(),
    type: type, // 'inventory' or 'crafting'
    category: category,
    itemName: itemName,
    action: action, // 'add', 'remove', 'update_quantity', 'update_required'
    details: details,
    userName: userName
  });
  
  // 최대 100개까지만 보관
  if (inventory.history.length > 100) {
    inventory.history = inventory.history.slice(0, 100);
  }
}

// ephemeral 메시지 자동 삭제
async function sendTemporaryReply(interaction, content, deleteAfter = 15000) {
  // content가 문자열이면 { content: ... }, 객체면 그대로 사용
  const replyOptions = typeof content === 'string' 
    ? { content: content, ephemeral: true, fetchReply: true }
    : { ...content, ephemeral: true, fetchReply: true };
  
  const reply = await interaction.reply(replyOptions);
  
  setTimeout(async () => {
    try {
      await interaction.deleteReply();
    } catch (error) {
      // 이미 삭제되었거나 삭제할 수 없는 경우 무시
    }
  }, deleteAfter);
  
  return reply;
}

// 재고 상태 이모지 반환
function getStatusEmoji(quantity, required) {
  const percentage = (quantity / required) * 100;
  if (percentage <= 25) return '🔴'; // 25% 이하
  if (percentage < 90) return '🟡'; // 25% 초과 ~ 90% 미만
  return '🟢'; // 90% 이상
}

// 아이템 아이콘 반환
function getItemIcon(itemName, inventory = null) {
  // 먼저 inventory에서 커스텀 이모지 확인
  if (inventory) {
    // 재고 카테고리 확인
    for (const category of Object.values(inventory.categories || {})) {
      if (category[itemName]?.emoji) {
        return category[itemName].emoji;
      }
    }
    // 제작 카테고리 확인
    for (const category of Object.values(inventory.crafting?.categories || {})) {
      if (category[itemName]?.emoji) {
        return category[itemName].emoji;
      }
    }
  }
  
  // 기본 아이콘
  const icons = {
    '다이아몬드': '💎',
    '철괴': '⚙️',
    '나무': '🪵',
    '음식': '🍖',
    '레드스톤': '🔴'
  };
  return icons[itemName] || '📦';
}

// 프로그레스 바 생성
function createProgressBar(current, required, length = 10) {
  const percentage = Math.min(current / required, 1);
  const filled = Math.round(percentage * length);
  const empty = length - filled;
  
  const filledChar = '█';
  const emptyChar = '░';
  
  return filledChar.repeat(filled) + emptyChar.repeat(empty);
}

// 제작 임베드 생성
function createCraftingEmbed(crafting, categoryName = null, uiMode = 'normal', barLength = 10) {
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

    // inventory 전체를 전달하기 위해 crafting을 포함한 객체 생성
    const fullInventory = { crafting: crafting };

    const items = Object.entries(crafting.categories[categoryName]);
    items.forEach(([itemName, data], index) => {
      const status = getStatusEmoji(data.quantity, data.required);
      const icon = getItemIcon(itemName, fullInventory);
      const progressBar = createProgressBar(data.quantity, data.required, barLength);
      const percentage = Math.round((data.quantity / data.required) * 100);
      
      // 세트 계산
      const currentSets = Math.floor(data.quantity / 64);
      const requiredSets = Math.floor(data.required / 64);
      
      // 제작 중인 사람 확인
      const craftingInfo = crafting.crafting?.[categoryName]?.[itemName];
      const craftingText = craftingInfo 
        ? `\n> 🔨 **제작중:** ${craftingInfo.userName}` 
        : '';
      
      let fieldValue;
      
      if (uiMode === 'compact') {
        // 컴팩트 모드: 한 줄로 표시
        fieldValue = `${data.quantity}(${currentSets}세트)/${data.required}(${requiredSets}세트) ${progressBar} ${percentage}% ${status}${craftingInfo ? ` 🔨 ${craftingInfo.userName}` : ''}`;
      } else if (uiMode === 'detailed') {
        // 상세 모드: 더 많은 정보
        fieldValue = [
          `**현재 수량:** ${data.quantity}개 (${currentSets}세트)`,
          `**충족 수량:** ${data.required}개 (${requiredSets}세트)`,
          `**진행률:** ${percentage}% ${status}`,
          `${progressBar}${craftingText}`
        ].join('\n');
      } else {
        // 일반 모드
        fieldValue = [
          `**현재 수량:** ${data.quantity}(${currentSets}세트) / **충족 수량:** ${data.required}(${requiredSets}세트)`,
          `${progressBar} ${percentage}% ${status}${craftingText}`
        ].join('\n');
      }
      
      // 마지막 아이템이 아니면 구분선 추가
      if (index < items.length - 1) {
        fieldValue += '\n━━━━━━━━━━━━━━━━━━━━';
      }

      embed.addFields({
        name: `${icon} **${itemName}**`,
        value: fieldValue,
        inline: uiMode === 'compact'
      });
    });
  } else {
    // 전체 카테고리 표시
    embed.setTitle('🔨 제작 관리 시스템');
    
    if (!crafting.categories || Object.keys(crafting.categories).length === 0) {
      embed.setDescription('⚠️ 등록된 카테고리가 없습니다.');
      return embed;
    }

    const fullInventory = { crafting: crafting };

    for (const [catName, items] of Object.entries(crafting.categories)) {
      let categoryText = '';
      const itemEntries = Object.entries(items);
      
      itemEntries.forEach(([itemName, data], index) => {
        const status = getStatusEmoji(data.quantity, data.required);
        const icon = getItemIcon(itemName, fullInventory);
        const percentage = Math.round((data.quantity / data.required) * 100);
        
        // 제작 중인 사람 확인
        const craftingInfo = crafting.crafting?.[catName]?.[itemName];
        const craftingText = craftingInfo ? ` 🔨 **${craftingInfo.userName}**` : '';
        
        if (uiMode === 'compact') {
          categoryText += `${icon} ${itemName}: ${data.quantity}/${data.required} (${percentage}%) ${status}${craftingText}\n`;
        } else if (uiMode === 'detailed') {
          categoryText += `### ${icon} ${itemName}\n**현재:** ${data.quantity}개 / **목표:** ${data.required}개\n**진행률:** ${percentage}% ${status}${craftingText}\n`;
        } else {
          categoryText += `### ${icon} ${itemName}\n**${data.quantity}/${data.required}** (${percentage}%) ${status}${craftingText}\n`;
        }
        
        // 마지막 아이템이 아니면 구분선 추가
        if (index < itemEntries.length - 1) {
          categoryText += '━━━━━━━━━━━━━━━━━━━━\n';
        }
      });
      
      embed.addFields({
        name: `📦 **${catName}**`,
        value: categoryText || '제작품 없음',
        inline: false
      });
    }
  }

  return embed;
}

// 재고 임베드 생성
function createInventoryEmbed(inventory, categoryName = null, uiMode = 'normal', barLength = 10) {
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
    items.forEach(([itemName, data], index) => {
      const status = getStatusEmoji(data.quantity, data.required);
      const icon = getItemIcon(itemName, inventory);
      const progressBar = createProgressBar(data.quantity, data.required, barLength);
      const percentage = Math.round((data.quantity / data.required) * 100);
      
      // 세트 계산
      const currentSets = Math.floor(data.quantity / 64);
      const requiredSets = Math.floor(data.required / 64);
      
      // 수집 중인 사람 확인
      const collectingInfo = inventory.collecting?.[categoryName]?.[itemName];
      const collectingText = collectingInfo 
        ? `\n> 👤 **수집중:** ${collectingInfo.userName}` 
        : '';
      
      let fieldValue;
      
      if (uiMode === 'compact') {
        // 컴팩트 모드: 한 줄로 표시
        fieldValue = `${data.quantity}(${currentSets}세트)/${data.required}(${requiredSets}세트) ${progressBar} ${percentage}% ${status}${collectingInfo ? ` 👤 ${collectingInfo.userName}` : ''}`;
      } else if (uiMode === 'detailed') {
        // 상세 모드: 더 많은 정보
        fieldValue = [
          `**현재 수량:** ${data.quantity}개 (${currentSets}세트)`,
          `**충족 수량:** ${data.required}개 (${requiredSets}세트)`,
          `**진행률:** ${percentage}% ${status}`,
          `${progressBar}${collectingText}`
        ].join('\n');
      } else {
        // 일반 모드
        fieldValue = [
          `**현재 수량:** ${data.quantity}(${currentSets}세트) / **충족 수량:** ${data.required}(${requiredSets}세트)`,
          `${progressBar} ${percentage}% ${status}${collectingText}`
        ].join('\n');
      }
      
      // 마지막 아이템이 아니면 구분선 추가
      if (index < items.length - 1) {
        fieldValue += '\n━━━━━━━━━━━━━━━━━━━━';
      }

      embed.addFields({
        name: `${icon} **${itemName}**`,
        value: fieldValue,
        inline: uiMode === 'compact'
      });
    });
  } else {
    // 전체 카테고리 표시
    embed.setTitle('🏘️ 마을 재고 관리 시스템');
    
    if (!inventory.categories || Object.keys(inventory.categories).length === 0) {
      embed.setDescription('⚠️ 등록된 카테고리가 없습니다.');
      return embed;
    }

    for (const [catName, items] of Object.entries(inventory.categories)) {
      let categoryText = '';
      const itemEntries = Object.entries(items);
      
      itemEntries.forEach(([itemName, data], index) => {
        const status = getStatusEmoji(data.quantity, data.required);
        const icon = getItemIcon(itemName, inventory);
        const percentage = Math.round((data.quantity / data.required) * 100);
        
        // 수집 중인 사람 확인
        const collectingInfo = inventory.collecting?.[catName]?.[itemName];
        const collectingText = collectingInfo ? ` 👤 **${collectingInfo.userName}**` : '';
        
        if (uiMode === 'compact') {
          categoryText += `${icon} ${itemName}: ${data.quantity}/${data.required} (${percentage}%) ${status}${collectingText}\n`;
        } else if (uiMode === 'detailed') {
          categoryText += `### ${icon} ${itemName}\n**현재:** ${data.quantity}개 / **목표:** ${data.required}개\n**진행률:** ${percentage}% ${status}${collectingText}\n`;
        } else {
          categoryText += `### ${icon} ${itemName}\n**${data.quantity}/${data.required}** (${percentage}%) ${status}${collectingText}\n`;
        }
        
        // 마지막 아이템이 아니면 구분선 추가
        if (index < itemEntries.length - 1) {
          categoryText += '━━━━━━━━━━━━━━━━━━━━\n';
        }
      });
      
      embed.addFields({
        name: `📦 **${catName}**`,
        value: categoryText || '아이템 없음',
        inline: false
      });
    }
  }

  return embed;
}

// 자동 새로고침 타이머 저장
const autoRefreshTimers = new Map();

// 봇 종료 시 모든 타이머 정리
process.on('SIGINT', () => {
  console.log('봇 종료 중... 타이머 정리');
  autoRefreshTimers.forEach(timer => clearInterval(timer));
  autoRefreshTimers.clear();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('봇 종료 중... 타이머 정리');
  autoRefreshTimers.forEach(timer => clearInterval(timer));
  autoRefreshTimers.clear();
  process.exit(0);
});

// 버튼 생성
function createButtons(categoryName = null, autoRefresh = false, type = 'inventory', uiMode = 'normal', barLength = 10) {
  const actionId = categoryName ? `${type === 'inventory' ? 'collecting' : 'crafting'}_${categoryName}` : (type === 'inventory' ? 'collecting' : 'crafting');
  const autoRefreshId = categoryName ? `auto_refresh_${type}_${categoryName}` : `auto_refresh_${type}`;
  const uiModeId = categoryName ? `ui_mode_${type}_${categoryName}` : `ui_mode_${type}`;
  const barSizeId = categoryName ? `bar_size_${type}_${categoryName}` : `bar_size_${type}`;
  const quantityId = categoryName ? `quantity_${type}_${categoryName}` : `quantity_${type}`;
  const resetId = categoryName ? `reset_${type}_${categoryName}` : `reset_${type}`;
  const manageId = categoryName ? `manage_${type}_${categoryName}` : `manage_${type}`;
  
  // UI 모드 버튼 라벨
  let uiModeLabel = '📏 일반';
  if (uiMode === 'compact') uiModeLabel = '📏 컴팩트';
  else if (uiMode === 'detailed') uiModeLabel = '📏 상세';
  
  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(actionId)
        .setLabel(type === 'inventory' ? '📦 수집중' : '🔨 제작중')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(quantityId)
        .setLabel('📊 수량관리')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(manageId)
        .setLabel(type === 'inventory' ? '📋 물품관리' : '� 품목관리')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(resetId)
        .setLabel('♻️ 초기화')
        .setStyle(ButtonStyle.Secondary)
    );
  
  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(autoRefreshId)
        .setLabel(autoRefresh ? '⏸️ 자동새로고침 중지' : '▶️ 자동새로고침')
        .setStyle(autoRefresh ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(uiModeId)
        .setLabel(uiModeLabel)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(barSizeId)
        .setLabel(`📊 바 크기: ${Math.round(barLength * 10)}%`)
        .setStyle(ButtonStyle.Secondary)
    );
  
  return [row1, row2];
}

client.on('ready', async () => {
  console.log(`✅ ${client.user.tag} 봇이 준비되었습니다!`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 재고 관리: /재고, /재고물품추가, /재고물품제거');
  console.log('🔨 제작 관리: /제작, /제작품목추가, /제작품목제거');
  console.log('📋 레시피 관리: /레시피조회, /레시피수정, /레시피삭제');
  console.log('🔧 기타: /도움말, /수정내역');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // 슬래시 커맨드 자동 등록
  try {
    console.log('슬래시 커맨드 등록 중...');
    const { REST, Routes, SlashCommandBuilder } = await import('discord.js');
    
    const commands = [
      new SlashCommandBuilder()
        .setName('재고')
        .setDescription('현재 재고 현황을 확인합니다')
        .addStringOption(option =>
          option.setName('카테고리')
            .setDescription('확인할 카테고리')
            .setRequired(true)
            .addChoices(
              { name: '해양', value: '해양' },
              { name: '채광', value: '채광' },
              { name: '요리', value: '요리' }
            )),
      new SlashCommandBuilder()
        .setName('도움말')
        .setDescription('재고 관리 봇 사용법을 확인합니다'),
      new SlashCommandBuilder()
        .setName('재고물품추가')
        .setDescription('새로운 아이템을 재고 목록에 추가합니다')
        .addStringOption(option =>
          option.setName('카테고리')
            .setDescription('카테고리 선택')
            .setRequired(true)
            .addChoices(
              { name: '해양', value: '해양' },
              { name: '채광', value: '채광' },
              { name: '요리', value: '요리' }
            ))
        .addStringOption(option =>
          option.setName('아이템')
            .setDescription('추가할 아이템 이름')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('충족수량')
            .setDescription('충족 수량 (목표치)')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('초기수량')
            .setDescription('초기 수량')
            .setRequired(true)
            .setMinValue(0))
        .addStringOption(option =>
          option.setName('이모지')
            .setDescription('아이템 이모지 (선택사항)')
            .setRequired(false)),
      new SlashCommandBuilder()
        .setName('재고물품제거')
        .setDescription('재고 목록에서 아이템을 제거합니다')
        .addStringOption(option =>
          option.setName('카테고리')
            .setDescription('카테고리 선택')
            .setRequired(true)
            .addChoices(
              { name: '해양', value: '해양' },
              { name: '채광', value: '채광' },
              { name: '요리', value: '요리' }
            ))
        .addStringOption(option =>
          option.setName('아이템')
            .setDescription('제거할 아이템 이름')
            .setRequired(true)),
      new SlashCommandBuilder()
        .setName('제작')
        .setDescription('현재 제작 현황을 확인합니다')
        .addStringOption(option =>
          option.setName('카테고리')
            .setDescription('확인할 카테고리')
            .setRequired(true)
            .addChoices(
              { name: '해양', value: '해양' },
              { name: '채광', value: '채광' },
              { name: '요리', value: '요리' }
            )),
      new SlashCommandBuilder()
        .setName('제작품목추가')
        .setDescription('새로운 제작품을 추가합니다 (레시피 포함)')
        .addStringOption(option =>
          option.setName('카테고리')
            .setDescription('카테고리 선택')
            .setRequired(true)
            .addChoices(
              { name: '해양', value: '해양' },
              { name: '채광', value: '채광' },
              { name: '요리', value: '요리' }
            ))
        .addStringOption(option =>
          option.setName('제작품')
            .setDescription('추가할 제작품 이름')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('충족수량')
            .setDescription('충족 수량 (목표치)')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('초기수량')
            .setDescription('초기 수량')
            .setRequired(true)
            .setMinValue(0))
        .addStringOption(option =>
          option.setName('재료1')
            .setDescription('필요한 재료 이름')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('재료1수량')
            .setDescription('재료1의 필요 수량')
            .setRequired(true)
            .setMinValue(1))
        .addStringOption(option =>
          option.setName('재료2')
            .setDescription('필요한 재료 이름 (선택)')
            .setRequired(false))
        .addIntegerOption(option =>
          option.setName('재료2수량')
            .setDescription('재료2의 필요 수량')
            .setRequired(false)
            .setMinValue(1))
        .addStringOption(option =>
          option.setName('재료3')
            .setDescription('필요한 재료 이름 (선택)')
            .setRequired(false))
        .addIntegerOption(option =>
          option.setName('재료3수량')
            .setDescription('재료3의 필요 수량')
            .setRequired(false)
            .setMinValue(1))
        .addStringOption(option =>
          option.setName('이모지')
            .setDescription('제작품 이모지 (선택사항)')
            .setRequired(false)),
      new SlashCommandBuilder()
        .setName('제작품목제거')
        .setDescription('제작 목록에서 제작품을 제거합니다')
        .addStringOption(option =>
          option.setName('카테고리')
            .setDescription('카테고리 선택')
            .setRequired(true)
            .addChoices(
              { name: '해양', value: '해양' },
              { name: '채광', value: '채광' },
              { name: '요리', value: '요리' }
            ))
        .addStringOption(option =>
          option.setName('제작품')
            .setDescription('제거할 제작품 이름')
            .setRequired(true)),
      new SlashCommandBuilder()
        .setName('수정내역')
        .setDescription('재고 및 제작 수정 내역을 확인합니다')
        .addIntegerOption(option =>
          option.setName('개수')
            .setDescription('확인할 내역 개수 (기본: 10개)')
            .setRequired(false)),
      new SlashCommandBuilder()
        .setName('레시피조회')
        .setDescription('카테고리의 모든 레시피를 확인합니다')
        .addStringOption(option =>
          option.setName('카테고리')
            .setDescription('조회할 카테고리')
            .setRequired(true)
            .addChoices(
              { name: '해양', value: '해양' },
              { name: '채광', value: '채광' },
              { name: '요리', value: '요리' }
            )),
      new SlashCommandBuilder()
        .setName('레시피수정')
        .setDescription('제작품의 레시피를 수정합니다')
        .addStringOption(option =>
          option.setName('카테고리')
            .setDescription('제작품 카테고리')
            .setRequired(true)
            .addChoices(
              { name: '해양', value: '해양' },
              { name: '채광', value: '채광' },
              { name: '요리', value: '요리' }
            ))
        .addStringOption(option =>
          option.setName('제작품')
            .setDescription('레시피를 수정할 제작품 이름')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('재료1')
            .setDescription('필요한 재료 이름')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('재료1수량')
            .setDescription('재료1의 필요 수량')
            .setRequired(true)
            .setMinValue(1))
        .addStringOption(option =>
          option.setName('재료2')
            .setDescription('필요한 재료 이름 (선택)')
            .setRequired(false))
        .addIntegerOption(option =>
          option.setName('재료2수량')
            .setDescription('재료2의 필요 수량')
            .setRequired(false)
            .setMinValue(1))
        .addStringOption(option =>
          option.setName('재료3')
            .setDescription('필요한 재료 이름 (선택)')
            .setRequired(false))
        .addIntegerOption(option =>
          option.setName('재료3수량')
            .setDescription('재료3의 필요 수량')
            .setRequired(false)
            .setMinValue(1)),
      new SlashCommandBuilder()
        .setName('레시피삭제')
        .setDescription('제작품의 레시피를 삭제합니다')
        .addStringOption(option =>
          option.setName('카테고리')
            .setDescription('제작품 카테고리')
            .setRequired(true)
            .addChoices(
              { name: '해양', value: '해양' },
              { name: '채광', value: '채광' },
              { name: '요리', value: '요리' }
            ))
        .addStringOption(option =>
          option.setName('제작품')
            .setDescription('레시피를 삭제할 제작품 이름')
            .setRequired(true))
    ].map(command => command.toJSON());

    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    const clientId = process.env.CLIENT_ID;
    const guildId = process.env.GUILD_ID;

    if (clientId) {
      const route = guildId 
        ? Routes.applicationGuildCommands(clientId, guildId)
        : Routes.applicationCommands(clientId);
      
      await rest.put(route, { body: commands });
      console.log('✅ 슬래시 커맨드 등록 완료!');
    }
  } catch (error) {
    console.error('슬래시 커맨드 등록 실패:', error);
  }
});

// 슬래시 커맨드 처리
client.on('interactionCreate', async (interaction) => {
  console.log('인터랙션 수신:', interaction.type, '/ customId:', interaction.customId || 'N/A');
  
  if (interaction.isCommand()) {
    const { commandName } = interaction;

    try {
      if (commandName === '재고') {
        const category = interaction.options.getString('카테고리');
        const inventory = await loadInventory();
        const uiMode = inventory.settings?.uiMode || 'normal';
        const barLength = inventory.settings?.barLength || 15;
        const embed = createInventoryEmbed(inventory, category, uiMode, barLength);
        const buttons = createButtons(category, true, 'inventory', uiMode, barLength); // 항상 true로 설정
        const reply = await interaction.reply({ embeds: [embed], components: buttons, fetchReply: true });
        
        // 자동 새로고침 시작 (5초마다)
        const messageId = reply.id;
        const refreshInterval = setInterval(async () => {
          try {
            const updatedInventory = await loadInventory();
            const updatedEmbed = createInventoryEmbed(updatedInventory, category, uiMode, barLength);
            const updatedButtons = createButtons(category, true, 'inventory', uiMode, barLength);
            await interaction.editReply({ embeds: [updatedEmbed], components: updatedButtons });
          } catch (error) {
            // 메시지가 삭제되었거나 에러 발생 시 타이머 정리
            console.log('새로고침 중단:', error.message);
            clearInterval(refreshInterval);
            autoRefreshTimers.delete(messageId);
          }
        }, 5000);
        
        autoRefreshTimers.set(messageId, refreshInterval);
        console.log(`▶️ 자동 새로고침 시작: ${messageId} (재고 - ${category})`);
      }

      else if (commandName === '도움말') {
        const helpEmbed = new EmbedBuilder()
          .setTitle('📖 재고 관리 봇 사용법')
          .setColor(0x5865F2)
          .setDescription('**카테고리:** 해양, 채광, 요리\n\n━━━━━━━━━━━━━━━━━━━━')
          .addFields(
            { 
              name: '📦 재고 관리', 
              value: [
                '**`/재고 [카테고리]`**',
                '재고 현황을 확인합니다.',
                '> 예: `/재고 카테고리:해양`',
                '',
                '**`/재고물품추가`**',
                '새로운 아이템을 추가합니다.',
                '> 예: `/재고물품추가 카테고리:요리 아이템:금괴 초기수량:20 충족수량:100`',
                '',
                '**`/재고물품제거`**',
                '아이템을 제거합니다.',
                '> 예: `/재고물품제거 카테고리:해양 아이템:금괴`'
              ].join('\n'),
              inline: false
            },
            { 
              name: '\u200B', 
              value: '━━━━━━━━━━━━━━━━━━━━',
              inline: false
            },
            { 
              name: '🔨 제작 관리', 
              value: [
                '**`/제작 [카테고리]`**',
                '제작 현황을 확인합니다.',
                '> 예: `/제작 카테고리:해양`',
                '',
                '**`/제작품목추가`**',
                '새로운 제작품을 추가합니다 (레시피 포함).',
                '> 예: `/제작품목추가 카테고리:해양 제작품:낚싯대 초기수량:0 충족수량:10 재료1:나무 재료1수량:5 재료2:실 재료2수량:2`',
                '',
                '**`/제작품목제거`**',
                '제작품을 제거합니다.',
                '> 예: `/제작품목제거 카테고리:채광 제작품:곡괭이`'
              ].join('\n'),
              inline: false
            },
            { 
              name: '\u200B', 
              value: '━━━━━━━━━━━━━━━━━━━━',
              inline: false
            },
            { 
              name: '📋 레시피 관리', 
              value: [
                '**`/레시피조회`**',
                '카테고리의 모든 레시피를 확인합니다.',
                '> 예: `/레시피조회 카테고리:해양`',
                '',
                '**`/레시피수정`**',
                '제작품의 레시피를 수정합니다.',
                '> 예: `/레시피수정 카테고리:해양 제작품:낚싯대 재료1:나무 재료1수량:10`',
                '',
                '**`/레시피삭제`**',
                '제작품의 레시피를 삭제합니다.',
                '> 예: `/레시피삭제 카테고리:해양 제작품:낚싯대`'
              ].join('\n'),
              inline: false
            },
            { 
              name: '\u200B', 
              value: '━━━━━━━━━━━━━━━━━━━━',
              inline: false
            },
            { 
              name: '🔧 기타 기능', 
              value: [
                '**`/수정내역 [개수]`**',
                '재고 및 제작 수정 내역을 확인합니다.',
                '> 예: `/수정내역 개수:20`',
                '',
                '**버튼 기능**',
                '• 📦 수집중 / 🔨 제작중: 작업자 등록',
                '• 📊 수량관리: 추가/수정/차감 통합 관리',
                '• 🔄 초기화: 개별/일괄 초기화',
                '• � 물품관리: 물품/품목 추가 및 삭제',
                '• ▶️ 자동새로고침: 5초마다 자동 업데이트',
                '• 📏 UI 모드: 일반/컴팩트/상세 전환',
                '• 📊 바 크기: 프로그레스 바 크기 조절'
              ].join('\n'),
              inline: false
            }
          );
        await sendTemporaryReply(interaction, { embeds: [helpEmbed] }, 30000);
      }

      else if (commandName === '재고물품추가') {
        const category = interaction.options.getString('카테고리');
        const itemName = interaction.options.getString('아이템');
        const requiredQuantity = interaction.options.getInteger('충족수량');
        const initialQuantity = interaction.options.getInteger('초기수량');
        const emoji = interaction.options.getString('이모지');

        const inventory = await loadInventory();
        
        if (!inventory.categories[category]) {
          inventory.categories[category] = {};
        }
        
        if (inventory.categories[category][itemName]) {
          return sendTemporaryReply(interaction, `❌ "${itemName}" 아이템이 이미 존재합니다.`);
        }

        inventory.categories[category][itemName] = {
          quantity: initialQuantity,
          required: requiredQuantity
        };
        
        if (emoji) {
          inventory.categories[category][itemName].emoji = emoji;
        }
        
        // 수정 내역 추가
        addHistory(inventory, 'inventory', category, itemName, 'add', 
          `초기: ${initialQuantity}개, 목표: ${requiredQuantity}개`, 
          interaction.user.displayName || interaction.user.username);
        
        await saveInventory(inventory);

        const icon = emoji || getItemIcon(itemName, inventory);
        const successEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setDescription(`### ✅ 목록 추가 완료\n**카테고리:** ${category}\n${icon} **${itemName}**이(가) 재고 목록에 추가되었습니다!\n\n**초기 수량:** ${initialQuantity}개\n**충족 수량:** ${requiredQuantity}개`);
        
        await sendTemporaryReply(interaction, { embeds: [successEmbed] });
      }

      else if (commandName === '재고물품제거') {
        const category = interaction.options.getString('카테고리');
        const itemName = interaction.options.getString('아이템');

        const inventory = await loadInventory();
        
        if (!inventory.categories[category] || !inventory.categories[category][itemName]) {
          return sendTemporaryReply(interaction, `❌ "${itemName}" 아이템을 찾을 수 없습니다.`);
        }

        const itemData = inventory.categories[category][itemName];
        delete inventory.categories[category][itemName];
        
        // 수정 내역 추가
        addHistory(inventory, 'inventory', category, itemName, 'remove', 
          `수량: ${itemData.quantity}/${itemData.required}`, 
          interaction.user.displayName || interaction.user.username);
        
        await saveInventory(inventory);

        const successEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription(`### ✅ 목록 제거 완료\n**카테고리:** ${category}\n**${itemName}**이(가) 재고 목록에서 제거되었습니다.`);
        
        await sendTemporaryReply(interaction, { embeds: [successEmbed] });
      }

      else if (commandName === '수정내역') {
        const count = interaction.options.getInteger('개수') || 10;
        const inventory = await loadInventory();
        
        if (!inventory.history || inventory.history.length === 0) {
          return sendTemporaryReply(interaction, '📋 수정 내역이 없습니다.');
        }
        
        const embed = new EmbedBuilder()
          .setTitle('📋 수정 내역')
          .setColor(0x5865F2)
          .setTimestamp();
        
        const histories = inventory.history.slice(0, Math.min(count, 25)); // 최대 25개
        
        for (const history of histories) {
          const date = new Date(history.timestamp);
          
          // 한국 시간대(UTC+9)로 변환
          const kstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
          const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
          const day = String(kstDate.getUTCDate()).padStart(2, '0');
          const hour = String(kstDate.getUTCHours()).padStart(2, '0');
          const minute = String(kstDate.getUTCMinutes()).padStart(2, '0');
          const timeStr = `${month}/${day} ${hour}:${minute}`;
          
          const typeEmoji = history.type === 'inventory' ? '📦' : '🔨';
          const actionText = {
            'add': '추가',
            'remove': '제거',
            'update_quantity': '현재 수량 변경',
            'update_required': '충족 수량 변경',
            'reset': '초기화'
          }[history.action] || history.action;
          
          const icon = getItemIcon(history.itemName, inventory);
          
          embed.addFields({
            name: `${typeEmoji} ${history.category} - ${icon} ${history.itemName}`,
            value: `**${actionText}** by ${history.userName}\n${history.details}\n\`${timeStr}\``,
            inline: false
          });
        }
        
        if (inventory.history.length > count) {
          embed.setFooter({ text: `총 ${inventory.history.length}개 중 ${count}개 표시` });
        }
        
        const reply = await interaction.reply({ embeds: [embed], ephemeral: true, fetchReply: true });
        
        // 30초 후 자동 삭제
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {
            // 이미 삭제되었거나 삭제할 수 없는 경우 무시
          }
        }, 30000);
      }

      else if (commandName === '제작') {
        const category = interaction.options.getString('카테고리');
        const inventory = await loadInventory();
        const crafting = inventory.crafting || { categories: {}, crafting: {} };
        const uiMode = inventory.settings?.uiMode || 'normal';
        const barLength = inventory.settings?.barLength || 15;
        const embed = createCraftingEmbed(crafting, category, uiMode, barLength);
        const buttons = createButtons(category, true, 'crafting', uiMode, barLength); // 항상 true로 설정
        const reply = await interaction.reply({ embeds: [embed], components: buttons, fetchReply: true });
        
        // 자동 새로고침 시작 (5초마다)
        const messageId = reply.id;
        const refreshInterval = setInterval(async () => {
          try {
            const updatedInventory = await loadInventory();
            const updatedCrafting = updatedInventory.crafting || { categories: {}, crafting: {} };
            const updatedEmbed = createCraftingEmbed(updatedCrafting, category, uiMode, barLength);
            const updatedButtons = createButtons(category, true, 'crafting', uiMode, barLength);
            await interaction.editReply({ embeds: [updatedEmbed], components: updatedButtons });
          } catch (error) {
            // 메시지가 삭제되었거나 에러 발생 시 타이머 정리
            console.log('새로고침 중단:', error.message);
            clearInterval(refreshInterval);
            autoRefreshTimers.delete(messageId);
          }
        }, 5000);
        
        autoRefreshTimers.set(messageId, refreshInterval);
        console.log(`▶️ 자동 새로고침 시작: ${messageId} (제작 - ${category})`);
      }

      else if (commandName === '제작품목추가') {
        const category = interaction.options.getString('카테고리');
        const itemName = interaction.options.getString('제작품');
        const requiredQuantity = interaction.options.getInteger('충족수량');
        const initialQuantity = interaction.options.getInteger('초기수량');
        const emoji = interaction.options.getString('이모지');
        
        // 레시피 정보
        const material1 = interaction.options.getString('재료1');
        const material1Qty = interaction.options.getInteger('재료1수량');
        const material2 = interaction.options.getString('재료2');
        const material2Qty = interaction.options.getInteger('재료2수량');
        const material3 = interaction.options.getString('재료3');
        const material3Qty = interaction.options.getInteger('재료3수량');

        const inventory = await loadInventory();
        
        if (!inventory.crafting) {
          inventory.crafting = { categories: {}, crafting: {}, recipes: {} };
        }
        if (!inventory.crafting.categories[category]) {
          inventory.crafting.categories[category] = {};
        }
        if (!inventory.crafting.recipes) {
          inventory.crafting.recipes = {};
        }
        if (!inventory.crafting.recipes[category]) {
          inventory.crafting.recipes[category] = {};
        }
        
        if (inventory.crafting.categories[category][itemName]) {
          return sendTemporaryReply(interaction, `❌ "${itemName}" 제작품이 이미 존재합니다.`);
        }

        // 재료가 같은 카테고리에 존재하는지 확인
        if (!inventory.categories[category]) {
          return sendTemporaryReply(interaction, `❌ "${category}" 카테고리에 재료가 없습니다. 먼저 재고 목록에 재료를 추가해주세요.`);
        }

        const materials = [];
        
        // 재료1 확인
        if (!inventory.categories[category][material1]) {
          return sendTemporaryReply(interaction, `❌ "${material1}" 재료를 "${category}" 카테고리에서 찾을 수 없습니다. 먼저 재고 목록에 추가해주세요.`);
        }
        materials.push({ name: material1, quantity: material1Qty, category: category });

        // 재료2 확인 (선택사항)
        if (material2 && material2Qty) {
          if (!inventory.categories[category][material2]) {
            return sendTemporaryReply(interaction, `❌ "${material2}" 재료를 "${category}" 카테고리에서 찾을 수 없습니다. 먼저 재고 목록에 추가해주세요.`);
          }
          materials.push({ name: material2, quantity: material2Qty, category: category });
        }

        // 재료3 확인 (선택사항)
        if (material3 && material3Qty) {
          if (!inventory.categories[category][material3]) {
            return sendTemporaryReply(interaction, `❌ "${material3}" 재료를 "${category}" 카테고리에서 찾을 수 없습니다. 먼저 재고 목록에 추가해주세요.`);
          }
          materials.push({ name: material3, quantity: material3Qty, category: category });
        }

        // 제작품 추가
        inventory.crafting.categories[category][itemName] = {
          quantity: initialQuantity,
          required: requiredQuantity
        };
        
        if (emoji) {
          inventory.crafting.categories[category][itemName].emoji = emoji;
        }
        
        // 레시피 저장
        inventory.crafting.recipes[category][itemName] = materials;
        
        // 수정 내역 추가
        addHistory(inventory, 'crafting', category, itemName, 'add', 
          `초기: ${initialQuantity}개, 목표: ${requiredQuantity}개, 레시피: ${materials.map(m => `${m.name} x${m.quantity}`).join(', ')}`, 
          interaction.user.displayName || interaction.user.username);
        
        await saveInventory(inventory);

        // 레시피 표시
        const recipeText = materials.map(m => {
          const icon = getItemIcon(m.name, inventory);
          return `${icon} **${m.name}** x${m.quantity}개`;
        }).join('\n');

        const icon = emoji || getItemIcon(itemName, inventory);
        const successEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ 제작 목록 추가 완료')
          .setDescription(`**카테고리:** ${category}\n${icon} **${itemName}**이(가) 제작 목록에 추가되었습니다!\n\n**초기 수량:** ${initialQuantity}개\n**충족 수량:** ${requiredQuantity}개\n\n**레시피 (1개 제작 시):**\n${recipeText}`);
        
        await sendTemporaryReply(interaction, { embeds: [successEmbed] });
      }

      else if (commandName === '제작품목제거') {
        const category = interaction.options.getString('카테고리');
        const itemName = interaction.options.getString('제작품');

        const inventory = await loadInventory();
        
        if (!inventory.crafting?.categories[category] || !inventory.crafting.categories[category][itemName]) {
          return sendTemporaryReply(interaction, `❌ "${itemName}" 제작품을 찾을 수 없습니다.`);
        }

        const itemData = inventory.crafting.categories[category][itemName];
        delete inventory.crafting.categories[category][itemName];
        
        // 수정 내역 추가
        addHistory(inventory, 'crafting', category, itemName, 'remove', 
          `수량: ${itemData.quantity}/${itemData.required}`, 
          interaction.user.displayName || interaction.user.username);
        
        await saveInventory(inventory);

        const successEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription(`### ✅ 제작 목록 제거 완료\n**카테고리:** ${category}\n**${itemName}**이(가) 제작 목록에서 제거되었습니다.`);
        
        await sendTemporaryReply(interaction, { embeds: [successEmbed] });
      }

      else if (commandName === '레시피수정') {
        const category = interaction.options.getString('카테고리');
        const craftItem = interaction.options.getString('제작품');
        const material1 = interaction.options.getString('재료1');
        const material1Qty = interaction.options.getInteger('재료1수량');
        const material2 = interaction.options.getString('재료2');
        const material2Qty = interaction.options.getInteger('재료2수량');
        const material3 = interaction.options.getString('재료3');
        const material3Qty = interaction.options.getInteger('재료3수량');

        const inventory = await loadInventory();
        
        // 제작품 존재 확인
        if (!inventory.crafting?.categories[category]?.[craftItem]) {
          return sendTemporaryReply(interaction, `❌ "${craftItem}" 제작품을 찾을 수 없습니다.`);
        }

        // 같은 카테고리의 재료만 사용 가능
        if (!inventory.categories[category]) {
          return sendTemporaryReply(interaction, `❌ "${category}" 카테고리에 재료가 없습니다.`);
        }

        // 재료가 같은 카테고리에 존재하는지 확인
        const materials = [];
        
        // 재료1 확인
        if (!inventory.categories[category][material1]) {
          return sendTemporaryReply(interaction, `❌ "${material1}" 재료를 "${category}" 카테고리에서 찾을 수 없습니다.`);
        }
        materials.push({ name: material1, quantity: material1Qty, category: category });

        // 재료2 확인 (선택사항)
        if (material2 && material2Qty) {
          if (!inventory.categories[category][material2]) {
            return sendTemporaryReply(interaction, `❌ "${material2}" 재료를 "${category}" 카테고리에서 찾을 수 없습니다.`);
          }
          materials.push({ name: material2, quantity: material2Qty, category: category });
        }

        // 재료3 확인 (선택사항)
        if (material3 && material3Qty) {
          if (!inventory.categories[category][material3]) {
            return sendTemporaryReply(interaction, `❌ "${material3}" 재료를 "${category}" 카테고리에서 찾을 수 없습니다.`);
          }
          materials.push({ name: material3, quantity: material3Qty, category: category });
        }

        // 레시피 저장
        if (!inventory.crafting.recipes) {
          inventory.crafting.recipes = {};
        }
        if (!inventory.crafting.recipes[category]) {
          inventory.crafting.recipes[category] = {};
        }

        inventory.crafting.recipes[category][craftItem] = materials;
        await saveInventory(inventory);

        // 레시피 표시
        const recipeText = materials.map(m => {
          const icon = getItemIcon(m.name, inventory);
          return `${icon} **${m.name}** x${m.quantity}개`;
        }).join('\n');

        const icon = getItemIcon(craftItem, inventory);
        const successEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ 레시피 수정 완료')
          .setDescription(`**카테고리:** ${category}\n${icon} **${craftItem}**\n\n**필요 재료:**\n${recipeText}`);
        
        await sendTemporaryReply(interaction, { embeds: [successEmbed] });
      }

      else if (commandName === '레시피조회') {
        const category = interaction.options.getString('카테고리');

        const inventory = await loadInventory();
        
        const recipes = inventory.crafting?.recipes?.[category];
        
        if (!recipes || Object.keys(recipes).length === 0) {
          return sendTemporaryReply(interaction, `❌ "${category}" 카테고리에 등록된 레시피가 없습니다.`);
        }

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`📋 ${category} 카테고리 레시피 목록`)
          .setDescription(`**총 ${Object.keys(recipes).length}개의 레시피**\n\n━━━━━━━━━━━━━━━━━━━━`)
          .setFooter({ text: '✅ = 재료 충분 | ❌ = 재료 부족' });

        for (const [craftItem, recipe] of Object.entries(recipes)) {
          const icon = getItemIcon(craftItem, inventory);
          
          const recipeText = recipe.map(m => {
            const matIcon = getItemIcon(m.name, inventory);
            const materialData = inventory.categories[m.category]?.[m.name];
            const currentQty = materialData?.quantity || 0;
            const canCraft = currentQty >= m.quantity ? '✅' : '❌';
            return `${matIcon} ${m.name} x${m.quantity}개 (보유: ${currentQty}개) ${canCraft}`;
          }).join('\n');

          embed.addFields({
            name: `${icon} ${craftItem}`,
            value: recipeText || '재료 없음',
            inline: false
          });
        }
        
        const reply = await interaction.reply({ embeds: [embed], ephemeral: true, fetchReply: true });
        
        // 30초 후 자동 삭제
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {
            // 이미 삭제되었거나 삭제할 수 없는 경우 무시
          }
        }, 30000);
      }

      else if (commandName === '레시피삭제') {
        const category = interaction.options.getString('카테고리');
        const craftItem = interaction.options.getString('제작품');

        const inventory = await loadInventory();
        
        if (!inventory.crafting?.recipes?.[category]?.[craftItem]) {
          return sendTemporaryReply(interaction, `❌ "${craftItem}"의 레시피가 등록되지 않았습니다.`);
        }

        delete inventory.crafting.recipes[category][craftItem];
        await saveInventory(inventory);

        const icon = getItemIcon(craftItem, inventory);
        const successEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription(`### ✅ 레시피 삭제 완료\n**카테고리:** ${category}\n${icon} **${craftItem}**의 레시피가 삭제되었습니다.`);
        
        await sendTemporaryReply(interaction, { embeds: [successEmbed] });
      }

    } catch (error) {
      console.error('커맨드 실행 에러:', error);
      await interaction.reply({ content: '❌ 에러가 발생했습니다: ' + error.message, ephemeral: true });
    }
  }

  // 버튼 인터랙션 처리
  if (interaction.isButton()) {
    console.log('버튼 클릭 감지! customId:', interaction.customId);
    
    if (interaction.customId.startsWith('refresh')) {
      try {
        const parts = interaction.customId.split('_');
        const type = parts[1]; // 'inventory' or 'crafting'
        const category = parts.length > 2 ? parts.slice(2).join('_') : null;
        
        console.log('🔄 새로고침 버튼 클릭');
        console.log('  - customId:', interaction.customId);
        console.log('  - 타입:', type);
        console.log('  - 카테고리:', category || '전체');
        
        const inventory = await loadInventory();
        const uiMode = inventory.settings?.uiMode || 'normal';
        const barLength = inventory.settings?.barLength || 15;
        let embed, buttons;
        
        if (type === 'crafting') {
          const crafting = inventory.crafting || { categories: {}, crafting: {} };
          embed = createCraftingEmbed(crafting, category, uiMode, barLength);
        } else {
          embed = createInventoryEmbed(inventory, category, uiMode, barLength);
        }
        
        // 현재 자동 새로고침 상태 확인
        const messageId = interaction.message.id;
        const isAutoRefreshing = autoRefreshTimers.has(messageId);
        buttons = createButtons(category, isAutoRefreshing, type || 'inventory', uiMode, barLength);
        
        await interaction.update({ embeds: [embed], components: buttons });
        console.log('✅ 새로고침 완료');
      } catch (error) {
        console.error('❌ 새로고침 에러:', error);
        await interaction.reply({ content: '새로고침 중 오류가 발생했습니다.', ephemeral: true }).catch(() => {});
      }
    }
    
    else if (interaction.customId.startsWith('quantity') && 
             !interaction.customId.startsWith('quantity_add_') && 
             !interaction.customId.startsWith('quantity_edit_') && 
             !interaction.customId.startsWith('quantity_subtract_')) {
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
          const sets = Math.floor(itemData.quantity / 64);
          const remainder = itemData.quantity % 64;
          return {
            label: item,
            value: item,
            emoji: customEmoji || getItemIcon(item, inventory),
            description: `현재: ${sets}세트+${remainder}개 (${itemData.quantity}개) / 목표: ${itemData.required}개`
          };
        });
        
        // 선택 메뉴 생성
        const { StringSelectMenuBuilder } = await import('discord.js');
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`select_quantity_${type}_${category}`)
          .setPlaceholder('수량을 관리할 아이템을 선택하세요')
          .addOptions(itemOptions);
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        const reply = await interaction.reply({
          content: `📊 **${category}** 카테고리에서 수량을 관리할 아이템을 선택하세요:`,
          components: [row],
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
        await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
      }
    }
    
    else if (interaction.customId.startsWith('reset') && !interaction.customId.startsWith('reset_individual') && !interaction.customId.startsWith('reset_batch')) {
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
          await sendTemporaryReply(interaction, '오류가 발생했습니다: ' + error.message).catch(() => {});
        }
      }
    }
    
    else if (interaction.customId.startsWith('reset_individual') || interaction.customId.startsWith('reset_batch')) {
      try {
        const parts = interaction.customId.split('_');
        const resetType = parts[1]; // 'individual' or 'batch'
        const type = parts[2]; // 'inventory' or 'crafting'
        const category = parts.slice(3).join('_');
        
        const inventory = await loadInventory();
        const targetData = type === 'inventory' ? inventory : inventory.crafting;
        
        if (!targetData.categories[category]) {
          return await interaction.update({ 
            content: `❌ "${category}" 카테고리를 찾을 수 없습니다.`,
            components: []
          });
        }
        
        if (resetType === 'batch') {
          // 일괄 초기화
          let resetCount = 0;
          let resetItems = [];
          
          for (const [itemName, data] of Object.entries(targetData.categories[category])) {
            if (data.quantity > 0) {
              const oldQuantity = data.quantity;
              data.quantity = 0;
              resetCount++;
              resetItems.push(`${getItemIcon(itemName, inventory)} ${itemName} (${oldQuantity}개)`);
              
              addHistory(inventory, type, category, itemName, 'reset', 
                `${oldQuantity}개 → 0개`, 
                interaction.user.displayName || interaction.user.username);
            }
          }
          
          if (resetCount === 0) {
            return await interaction.update({
              content: '⚠️ 초기화할 항목이 없습니다. (이미 모두 0개입니다)',
              components: []
            });
          }
          
          await saveInventory(inventory);
          
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
            const itemData = targetData.categories[category][item];
            const customEmoji = itemData?.emoji;
            return {
              label: item,
              value: item,
              emoji: customEmoji || getItemIcon(item, inventory),
              description: `현재: ${itemData.quantity}개`
            };
          });
          
          const { StringSelectMenuBuilder } = await import('discord.js');
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_reset_${type}_${category}`)
            .setPlaceholder('초기화할 항목을 선택하세요')
            .addOptions(itemOptions);
          
          const row = new ActionRowBuilder().addComponents(selectMenu);
          
          await interaction.update({
            content: `🔄 **${category}** 카테고리에서 초기화할 ${type === 'inventory' ? '아이템' : '제작품'}을 선택하세요:`,
            components: [row]
          });
        }
        
      } catch (error) {
        console.error('❌ 초기화 타입 선택 에러:', error);
        if (!interaction.replied && !interaction.deferred) {
          await sendTemporaryReply(interaction, '오류가 발생했습니다: ' + error.message).catch(() => {});
        }
      }
    }
    
    else if (interaction.customId.startsWith('manage') && !interaction.customId.startsWith('manage_add') && !interaction.customId.startsWith('manage_remove')) {
      try {
        // 이미 응답했는지 확인
        if (interaction.replied || interaction.deferred) {
          console.log('⚠️ 이미 응답한 인터랙션, 무시');
          return;
        }
        
        const parts = interaction.customId.split('_');
        const type = parts[1]; // 'inventory' or 'crafting'
        const category = parts.length > 2 ? parts.slice(2).join('_') : null;
        
        if (!category) {
          return await sendTemporaryReply(interaction, '❌ 카테고리를 선택한 후 사용해주세요.');
        }
        
        // 추가/삭제 선택 버튼
        const addButton = new ButtonBuilder()
          .setCustomId(`manage_add_${type}_${category}`)
          .setLabel(type === 'inventory' ? '➕ 물품 추가' : '➕ 품목 추가')
          .setStyle(ButtonStyle.Success);
        
        const removeButton = new ButtonBuilder()
          .setCustomId(`manage_remove_${type}_${category}`)
          .setLabel(type === 'inventory' ? '➖ 물품 삭제' : '➖ 품목 삭제')
          .setStyle(ButtonStyle.Danger);
        
        const row = new ActionRowBuilder().addComponents(addButton, removeButton);
        
        await sendTemporaryReply(interaction, {
          content: `📝 **${category}** 카테고리 ${type === 'inventory' ? '물품' : '품목'} 관리\n\n원하는 작업을 선택하세요:`,
          components: [row]
        }, 15000);
        
      } catch (error) {
        console.error('❌ 관리 버튼 에러:', error);
        if (!interaction.replied && !interaction.deferred) {
          await sendTemporaryReply(interaction, '오류가 발생했습니다.').catch(() => {});
        }
      }
    }
    
    else if (interaction.customId.startsWith('manage_add')) {
      try {
        // 이미 응답했는지 확인
        if (interaction.replied || interaction.deferred) {
          console.log('⚠️ 이미 응답한 인터랙션, 무시');
          return;
        }
        
        const parts = interaction.customId.split('_');
        const type = parts[2]; // 'inventory' or 'crafting'
        const category = parts.slice(3).join('_');
        
        const { ModalBuilder, TextInputBuilder, TextInputStyle } = await import('discord.js');
        
        const modal = new ModalBuilder()
          .setCustomId(`add_item_modal_${type}_${category}`)
          .setTitle(`➕ ${type === 'inventory' ? '물품' : '품목'} 추가 - ${category}`);
        
        const nameInput = new TextInputBuilder()
          .setCustomId('item_name')
          .setLabel(type === 'inventory' ? '아이템 이름' : '제작품 이름')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('예: 다이아몬드')
          .setRequired(true);
        
        const initialSetsInput = new TextInputBuilder()
          .setCustomId('initial_sets')
          .setLabel('초기 수량 - 세트 (1세트 = 64개)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('예: 0')
          .setValue('0')
          .setRequired(false);
        
        const initialItemsInput = new TextInputBuilder()
          .setCustomId('initial_items')
          .setLabel('초기 수량 - 낱개')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('예: 0')
          .setValue('0')
          .setRequired(false);
        
        const requiredSetsInput = new TextInputBuilder()
          .setCustomId('required_sets')
          .setLabel('충족 수량 - 세트 (1세트 = 64개)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('예: 10')
          .setRequired(false);
        
        const requiredItemsInput = new TextInputBuilder()
          .setCustomId('required_items')
          .setLabel('충족 수량 - 낱개')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('예: 32')
          .setRequired(false);
        
        modal.addComponents(
          new ActionRowBuilder().addComponents(nameInput),
          new ActionRowBuilder().addComponents(initialSetsInput),
          new ActionRowBuilder().addComponents(initialItemsInput),
          new ActionRowBuilder().addComponents(requiredSetsInput),
          new ActionRowBuilder().addComponents(requiredItemsInput)
        );
        
        await interaction.showModal(modal);
        
      } catch (error) {
        console.error('❌ 추가 모달 에러:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
        }
      }
    }
    
    else if (interaction.customId.startsWith('manage_remove')) {
      try {
        // 이미 응답했는지 확인
        if (interaction.replied || interaction.deferred) {
          console.log('⚠️ 이미 응답한 인터랙션, 무시');
          return;
        }
        
        const parts = interaction.customId.split('_');
        const type = parts[2]; // 'inventory' or 'crafting'
        const category = parts.slice(3).join('_');
        
        const inventory = await loadInventory();
        const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
        
        if (!targetData?.[category] || Object.keys(targetData[category]).length === 0) {
          return await interaction.update({
            content: `❌ "${category}" 카테고리에 ${type === 'inventory' ? '아이템' : '제작품'}이 없습니다.`,
            components: []
          });
        }
        
        const items = Object.keys(targetData[category]);
        const itemOptions = items.map(item => ({
          label: item,
          value: item,
          description: `현재: ${targetData[category][item].quantity}개 / 목표: ${targetData[category][item].required}개`
        }));
        
        const { StringSelectMenuBuilder } = await import('discord.js');
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`select_remove_${type}_${category}`)
          .setPlaceholder('삭제할 항목을 선택하세요')
          .addOptions(itemOptions);
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        await interaction.update({
          content: `🗑️ **${category}** 카테고리에서 삭제할 ${type === 'inventory' ? '물품' : '품목'}을 선택하세요:`,
          components: [row]
        });
        
      } catch (error) {
        console.error('❌ 삭제 선택 에러:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
        }
      }
    }
    
    else if (interaction.customId.startsWith('bar_size')) {
      try {
        const parts = interaction.customId.split('_');
        const type = parts[2]; // 'inventory' or 'crafting'
        const category = parts.length > 3 ? parts.slice(3).join('_') : null;
        
        const inventory = await loadInventory();
        const currentLength = inventory.settings?.barLength || 15;
        
        // 모달 생성
        const { ModalBuilder, TextInputBuilder, TextInputStyle } = await import('discord.js');
        
        const modal = new ModalBuilder()
          .setCustomId(`bar_size_modal_${type}_${category || 'all'}`)
          .setTitle('📊 프로그레스 바 크기 설정');
        
        const barSizeInput = new TextInputBuilder()
          .setCustomId('bar_size_value')
          .setLabel('바 크기 (25% ~ 200%)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('예: 100')
          .setValue(String(Math.round(currentLength * 10)))
          .setRequired(true)
          .setMinLength(2)
          .setMaxLength(3);
        
        const row = new ActionRowBuilder().addComponents(barSizeInput);
        modal.addComponents(row);
        
        await interaction.showModal(modal);
        console.log(`📊 바 크기 설정 모달 표시 (현재: ${Math.round(currentLength * 10)}%)`);
      } catch (error) {
        console.error('❌ 바 크기 변경 에러:', error);
        await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
      }
    }
    
    else if (interaction.customId.startsWith('ui_mode')) {
      try {
        const parts = interaction.customId.split('_');
        const type = parts[2]; // 'inventory' or 'crafting'
        const category = parts.length > 3 ? parts.slice(3).join('_') : null;
        
        const inventory = await loadInventory();
        
        // UI 모드 순환: normal -> compact -> detailed -> normal
        let currentMode = inventory.settings?.uiMode || 'normal';
        let newMode;
        if (currentMode === 'normal') newMode = 'compact';
        else if (currentMode === 'compact') newMode = 'detailed';
        else newMode = 'normal';
        
        // 설정 저장
        if (!inventory.settings) inventory.settings = {};
        inventory.settings.uiMode = newMode;
        await saveInventory(inventory);
        
        const barLength = inventory.settings?.barLength || 15;
        let embed;
        if (type === 'crafting') {
          const crafting = inventory.crafting || { categories: {}, crafting: {} };
          embed = createCraftingEmbed(crafting, category, newMode, barLength);
        } else {
          embed = createInventoryEmbed(inventory, category, newMode, barLength);
        }
        
        const messageId = interaction.message.id;
        const isAutoRefreshing = autoRefreshTimers.has(messageId);
        const buttons = createButtons(category, isAutoRefreshing, type || 'inventory', newMode, barLength);
        
        await interaction.update({ embeds: [embed], components: buttons });
        console.log(`📏 UI 모드 변경: ${currentMode} -> ${newMode}`);
      } catch (error) {
        console.error('❌ UI 모드 변경 에러:', error);
        await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
      }
    }
    
    else if (interaction.customId.startsWith('auto_refresh')) {
      try {
        const parts = interaction.customId.split('_');
        const type = parts[2]; // 'inventory' or 'crafting'
        const category = parts.length > 3 ? parts.slice(3).join('_') : null;
        const messageId = interaction.message.id;
        
        // 자동 새로고침 토글
        if (autoRefreshTimers.has(messageId)) {
          // 중지
          clearInterval(autoRefreshTimers.get(messageId));
          autoRefreshTimers.delete(messageId);
          console.log('⏸️ 자동 새로고침 중지:', messageId);
          
          const inventory = await loadInventory();
          let embed;
          
          if (type === 'crafting') {
            const crafting = inventory.crafting || { categories: {}, crafting: {} };
            embed = createCraftingEmbed(crafting, category);
          } else {
            embed = createInventoryEmbed(inventory, category);
          }
          
          const uiMode = inventory.settings?.uiMode || 'normal';
          const barLength = inventory.settings?.barLength || 15;
          const buttons = createButtons(category, false, type || 'inventory', uiMode, barLength);
          
          await interaction.update({ embeds: [embed], components: buttons });
        } else {
          // 시작
          console.log('▶️ 자동 새로고침 시작:', messageId, '/ 타입:', type, '/ 카테고리:', category || '전체');
          
          const inventory = await loadInventory();
          let embed;
          
          if (type === 'crafting') {
            const crafting = inventory.crafting || { categories: {}, crafting: {} };
            embed = createCraftingEmbed(crafting, category);
          } else {
            embed = createInventoryEmbed(inventory, category);
          }
          
          const uiMode = inventory.settings?.uiMode || 'normal';
          const barLength = inventory.settings?.barLength || 15;
          const buttons = createButtons(category, true, type || 'inventory', uiMode, barLength);
          
          await interaction.update({ embeds: [embed], components: buttons });
          
          // 5초마다 자동 새로고침
          const timer = setInterval(async () => {
            try {
              // 메시지가 여전히 존재하는지 확인
              const message = await interaction.message.fetch().catch(() => null);
              if (!message) {
                console.log('⚠️ 메시지가 삭제됨. 자동 새로고침 중지:', messageId);
                clearInterval(timer);
                autoRefreshTimers.delete(messageId);
                return;
              }
              
              const inv = await loadInventory();
              let emb;
              
              if (type === 'crafting') {
                const crafting = inv.crafting || { categories: {}, crafting: {} };
                emb = createCraftingEmbed(crafting, category);
              } else {
                emb = createInventoryEmbed(inv, category);
              }
              
              const uiMode = inv.settings?.uiMode || 'normal';
              const barLength = inv.settings?.barLength || 15;
              const btns = createButtons(category, true, type || 'inventory', uiMode, barLength);
              
              await interaction.message.edit({ embeds: [emb], components: btns });
              console.log('🔄 자동 새로고침 실행:', new Date().toLocaleTimeString());
            } catch (error) {
              console.error('❌ 자동 새로고침 에러:', error);
              // 에러 발생 시 타이머 중지
              clearInterval(timer);
              autoRefreshTimers.delete(messageId);
            }
          }, 5000); // 5초
          
          autoRefreshTimers.set(messageId, timer);
          
          // 10분 후 자동 중지 (안전장치)
          setTimeout(() => {
            if (autoRefreshTimers.has(messageId)) {
              console.log('⏰ 10분 경과. 자동 새로고침 자동 중지:', messageId);
              clearInterval(timer);
              autoRefreshTimers.delete(messageId);
            }
          }, 600000); // 10분
        }
      } catch (error) {
        console.error('❌ 자동 새로고침 토글 에러:', error);
        await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
      }
    }
    
    else if (interaction.customId.startsWith('collecting') || interaction.customId.startsWith('crafting')) {
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
        
        if (!category) {
          return await interaction.reply({ 
            content: `❌ 특정 카테고리를 선택한 후 ${isCrafting ? '제작중' : '수집중'} 버튼을 사용해주세요.\n\`/${isCrafting ? '제작' : '재고'} 카테고리:${isCrafting ? '해양' : '해양'}\` 처럼 카테고리를 지정해주세요.`, 
            ephemeral: true 
          });
        }
        
        const targetData = isCrafting ? inventory.crafting : inventory;
        
        if (!targetData.categories[category]) {
          return await interaction.reply({ 
            content: `❌ "${category}" 카테고리를 찾을 수 없습니다.`, 
            ephemeral: true 
          });
        }
        
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
        const itemOptions = items.map(item => {
          const itemData = targetData.categories[category][item];
          const customEmoji = itemData?.emoji;
          const percentage = (itemData.quantity / itemData.required) * 100;
          
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
            description = `✅ 이미 목표 수량을 달성했습니다 (${Math.round(percentage)}%)`;
          } else if (workingUser) {
            label = `${item} (${workingUser.userName} 작업중)`;
            description = `⚠️ ${workingUser.userName}님이 ${isCrafting ? '제작' : '수집'} 중입니다`;
          }
          
          return {
            label: label,
            value: item,
            emoji: customEmoji || getItemIcon(item, inventory),
            description: description
          };
        });
        
        // 선택 메뉴 생성
        const { StringSelectMenuBuilder } = await import('discord.js');
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`select_item_${isCrafting ? 'crafting' : 'collecting'}_${category}`)
          .setPlaceholder(`${isCrafting ? '제작' : '수집'}할 아이템을 선택하세요`)
          .addOptions(itemOptions);
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        await interaction.reply({
          content: `${isCrafting ? '🔨' : '📦'} **${category}** 카테고리에서 ${isCrafting ? '제작' : '수집'}할 아이템을 선택하세요:`,
          components: [row],
          ephemeral: true
        });
        
      } catch (error) {
        console.error('❌ 버튼 에러:', error);
        await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
      }
    }
    
    else if (interaction.customId.startsWith('stop_collecting_') || interaction.customId.startsWith('stop_crafting_')) {
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
            delete inventory.crafting.crafting[category][itemName];
            await saveInventory(inventory);
            
            await interaction.update({
              content: `✅ **${itemName}** 제작을 중단했습니다.`,
              components: []
            });
            console.log(`✅ ${itemName} 제작 중단 완료`);
            
            // 15초 후 메시지 삭제
            setTimeout(async () => {
              try {
                await interaction.deleteReply();
              } catch (error) {
                // 이미 삭제되었거나 삭제할 수 없는 경우 무시
              }
            }, 15000);
          } else {
            await interaction.update({
              content: `⚠️ **${itemName}** 제작 정보를 찾을 수 없습니다.`,
              components: []
            });
            console.log(`⚠️ ${itemName} 제작 정보 없음`);
          }
        } else {
          if (inventory.collecting?.[category]?.[itemName]) {
            delete inventory.collecting[category][itemName];
            await saveInventory(inventory);
            
            await interaction.update({
              content: `✅ **${itemName}** 수집을 중단했습니다.`,
              components: []
            });
            console.log(`✅ ${itemName} 수집 중단 완료`);
            
            // 15초 후 메시지 삭제
            setTimeout(async () => {
              try {
                await interaction.deleteReply();
              } catch (error) {
                // 이미 삭제되었거나 삭제할 수 없는 경우 무시
              }
            }, 15000);
          } else {
            await interaction.update({
              content: `⚠️ **${itemName}** 수집 정보를 찾을 수 없습니다.`,
              components: []
            });
            console.log(`⚠️ ${itemName} 수집 정보 없음`);
          }
        }
      } catch (error) {
        console.error('❌ 중단 에러:', error);
        await interaction.reply({ 
          content: `❌ 오류가 발생했습니다: ${error.message}`, 
          ephemeral: true 
        }).catch(() => {});
      }
    }
    
    else if (interaction.customId.startsWith('quantity_add_') || interaction.customId.startsWith('quantity_edit_') || interaction.customId.startsWith('quantity_subtract_')) {
      try {
        console.log('🔘 수량 추가/수정/차감 버튼 클릭');
        console.log('  - customId:', interaction.customId);
        
        // quantity_add_inventory_해양_산호 형식 파싱
        // 마지막 _를 기준으로 아이템명 분리
        const lastUnderscoreIndex = interaction.customId.lastIndexOf('_');
        const selectedItem = interaction.customId.substring(lastUnderscoreIndex + 1);
        const prefix = interaction.customId.substring(0, lastUnderscoreIndex);
        const parts = prefix.split('_');
        const action = parts[1]; // 'add', 'edit', or 'subtract'
        const type = parts[2]; // 'inventory' or 'crafting'
        const category = parts.slice(3).join('_');
        
        console.log('  - action:', action);
        console.log('  - type:', type);
        console.log('  - category:', category);
        console.log('  - selectedItem:', selectedItem);
        
        const inventory = await loadInventory();
        const targetData = type === 'inventory' ? inventory : inventory.crafting;
        
        console.log('  - targetData.categories:', Object.keys(targetData.categories || {}));
        
        if (!targetData.categories[category]) {
          console.error('❌ 카테고리를 찾을 수 없습니다:', category);
          return await interaction.reply({ 
            content: `❌ "${category}" 카테고리를 찾을 수 없습니다.`, 
            ephemeral: true 
          });
        }
        
        if (!targetData.categories[category][selectedItem]) {
          console.error('❌ 아이템을 찾을 수 없습니다:', selectedItem);
          return await interaction.reply({ 
            content: `❌ "${selectedItem}" 아이템을 "${category}" 카테고리에서 찾을 수 없습니다.`, 
            ephemeral: true 
          });
        }
        
        const itemData = targetData.categories[category][selectedItem];
        const currentSets = Math.floor(itemData.quantity / 64);
        const remainder = itemData.quantity % 64;
        
        console.log('  - itemData:', itemData);
        console.log('✅ 모달 생성 시작');
        
        // 모달 생성
        const { ModalBuilder, TextInputBuilder, TextInputStyle } = await import('discord.js');
        
        let modalTitle, setsLabel, setsPlaceholder, setsDefault, itemsLabel, itemsPlaceholder, itemsDefault;
        
        if (action === 'add') {
          modalTitle = `${selectedItem} 추가`;
          setsLabel = '추가할 세트 수 (1세트 = 64개)';
          setsPlaceholder = '예: 2';
          setsDefault = '';
          itemsLabel = '추가할 낱개 수';
          itemsPlaceholder = '예: 32';
          itemsDefault = '';
        } else if (action === 'subtract') {
          modalTitle = `${selectedItem} 차감`;
          setsLabel = '차감할 세트 수 (1세트 = 64개)';
          setsPlaceholder = '예: 1';
          setsDefault = '';
          itemsLabel = '차감할 낱개 수';
          itemsPlaceholder = '예: 32';
          itemsDefault = '';
        } else {
          modalTitle = `${selectedItem} 수정 (현재: ${currentSets}세트 + ${remainder}개)`;
          setsLabel = '설정할 세트 수 (1세트 = 64개)';
          setsPlaceholder = '예: 5';
          setsDefault = currentSets.toString();
          itemsLabel = '설정할 낱개 수';
          itemsPlaceholder = '예: 32';
          itemsDefault = remainder.toString();
        }
        
        const modal = new ModalBuilder()
          .setCustomId(`modal_${action}_${type}_${category}_${selectedItem}`)
          .setTitle(modalTitle);
        
        const setsInput = new TextInputBuilder()
          .setCustomId('sets_change')
          .setLabel(setsLabel)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(setsPlaceholder)
          .setValue(setsDefault)
          .setRequired(false);
        
        const itemsInput = new TextInputBuilder()
          .setCustomId('items_change')
          .setLabel(itemsLabel)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder(itemsPlaceholder)
          .setValue(itemsDefault)
          .setRequired(false);
        
        const row1 = new ActionRowBuilder().addComponents(setsInput);
        const row2 = new ActionRowBuilder().addComponents(itemsInput);
        modal.addComponents(row1, row2);
        
        console.log('✅ 모달 표시 시도');
        await interaction.showModal(modal);
        console.log('✅ 모달 표시 완료');
        
      } catch (error) {
        console.error('❌ 수량관리 액션 에러:', error);
        console.error('❌ 에러 스택:', error.stack);
        await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
      }
    }
  }
  
  // 선택 메뉴 인터랙션 처리
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith('select_remove_')) {
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
        delete targetData[category][selectedItem];
        
        addHistory(
          inventory, 
          type, 
          category, 
          selectedItem, 
          'remove', 
          `수량: ${itemData.quantity}/${itemData.required}`, 
          interaction.user.displayName || interaction.user.username
        );
        
        await saveInventory(inventory);
        
        const successEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('✅ 삭제 완료')
          .setDescription(`**카테고리:** ${category}\n**${selectedItem}**이(가) 삭제되었습니다.`);
        
        await interaction.update({
          embeds: [successEmbed],
          components: []
        });
        
      } catch (error) {
        console.error('❌ 삭제 선택 에러:', error);
        await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
      }
    }
    
    else if (interaction.customId.startsWith('select_quantity_')) {
      try {
        const parts = interaction.customId.split('_');
        const type = parts[2]; // 'inventory' or 'crafting'
        const category = parts.slice(3).join('_');
        const selectedItem = interaction.values[0];
        
        // 추가/수정/차감 선택 버튼 생성
        const addButton = new ButtonBuilder()
          .setCustomId(`quantity_add_${type}_${category}_${selectedItem}`)
          .setLabel('➕ 추가')
          .setStyle(ButtonStyle.Success);
        
        const editButton = new ButtonBuilder()
          .setCustomId(`quantity_edit_${type}_${category}_${selectedItem}`)
          .setLabel('✏️ 수정')
          .setStyle(ButtonStyle.Primary);
        
        const subtractButton = new ButtonBuilder()
          .setCustomId(`quantity_subtract_${type}_${category}_${selectedItem}`)
          .setLabel('➖ 차감')
          .setStyle(ButtonStyle.Danger);
        
        const row = new ActionRowBuilder().addComponents(addButton, editButton, subtractButton);
        
        const inventory = await loadInventory();
        const targetData = type === 'inventory' ? inventory : inventory.crafting;
        const itemData = targetData.categories[category][selectedItem];
        const sets = Math.floor(itemData.quantity / 64);
        const remainder = itemData.quantity % 64;
        const icon = getItemIcon(selectedItem, inventory);
        
        await interaction.update({
          content: `📊 ${icon} **${selectedItem}** 수량관리\n\n**현재 수량:** ${sets}세트 + ${remainder}개 (총 ${itemData.quantity}개)\n**목표 수량:** ${itemData.required}개\n\n원하는 작업을 선택하세요:`,
          components: [row]
        });
        
      } catch (error) {
        console.error('❌ 수량관리 선택 에러:', error);
        await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
      }
    }
    
    else if (interaction.customId.startsWith('select_reset_')) {
      try {
        const parts = interaction.customId.replace('select_reset_', '').split('_');
        const type = parts[0]; // 'inventory' or 'crafting'
        const category = parts.slice(1).join('_');
        const selectedItem = interaction.values[0];
        
        const inventory = await loadInventory();
        const targetData = type === 'inventory' ? inventory : inventory.crafting;
        
        if (!targetData.categories[category][selectedItem]) {
          return await interaction.update({
            content: `❌ "${selectedItem}"을(를) 찾을 수 없습니다.`,
            components: []
          });
        }
        
        const oldQuantity = targetData.categories[category][selectedItem].quantity;
        
        if (oldQuantity === 0) {
          return await interaction.update({
            content: `⚠️ **${selectedItem}**은(는) 이미 0개입니다.`,
            components: []
          });
        }
        
        targetData.categories[category][selectedItem].quantity = 0;
        
        addHistory(inventory, type, category, selectedItem, 'reset', 
          `${oldQuantity}개 → 0개`, 
          interaction.user.displayName || interaction.user.username);
        
        await saveInventory(inventory);
        
        const icon = getItemIcon(selectedItem, inventory);
        const successEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('🔄 개별 초기화 완료')
          .setDescription(`**카테고리:** ${category}\n${icon} **${selectedItem}**\n${oldQuantity}개 → 0개`);
        
        await interaction.update({
          embeds: [successEmbed],
          components: []
        });
        
        console.log(`🔄 ${interaction.user.displayName}님이 ${category} - ${selectedItem} 초기화: ${oldQuantity} -> 0`);
        
      } catch (error) {
        console.error('❌ 초기화 선택 에러:', error);
        await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
      }
    }
    
    else if (interaction.customId.startsWith('select_item_')) {
      try {
        const parts = interaction.customId.replace('select_item_', '').split('_');
        const isCrafting = parts[0] === 'crafting';
        const category = parts.slice(1).join('_');
        const selectedItem = interaction.values[0];
        const userId = interaction.user.id;
        const userName = interaction.user.displayName || interaction.user.username;
        
        const inventory = await loadInventory();
        
        // 목표 수량 달성 여부 확인
        const targetData = isCrafting ? inventory.crafting : inventory;
        const itemData = targetData.categories[category][selectedItem];
        const percentage = (itemData.quantity / itemData.required) * 100;
        
        if (percentage >= 100) {
          // 이미 100% 이상 달성
          const icon = getItemIcon(selectedItem, inventory);
          return await interaction.update({
            content: `✅ ${icon} **${selectedItem}**은(는) 이미 목표 수량을 달성했습니다! (${Math.round(percentage)}%)\n${isCrafting ? '제작' : '수집'}할 필요가 없습니다.`,
            components: []
          });
        }
        
        // 이미 다른 사람이 작업 중인지 확인
        let existingWorker = null;
        if (isCrafting) {
          existingWorker = inventory.crafting?.crafting?.[category]?.[selectedItem];
        } else {
          existingWorker = inventory.collecting?.[category]?.[selectedItem];
        }
        
        if (existingWorker && existingWorker.userId !== userId) {
          // 다른 사람이 이미 작업 중
          const icon = getItemIcon(selectedItem, inventory);
          return await interaction.update({
            content: `❌ ${icon} **${selectedItem}**은(는) 이미 **${existingWorker.userName}**님이 ${isCrafting ? '제작' : '수집'} 중입니다.\n다른 아이템을 선택해주세요.`,
            components: []
          });
        }
        
        if (isCrafting) {
          if (!inventory.crafting.crafting) {
            inventory.crafting.crafting = {};
          }
          if (!inventory.crafting.crafting[category]) {
            inventory.crafting.crafting[category] = {};
          }
          
          // 제작 중인 사람 추가
          inventory.crafting.crafting[category][selectedItem] = {
            userId: userId,
            userName: userName,
            startTime: new Date().toISOString()
          };
        } else {
          if (!inventory.collecting) {
            inventory.collecting = {};
          }
          if (!inventory.collecting[category]) {
            inventory.collecting[category] = {};
          }
          
          // 수집 중인 사람 추가
          inventory.collecting[category][selectedItem] = {
            userId: userId,
            userName: userName,
            startTime: new Date().toISOString()
          };
        }
        
        await saveInventory(inventory);
        
        const icon = getItemIcon(selectedItem, inventory);
        
        // 중단 버튼 생성
        const stopButton = new ButtonBuilder()
          .setCustomId(`stop_${isCrafting ? 'crafting' : 'collecting'}_${category}_${selectedItem}`)
          .setLabel(`${isCrafting ? '제작' : '수집'} 중단`)
          .setStyle(ButtonStyle.Danger);
        
        const row = new ActionRowBuilder().addComponents(stopButton);
        
        await interaction.update({
          content: `✅ ${icon} **${selectedItem}** ${isCrafting ? '제작' : '수집'}을 시작했습니다!\n다른 사람들이 ${isCrafting ? '제작' : '재고'}을 확인할 때 당신이 ${isCrafting ? '제작' : '수집'} 중임을 볼 수 있습니다.`,
          components: [row]
        });
        
        console.log(`${isCrafting ? '🔨' : '📦'} ${userName}님이 ${category} - ${selectedItem} ${isCrafting ? '제작' : '수집'} 시작`);
        
      } catch (error) {
        console.error('❌ 아이템 선택 에러:', error);
        await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
      }
    }
  }
  
  // 모달 제출 처리
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('add_item_modal_')) {
      try {
        const parts = interaction.customId.split('_');
        const type = parts[3]; // 'inventory' or 'crafting'
        const category = parts.slice(4).join('_');
        
        const itemName = interaction.fields.getTextInputValue('item_name').trim();
        const initialSets = interaction.fields.getTextInputValue('initial_sets')?.trim() || '0';
        const initialItems = interaction.fields.getTextInputValue('initial_items')?.trim() || '0';
        const requiredSets = interaction.fields.getTextInputValue('required_sets')?.trim() || '0';
        const requiredItems = interaction.fields.getTextInputValue('required_items')?.trim() || '0';
        
        const initialSetsNum = parseInt(initialSets);
        const initialItemsNum = parseInt(initialItems);
        const requiredSetsNum = parseInt(requiredSets);
        const requiredItemsNum = parseInt(requiredItems);
        
        if (!itemName || isNaN(initialSetsNum) || isNaN(initialItemsNum) || isNaN(requiredSetsNum) || isNaN(requiredItemsNum)) {
          return await interaction.reply({ 
            content: '❌ 모든 항목을 올바르게 입력해주세요. (숫자만 입력)', 
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
        const initialSetsDisplay = Math.floor(initialQty / 64);
        const initialRemainderDisplay = initialQty % 64;
        const requiredSetsDisplay = Math.floor(requiredQty / 64);
        const requiredRemainderDisplay = requiredQty % 64;
        
        const successEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ 추가 완료')
          .setDescription(`**카테고리:** ${category}\n${icon} **${itemName}**이(가) 추가되었습니다!\n\n**초기 수량:** ${initialQty}개 (${initialSetsDisplay}세트 + ${initialRemainderDisplay}개)\n**충족 수량:** ${requiredQty}개 (${requiredSetsDisplay}세트 + ${requiredRemainderDisplay}개)`);
        
        const reply = await interaction.reply({ embeds: [successEmbed], ephemeral: true, fetchReply: true });
        
        // 15초 후 자동 삭제
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {
            // 이미 삭제되었거나 삭제할 수 없는 경우 무시
          }
        }, 15000);
        
      } catch (error) {
        console.error('❌ 아이템 추가 모달 제출 에러:', error);
        await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
      }
    }
    
    else if (interaction.customId.startsWith('bar_size_modal_')) {
      try {
        const parts = interaction.customId.split('_');
        const type = parts[3]; // 'inventory' or 'crafting'
        const category = parts[4] === 'all' ? null : parts.slice(4).join('_');
        
        const barSizeValue = interaction.fields.getTextInputValue('bar_size_value').trim();
        const percentage = parseInt(barSizeValue);
        
        if (isNaN(percentage) || percentage < 25 || percentage > 200) {
          return await interaction.reply({ 
            content: `❌ 25% ~ 200% 사이의 숫자를 입력해주세요. (입력값: ${barSizeValue})`, 
            ephemeral: true 
          });
        }
        
        const newLength = Math.round(percentage / 10);
        
        const inventory = await loadInventory();
        if (!inventory.settings) inventory.settings = {};
        inventory.settings.barLength = newLength;
        await saveInventory(inventory);
        
        const uiMode = inventory.settings?.uiMode || 'normal';
        let embed;
        if (type === 'crafting') {
          const crafting = inventory.crafting || { categories: {}, crafting: {} };
          embed = createCraftingEmbed(crafting, category, uiMode, newLength);
        } else {
          embed = createInventoryEmbed(inventory, category, uiMode, newLength);
        }
        
        const messageId = interaction.message.id;
        const isAutoRefreshing = autoRefreshTimers.has(messageId);
        const buttons = createButtons(category, isAutoRefreshing, type || 'inventory', uiMode, newLength);
        
        await interaction.update({ embeds: [embed], components: buttons });
        console.log(`📊 바 크기 변경: ${percentage}% (길이: ${newLength})`);
      } catch (error) {
        console.error('❌ 바 크기 모달 제출 에러:', error);
        await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
      }
    }
    
    else if (interaction.customId.startsWith('modal_add_') || interaction.customId.startsWith('modal_edit_') || interaction.customId.startsWith('modal_subtract_')) {
      try {
        // modal_add_inventory_해양_산호 형식 파싱
        // 마지막 _를 기준으로 아이템명 분리
        const lastUnderscoreIndex = interaction.customId.lastIndexOf('_');
        const itemName = interaction.customId.substring(lastUnderscoreIndex + 1);
        const prefix = interaction.customId.substring(0, lastUnderscoreIndex);
        const parts = prefix.split('_');
        const action = parts[1]; // 'add', 'edit', or 'subtract'
        const type = parts[2]; // 'inventory' or 'crafting'
        const category = parts.slice(3).join('_');
        
        console.log('📝 모달 제출 - 수량 관리');
        console.log('  - customId:', interaction.customId);
        console.log('  - action:', action);
        console.log('  - type:', type);
        console.log('  - category:', category);
        console.log('  - itemName:', itemName);
        
        const setsInput = interaction.fields.getTextInputValue('sets_change').trim();
        const itemsInput = interaction.fields.getTextInputValue('items_change').trim();
        
        const inventory = await loadInventory();
        const targetData = type === 'inventory' ? inventory : inventory.crafting;
        
        console.log('  - targetData.categories:', Object.keys(targetData.categories || {}));
        
        if (!targetData.categories[category]) {
          console.error(`❌ 카테고리 "${category}"를 찾을 수 없습니다.`);
          console.error('  - 사용 가능한 카테고리:', Object.keys(targetData.categories || {}));
          return await interaction.reply({ 
            content: `❌ "${category}" 카테고리를 찾을 수 없습니다. (타입: ${type})\n사용 가능한 카테고리: ${Object.keys(targetData.categories || {}).join(', ')}`, 
            ephemeral: true 
          });
        }
        
        if (!targetData.categories[category][itemName]) {
          console.error(`❌ 아이템 "${itemName}"을 카테고리 "${category}"에서 찾을 수 없습니다.`);
          console.error('  - 사용 가능한 아이템:', Object.keys(targetData.categories[category] || {}));
          return await interaction.reply({ 
            content: `❌ "${itemName}" 아이템을 "${category}" 카테고리에서 찾을 수 없습니다.\n사용 가능한 아이템: ${Object.keys(targetData.categories[category] || {}).join(', ')}`, 
            ephemeral: true 
          });
        }
        
        const itemData = targetData.categories[category][itemName];
        const oldQuantity = itemData.quantity;
        const oldSets = Math.floor(oldQuantity / 64);
        const oldRemainder = oldQuantity % 64;
        let newQuantity;
        
        // 입력값 처리 (빈 값은 0으로)
        const sets = setsInput === '' ? 0 : parseFloat(setsInput);
        const items = itemsInput === '' ? 0 : parseFloat(itemsInput);
        
        if (isNaN(sets) || sets < 0 || isNaN(items) || items < 0) {
          return await interaction.reply({ 
            content: `❌ 올바른 숫자를 입력해주세요. (0 이상의 숫자)`, 
            ephemeral: true 
          });
        }
        
        // 세트와 낱개를 합쳐서 총 개수 계산
        const totalChange = Math.round(sets * 64) + Math.round(items);
        
        if (action === 'add') {
          // 추가
          newQuantity = oldQuantity + totalChange;
          
          // 제작품 추가 시 레시피가 있으면 재료 차감
          if (type === 'crafting' && totalChange > 0) {
            const recipe = inventory.crafting?.recipes?.[category]?.[itemName];
            if (recipe) {
              // 재료 충분한지 확인
              let canCraft = true;
              const materialCheck = [];
              
              for (const material of recipe) {
                const materialData = inventory.categories[material.category]?.[material.name];
                const requiredQty = material.quantity * totalChange;
                const currentQty = materialData?.quantity || 0;
                
                materialCheck.push({
                  name: material.name,
                  category: material.category,
                  required: requiredQty,
                  current: currentQty,
                  enough: currentQty >= requiredQty
                });
                
                if (currentQty < requiredQty) {
                  canCraft = false;
                }
              }
              
              if (!canCraft) {
                // 재료 부족
                const lackingMaterials = materialCheck
                  .filter(m => !m.enough)
                  .map(m => {
                    const icon = getItemIcon(m.name, inventory);
                    return `${icon} **${m.name}**: ${m.current}개 / ${m.required}개 필요 (${m.required - m.current}개 부족)`;
                  })
                  .join('\n');
                
                return await interaction.reply({
                  content: `❌ **${itemName}** ${totalChange}개를 제작하기 위한 재료가 부족합니다!\n\n**부족한 재료:**\n${lackingMaterials}`,
                  ephemeral: true
                });
              }
              
              // 재료 차감
              for (const material of recipe) {
                const requiredQty = material.quantity * totalChange;
                inventory.categories[material.category][material.name].quantity -= requiredQty;
                
                // 재료 차감 내역 추가
                addHistory(inventory, 'inventory', material.category, material.name, 'update_quantity',
                  `[제작 재료 소모] ${itemName} ${totalChange}개 제작으로 ${requiredQty}개 소모`,
                  interaction.user.displayName || interaction.user.username);
              }
            }
          }
        } else if (action === 'subtract') {
          // 차감
          newQuantity = Math.max(0, oldQuantity - totalChange);
        } else {
          // 수정 (직접 설정)
          newQuantity = Math.max(0, totalChange);
        }
        
        itemData.quantity = newQuantity;
        
        const newSets = Math.floor(newQuantity / 64);
        const newRemainder = newQuantity % 64;
        
        // 수정 내역 추가
        const actionLabels = {
          'add': '추가',
          'edit': '수정',
          'subtract': '차감'
        };
        const changeDetail = `${oldSets}세트+${oldRemainder}개 (${oldQuantity}개) → ${newSets}세트+${newRemainder}개 (${newQuantity}개)`;
        addHistory(inventory, type, category, itemName, 'update_quantity', 
          `[${actionLabels[action]}] ${changeDetail}`, 
          interaction.user.displayName || interaction.user.username);
        
        await saveInventory(inventory);
        
        const icon = getItemIcon(itemName, inventory);
        const actionEmojis = {
          'add': '➕',
          'edit': '✏️',
          'subtract': '➖'
        };
        
        // 재료 소모 정보 추가 (제작품 추가 시)
        let materialInfo = '';
        if (type === 'crafting' && action === 'add' && totalChange > 0) {
          const recipe = inventory.crafting?.recipes?.[category]?.[itemName];
          if (recipe) {
            const materialList = recipe.map(m => {
              const matIcon = getItemIcon(m.name, inventory);
              const consumed = m.quantity * totalChange;
              return `${matIcon} ${m.name} -${consumed}개`;
            }).join(', ');
            materialInfo = `\n\n**소모된 재료:** ${materialList}`;
          }
        }
        
        const successEmbed = new EmbedBuilder()
          .setColor(action === 'add' ? 0x57F287 : action === 'subtract' ? 0xED4245 : 0x5865F2)
          .setDescription(`### ${actionEmojis[action]} ${actionLabels[action]} 완료\n**카테고리:** ${category}\n${icon} **${itemName}**\n${oldSets}세트+${oldRemainder}개 (${oldQuantity}개)\n↓\n${newSets}세트+${newRemainder}개 (${newQuantity}개)${materialInfo}`);
        
        await sendTemporaryReply(interaction, { embeds: [successEmbed] });
        
        console.log(`${actionEmojis[action]} ${interaction.user.displayName}님이 ${category} - ${itemName} ${actionLabels[action]}: ${oldQuantity} -> ${newQuantity}`);
        
      } catch (error) {
        console.error('❌ 모달 제출 에러:', error);
        await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
      }
    }
  }
});

// 환경 변수에서 토큰 가져오기
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN이 설정되지 않았습니다.');
  console.log('.env 파일에 DISCORD_TOKEN을 설정하세요.');
  process.exit(1);
}

client.login(token).catch(error => {
  console.error('❌ 봇 로그인 실패:', error.message);
  console.log('토큰을 확인하세요. Discord Developer Portal에서 새 토큰을 발급받아야 할 수 있습니다.');
});
