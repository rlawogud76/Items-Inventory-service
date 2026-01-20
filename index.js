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
async function sendTemporaryReply(interaction, content, deleteAfter = 10000) {
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
      
      // 제작 중인 사람 확인
      const craftingInfo = crafting.crafting?.[categoryName]?.[itemName];
      const craftingText = craftingInfo 
        ? `\n> 🔨 **제작중:** ${craftingInfo.userName}` 
        : '';
      
      let fieldValue;
      
      if (uiMode === 'compact') {
        // 컴팩트 모드: 한 줄로 표시
        fieldValue = `${data.quantity}/${data.required} ${progressBar} ${percentage}% ${status}${craftingInfo ? ` 🔨 ${craftingInfo.userName}` : ''}`;
      } else if (uiMode === 'detailed') {
        // 상세 모드: 더 많은 정보
        fieldValue = [
          `**현재 수량:** ${data.quantity}개`,
          `**충족 수량:** ${data.required}개`,
          `**진행률:** ${percentage}% ${status}`,
          `${progressBar}${craftingText}`
        ].join('\n');
      } else {
        // 일반 모드
        fieldValue = [
          `**현재 수량:** ${data.quantity} / **충족 수량:** ${data.required}`,
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
      
      // 수집 중인 사람 확인
      const collectingInfo = inventory.collecting?.[categoryName]?.[itemName];
      const collectingText = collectingInfo 
        ? `\n> 👤 **수집중:** ${collectingInfo.userName}` 
        : '';
      
      let fieldValue;
      
      if (uiMode === 'compact') {
        // 컴팩트 모드: 한 줄로 표시
        fieldValue = `${data.quantity}/${data.required} ${progressBar} ${percentage}% ${status}${collectingInfo ? ` 👤 ${collectingInfo.userName}` : ''}`;
      } else if (uiMode === 'detailed') {
        // 상세 모드: 더 많은 정보
        fieldValue = [
          `**현재 수량:** ${data.quantity}개`,
          `**충족 수량:** ${data.required}개`,
          `**진행률:** ${percentage}% ${status}`,
          `${progressBar}${collectingText}`
        ].join('\n');
      } else {
        // 일반 모드
        fieldValue = [
          `**현재 수량:** ${data.quantity} / **충족 수량:** ${data.required}`,
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
  const refreshId = categoryName ? `refresh_${type}_${categoryName}` : `refresh_${type}`;
  const actionId = categoryName ? `${type === 'inventory' ? 'collecting' : 'crafting'}_${categoryName}` : (type === 'inventory' ? 'collecting' : 'crafting');
  const autoRefreshId = categoryName ? `auto_refresh_${type}_${categoryName}` : `auto_refresh_${type}`;
  const uiModeId = categoryName ? `ui_mode_${type}_${categoryName}` : `ui_mode_${type}`;
  const barSizeId = categoryName ? `bar_size_${type}_${categoryName}` : `bar_size_${type}`;
  
  // UI 모드 버튼 라벨
  let uiModeLabel = '📏 일반';
  if (uiMode === 'compact') uiModeLabel = '📏 컴팩트';
  else if (uiMode === 'detailed') uiModeLabel = '📏 상세';
  
  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(refreshId)
        .setLabel('🔄 새로고침')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(actionId)
        .setLabel(type === 'inventory' ? '📦 수집중' : '🔨 제작중')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(autoRefreshId)
        .setLabel(autoRefresh ? '⏸️ 자동새로고침 중지' : '▶️ 자동새로고침')
        .setStyle(autoRefresh ? ButtonStyle.Danger : ButtonStyle.Secondary)
    );
  
  const row2 = new ActionRowBuilder()
    .addComponents(
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
  console.log('슬래시 커맨드를 사용하세요:');
  console.log('재고 관리: /재고, /현재수량변경, /충족수량변경, /목록추가, /목록제거');
  console.log('제작 관리: /제작, /제작수량변경, /제작충족수량변경, /제작목록추가, /제작목록제거');
  console.log('기타: /도움말');
  
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
            .setDescription('확인할 카테고리 (선택 안하면 전체)')
            .setRequired(false)
            .addChoices(
              { name: '해양', value: '해양' },
              { name: '채광', value: '채광' },
              { name: '요리', value: '요리' }
            )),
      new SlashCommandBuilder()
        .setName('현재수량변경')
        .setDescription('아이템의 현재 수량을 변경합니다')
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
            .setDescription('변경할 아이템 이름')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('수량')
            .setDescription('새로운 현재 수량')
            .setRequired(true)),
      new SlashCommandBuilder()
        .setName('충족수량변경')
        .setDescription('아이템의 충족 수량을 변경합니다')
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
            .setDescription('변경할 아이템 이름')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('수량')
            .setDescription('새로운 충족 수량')
            .setRequired(true)),
      new SlashCommandBuilder()
        .setName('도움말')
        .setDescription('재고 관리 봇 사용법을 확인합니다'),
      new SlashCommandBuilder()
        .setName('목록추가')
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
            .setDescription('초기 수량 (기본값: 0)')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('이모지')
            .setDescription('아이템 이모지 (선택사항)')
            .setRequired(false)),
      new SlashCommandBuilder()
        .setName('목록제거')
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
            .setDescription('확인할 카테고리 (선택 안하면 전체)')
            .setRequired(false)
            .addChoices(
              { name: '해양', value: '해양' },
              { name: '채광', value: '채광' },
              { name: '요리', value: '요리' }
            )),
      new SlashCommandBuilder()
        .setName('제작목록추가')
        .setDescription('새로운 제작품을 추가합니다')
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
            .setDescription('초기 수량 (기본값: 0)')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('이모지')
            .setDescription('제작품 이모지 (선택사항)')
            .setRequired(false)),
      new SlashCommandBuilder()
        .setName('제작목록제거')
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
        .setName('제작수량변경')
        .setDescription('제작품의 현재 수량을 변경합니다')
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
            .setDescription('변경할 제작품 이름')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('수량')
            .setDescription('새로운 현재 수량')
            .setRequired(true)),
      new SlashCommandBuilder()
        .setName('제작충족수량변경')
        .setDescription('제작품의 충족 수량을 변경합니다')
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
            .setDescription('변경할 제작품 이름')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('수량')
            .setDescription('새로운 충족 수량')
            .setRequired(true)),
      new SlashCommandBuilder()
        .setName('수정내역')
        .setDescription('재고 및 제작 수정 내역을 확인합니다')
        .addIntegerOption(option =>
          option.setName('개수')
            .setDescription('확인할 내역 개수 (기본: 10개)')
            .setRequired(false))
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
        const barLength = inventory.settings?.barLength || 10;
        const embed = createInventoryEmbed(inventory, category, uiMode, barLength);
        const buttons = createButtons(category, false, 'inventory', uiMode, barLength);
        await interaction.reply({ embeds: [embed], components: buttons });
      }

      else if (commandName === '현재수량변경') {
        const category = interaction.options.getString('카테고리');
        const itemName = interaction.options.getString('아이템');
        const newQuantity = interaction.options.getInteger('수량');

        const inventory = await loadInventory();
        if (!inventory.categories[category]) {
          return sendTemporaryReply(interaction, `❌ "${category}" 카테고리를 찾을 수 없습니다.`);
        }
        if (!inventory.categories[category][itemName]) {
          return sendTemporaryReply(interaction, `❌ "${itemName}" 아이템을 찾을 수 없습니다.`);
        }

        const oldQuantity = inventory.categories[category][itemName].quantity;
        inventory.categories[category][itemName].quantity = newQuantity;
        
        // 수정 내역 추가
        addHistory(inventory, 'inventory', category, itemName, 'update_quantity', 
          `${oldQuantity}개 → ${newQuantity}개`, 
          interaction.user.displayName || interaction.user.username);
        
        await saveInventory(inventory);

        const icon = getItemIcon(itemName, inventory);
        const successEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setDescription(`### ✅ 현재 수량 변경 완료\n**카테고리:** ${category}\n${icon} **${itemName}**\n${oldQuantity}개 → ${newQuantity}개`);
        
        await sendTemporaryReply(interaction, { embeds: [successEmbed] });
      }

      else if (commandName === '충족수량변경') {
        const category = interaction.options.getString('카테고리');
        const itemName = interaction.options.getString('아이템');
        const newRequired = interaction.options.getInteger('수량');

        const inventory = await loadInventory();
        if (!inventory.categories[category]) {
          return sendTemporaryReply(interaction, `❌ "${category}" 카테고리를 찾을 수 없습니다.`);
        }
        if (!inventory.categories[category][itemName]) {
          return sendTemporaryReply(interaction, `❌ "${itemName}" 아이템을 찾을 수 없습니다.`);
        }

        const oldRequired = inventory.categories[category][itemName].required;
        inventory.categories[category][itemName].required = newRequired;
        
        // 수정 내역 추가
        addHistory(inventory, 'inventory', category, itemName, 'update_required', 
          `${oldRequired}개 → ${newRequired}개`, 
          interaction.user.displayName || interaction.user.username);
        
        await saveInventory(inventory);

        const icon = getItemIcon(itemName, inventory);
        const successEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setDescription(`### ✅ 충족 수량 변경 완료\n**카테고리:** ${category}\n${icon} **${itemName}**\n${oldRequired}개 → ${newRequired}개`);
        
        await sendTemporaryReply(interaction, { embeds: [successEmbed] });
      }

      else if (commandName === '도움말') {
        const helpEmbed = new EmbedBuilder()
          .setTitle('📖 재고 관리 봇 사용법')
          .setColor(0x5865F2)
          .setDescription('**카테고리:** 해양, 채광, 요리')
          .addFields(
            { name: '📦 재고 관리', value: '━━━━━━━━━━━━━━━━━━━━' },
            { name: '/재고 [카테고리]', value: '재고 현황을 확인합니다.\n예: /재고 카테고리:해양' },
            { name: '/현재수량변경', value: '아이템의 현재 수량을 변경합니다.\n예: /현재수량변경 카테고리:해양 아이템:다이아몬드 수량:50' },
            { name: '/충족수량변경', value: '아이템의 충족 수량을 변경합니다.\n예: /충족수량변경 카테고리:채광 아이템:철괴 수량:200' },
            { name: '/목록추가', value: '새로운 아이템을 추가합니다.\n예: /목록추가 카테고리:요리 아이템:금괴 초기수량:20 충족수량:100' },
            { name: '/목록제거', value: '아이템을 제거합니다.\n예: /목록제거 카테고리:해양 아이템:금괴' },
            { name: '🔨 제작 관리', value: '━━━━━━━━━━━━━━━━━━━━' },
            { name: '/제작 [카테고리]', value: '제작 현황을 확인합니다.\n예: /제작 카테고리:해양' },
            { name: '/제작수량변경', value: '제작품의 현재 수량을 변경합니다.\n예: /제작수량변경 카테고리:채광 제작품:곡괭이 수량:5' },
            { name: '/제작충족수량변경', value: '제작품의 충족 수량을 변경합니다.\n예: /제작충족수량변경 카테고리:요리 제작품:빵 수량:10' },
            { name: '/제작목록추가', value: '새로운 제작품을 추가합니다.\n예: /제작목록추가 카테고리:해양 제작품:낚싯대 초기수량:3 충족수량:10' },
            { name: '/제작목록제거', value: '제작품을 제거합니다.\n예: /제작목록제거 카테고리:채광 제작품:곡괭이' }
          );
        await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
      }

      else if (commandName === '목록추가') {
        const category = interaction.options.getString('카테고리');
        const itemName = interaction.options.getString('아이템');
        const requiredQuantity = interaction.options.getInteger('충족수량');
        const initialQuantity = interaction.options.getInteger('초기수량') || 0;
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

      else if (commandName === '목록제거') {
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
          const timeStr = date.toLocaleString('ko-KR', { 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          
          const typeEmoji = history.type === 'inventory' ? '📦' : '🔨';
          const actionText = {
            'add': '추가',
            'remove': '제거',
            'update_quantity': '현재 수량 변경',
            'update_required': '충족 수량 변경'
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
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }

      else if (commandName === '제작') {
        const category = interaction.options.getString('카테고리');
        const inventory = await loadInventory();
        const crafting = inventory.crafting || { categories: {}, crafting: {} };
        const uiMode = inventory.settings?.uiMode || 'normal';
        const barLength = inventory.settings?.barLength || 10;
        const embed = createCraftingEmbed(crafting, category, uiMode, barLength);
        const buttons = createButtons(category, false, 'crafting', uiMode, barLength);
        await interaction.reply({ embeds: [embed], components: buttons });
      }

      else if (commandName === '제작목록추가') {
        const category = interaction.options.getString('카테고리');
        const itemName = interaction.options.getString('제작품');
        const requiredQuantity = interaction.options.getInteger('충족수량');
        const initialQuantity = interaction.options.getInteger('초기수량') || 0;
        const emoji = interaction.options.getString('이모지');

        const inventory = await loadInventory();
        
        if (!inventory.crafting) {
          inventory.crafting = { categories: {}, crafting: {} };
        }
        if (!inventory.crafting.categories[category]) {
          inventory.crafting.categories[category] = {};
        }
        
        if (inventory.crafting.categories[category][itemName]) {
          return sendTemporaryReply(interaction, `❌ "${itemName}" 제작품이 이미 존재합니다.`);
        }

        inventory.crafting.categories[category][itemName] = {
          quantity: initialQuantity,
          required: requiredQuantity
        };
        
        if (emoji) {
          inventory.crafting.categories[category][itemName].emoji = emoji;
        }
        
        // 수정 내역 추가
        addHistory(inventory, 'crafting', category, itemName, 'add', 
          `초기: ${initialQuantity}개, 목표: ${requiredQuantity}개`, 
          interaction.user.displayName || interaction.user.username);
        
        await saveInventory(inventory);

        const icon = emoji || getItemIcon(itemName, inventory);
        const successEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setDescription(`### ✅ 제작 목록 추가 완료\n**카테고리:** ${category}\n${icon} **${itemName}**이(가) 제작 목록에 추가되었습니다!\n\n**초기 수량:** ${initialQuantity}개\n**충족 수량:** ${requiredQuantity}개`);
        
        await sendTemporaryReply(interaction, { embeds: [successEmbed] });
      }

      else if (commandName === '제작목록제거') {
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

      else if (commandName === '제작수량변경') {
        const category = interaction.options.getString('카테고리');
        const itemName = interaction.options.getString('제작품');
        const newQuantity = interaction.options.getInteger('수량');

        const inventory = await loadInventory();
        if (!inventory.crafting?.categories[category]) {
          return sendTemporaryReply(interaction, `❌ "${category}" 카테고리를 찾을 수 없습니다.`);
        }
        if (!inventory.crafting.categories[category][itemName]) {
          return sendTemporaryReply(interaction, `❌ "${itemName}" 제작품을 찾을 수 없습니다.`);
        }

        const oldQuantity = inventory.crafting.categories[category][itemName].quantity;
        inventory.crafting.categories[category][itemName].quantity = newQuantity;
        
        // 수정 내역 추가
        addHistory(inventory, 'crafting', category, itemName, 'update_quantity', 
          `${oldQuantity}개 → ${newQuantity}개`, 
          interaction.user.displayName || interaction.user.username);
        
        await saveInventory(inventory);

        const icon = getItemIcon(itemName, inventory);
        const successEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setDescription(`### ✅ 제작 수량 변경 완료\n**카테고리:** ${category}\n${icon} **${itemName}**\n${oldQuantity}개 → ${newQuantity}개`);
        
        await sendTemporaryReply(interaction, { embeds: [successEmbed] });
      }

      else if (commandName === '제작충족수량변경') {
        const category = interaction.options.getString('카테고리');
        const itemName = interaction.options.getString('제작품');
        const newRequired = interaction.options.getInteger('수량');

        const inventory = await loadInventory();
        if (!inventory.crafting?.categories[category]) {
          return sendTemporaryReply(interaction, `❌ "${category}" 카테고리를 찾을 수 없습니다.`);
        }
        if (!inventory.crafting.categories[category][itemName]) {
          return sendTemporaryReply(interaction, `❌ "${itemName}" 제작품을 찾을 수 없습니다.`);
        }

        const oldRequired = inventory.crafting.categories[category][itemName].required;
        inventory.crafting.categories[category][itemName].required = newRequired;
        
        // 수정 내역 추가
        addHistory(inventory, 'crafting', category, itemName, 'update_required', 
          `${oldRequired}개 → ${newRequired}개`, 
          interaction.user.displayName || interaction.user.username);
        
        await saveInventory(inventory);

        const icon = getItemIcon(itemName, inventory);
        const successEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setDescription(`### ✅ 제작 충족 수량 변경 완료\n**카테고리:** ${category}\n${icon} **${itemName}**\n${oldRequired}개 → ${newRequired}개`);
        
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
        const barLength = inventory.settings?.barLength || 10;
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
    
    else if (interaction.customId.startsWith('bar_size')) {
      try {
        const parts = interaction.customId.split('_');
        const type = parts[2]; // 'inventory' or 'crafting'
        const category = parts.length > 3 ? parts.slice(3).join('_') : null;
        
        const inventory = await loadInventory();
        
        // 바 크기 순환: 5 -> 10 -> 15 -> 20 -> 5
        let currentLength = inventory.settings?.barLength || 10;
        let newLength;
        if (currentLength === 5) newLength = 10;
        else if (currentLength === 10) newLength = 15;
        else if (currentLength === 15) newLength = 20;
        else newLength = 5;
        
        // 설정 저장
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
        console.log(`📊 바 크기 변경: ${currentLength} -> ${newLength} (${Math.round(newLength * 10)}%)`);
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
        
        const barLength = inventory.settings?.barLength || 10;
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
          const barLength = inventory.settings?.barLength || 10;
          const buttons = createButtons(category, false, type || 'inventory', uiMode, barLength);
          
          await interaction.update({ embeds: [embed], components: [buttons] });
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
          const barLength = inventory.settings?.barLength || 10;
          const buttons = createButtons(category, true, type || 'inventory', uiMode, barLength);
          
          await interaction.update({ embeds: [embed], components: [buttons] });
          
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
              const barLength = inv.settings?.barLength || 10;
              const btns = createButtons(category, true, type || 'inventory', uiMode, barLength);
              
              await interaction.message.edit({ embeds: [emb], components: [btns] });
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
          return {
            label: item,
            value: item,
            emoji: customEmoji || getItemIcon(item, inventory)
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
  }
  
  // 선택 메뉴 인터랙션 처리
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith('select_item_')) {
      try {
        const parts = interaction.customId.replace('select_item_', '').split('_');
        const isCrafting = parts[0] === 'crafting';
        const category = parts.slice(1).join('_');
        const selectedItem = interaction.values[0];
        const userId = interaction.user.id;
        const userName = interaction.user.displayName || interaction.user.username;
        
        const inventory = await loadInventory();
        
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
        
        const icon = getItemIcon(selectedItem);
        
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
