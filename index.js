import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { connectDatabase, loadInventory, watchInventoryChanges, addChangeListener, migrateFromDataFile, initializeItemPoints } from './src/database.js';
import { createCraftingEmbed, createInventoryEmbed, createButtons } from './src/embeds.js';
import { handleButtonInteraction } from './src/handlers/buttons.js';
import { handleSelectInteraction } from './src/handlers/selects.js';
import { handleModalInteraction } from './src/handlers/modals.js';
import { handleCommandInteraction } from './src/handlers/commands.js';
import { handleQuantityModal } from './src/handlers/modalHandlers/quantityModal.js';
import apiServer from './api-server.js';
import { updateBotInfo, addEvent } from './src/statusLogger.js';
import { INTERACTION_CONFIG } from './src/constants.js';

// .env 파일 로드
dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// 활성 메시지 추적 (변경 감지용)
const activeMessages = new Map(); // messageId -> { interaction, category, type, page, timestamp }

// 전역으로 activeMessages 노출 (다른 모듈에서 접근 가능하도록)
global.activeMessages = activeMessages;

// 봇 종료 시 정리
process.on('SIGINT', () => {
  console.log('봇 종료 중...');
  activeMessages.clear();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('봇 종료 중...');
  activeMessages.clear();
  process.exit(0);
});


client.on('ready', async () => {
  console.log(`✅ ${client.user.tag} 봇이 준비되었습니다!`);
  
  // 봇 상태 로깅 시작
  updateBotInfo(client);
  addEvent('bot_ready', { username: client.user.tag, id: client.user.id });
  
  // 5분마다 봇 상태 업데이트
  setInterval(() => {
    updateBotInfo(client);
  }, 5 * 60 * 1000);
  
  // MongoDB 연결
  const connected = await connectDatabase();
  if (!connected) {
    console.error('❌ MongoDB 연결 실패로 봇을 종료합니다.');
    process.exit(1);
  }
  
  // data.js에서 마이그레이션 시도
  try {
    const { inventoryData } = await import('./data.js');
    await migrateFromDataFile(inventoryData);
  } catch (error) {
    console.log('ℹ️ data.js 파일이 없습니다. (정상 - MongoDB만 사용)');
  }
  
  // 아이템 배점 초기화
  await initializeItemPoints();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 재고 관리: /재고');
  console.log('🔨 제작 관리: /제작 (레시피는 제작 화면 버튼으로 관리)');
  console.log('🔧 기타: /도움말, /수정내역, /기여도, /이모지설정, /기여도초기화');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // 변경 감지 시작
  watchInventoryChanges();
  
  // 변경 감지 리스너 등록
  addChangeListener(async () => {
    console.log('🔄 데이터 변경 감지 - 활성 메시지 업데이트 중...');
    
    const now = Date.now();
    const TEN_MINUTES = 10 * 60 * 1000; // 10분
    
    // 모든 활성 메시지 업데이트
    for (const [messageId, data] of activeMessages.entries()) {
      try {
        // 10분 이상 지난 메시지는 제거
        if (now - data.timestamp > TEN_MINUTES) {
          console.log(`⏰ 활성 메시지 만료: ${messageId} (10분 경과)`);
          activeMessages.delete(messageId);
          continue;
        }
        
        const { interaction, category, type, page = 0 } = data;
        const inventory = await loadInventory();
        const uiMode = inventory.settings?.uiMode || 'normal';
        const barLength = inventory.settings?.barLength || 15;
        
        let embed, items, totalPages;
        if (type === 'crafting') {
          const crafting = inventory.crafting || { categories: {}, crafting: {} };
          items = Object.entries(crafting.categories[category] || {});
          totalPages = Math.ceil(items.length / 25);
          embed = createCraftingEmbed(crafting, category, uiMode, barLength, page, inventory);
        } else {
          items = Object.entries(inventory.categories[category] || {});
          totalPages = Math.ceil(items.length / 25);
          embed = createInventoryEmbed(inventory, category, uiMode, barLength, page);
        }
        
        const buttons = createButtons(category, true, type, uiMode, barLength, inventory, interaction.user.id, page, totalPages);
        await interaction.editReply({ embeds: [embed], components: buttons });
        
        console.log(`✅ 메시지 업데이트 완료: ${messageId}`);
      } catch (error) {
        console.log(`⚠️ 메시지 업데이트 실패 (삭제됨?): ${messageId}`);
        activeMessages.delete(messageId);
      }
    }
  });
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // 슬래시 커맨드 자동 등록
  try {
    console.log('슬래시 커맨드 등록 중...');
    const { REST, Routes, SlashCommandBuilder } = await import('discord.js');
    
    const commands = [
      new SlashCommandBuilder()
        .setName('재고')
        .setDescription('재고 현황을 확인합니다 (버튼으로 모든 기능 사용 가능)')
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
        .setName('제작')
        .setDescription('제작 현황을 확인합니다 (버튼으로 모든 기능 사용 가능)')
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
        .setName('수정내역')
        .setDescription('재고 및 제작 수정 내역을 확인합니다')
        .addIntegerOption(option =>
          option.setName('개수')
            .setDescription('확인할 내역 개수 (기본: 10개)')
            .setRequired(false)),
      new SlashCommandBuilder()
        .setName('도움말')
        .setDescription('재고 관리 봇 사용법을 확인합니다'),
      new SlashCommandBuilder()
        .setName('기여도')
        .setDescription('재고 및 제작 기여도 순위를 확인합니다'),
      new SlashCommandBuilder()
        .setName('이모지설정')
        .setDescription('아이템의 이모지를 설정합니다')
        .addStringOption(option =>
          option.setName('타입')
            .setDescription('재고 또는 제작')
            .setRequired(true)
            .addChoices(
              { name: '재고', value: 'inventory' },
              { name: '제작', value: 'crafting' }
            ))
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
            .setDescription('아이템 이름')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('이모지')
            .setDescription('설정할 이모지 (예: 🪵, ⚙️, 💎)')
            .setRequired(true)),
      new SlashCommandBuilder()
        .setName('기여도초기화')
        .setDescription('기여도 통계를 초기화합니다 (수정 내역 삭제)'),
      new SlashCommandBuilder()
        .setName('복구')
        .setDescription('중간 제작품 연동을 복구합니다 (재고-제작 연결 수정)')
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


// 중복 인터랙션 방지용 Map (customId별 마지막 처리 시간 추적)
const lastProcessedTime = new Map();
const { DEBOUNCE_MS, DEBOUNCE_CLEANUP_INTERVAL, DEBOUNCE_MAX_AGE } = INTERACTION_CONFIG;

// 주기적으로 오래된 debounce 항목 정리 (메모리 누수 방지)
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  for (const [key, time] of lastProcessedTime.entries()) {
    if (now - time > DEBOUNCE_MAX_AGE) {
      lastProcessedTime.delete(key);
      cleanedCount++;
    }
  }
  if (cleanedCount > 0) {
    console.log(`🧹 Debounce Map 정리: ${cleanedCount}개 항목 제거 (현재 ${lastProcessedTime.size}개)`);
  }
}, DEBOUNCE_CLEANUP_INTERVAL);

// 슬래시 커맨드 처리
client.on('interactionCreate', async (interaction) => {
  const customId = interaction.customId || `command_${interaction.commandName}`;
  const now = Date.now();
  
  console.log('인터랙션 수신:', interaction.type, '/ customId:', interaction.customId || 'N/A', '/ ID:', interaction.id);
  
  // 중복 인터랙션 체크 (같은 customId가 1초 이내에 다시 오면 무시)
  const lastTime = lastProcessedTime.get(customId);
  if (lastTime && (now - lastTime) < DEBOUNCE_MS) {
    console.log('⚠️ 중복 인터랙션 감지 (디바운스), 무시:', customId, `(${now - lastTime}ms 전)`);
    return;
  }
  
  // 마지막 처리 시간 업데이트
  lastProcessedTime.set(customId, now);
  console.log('✅ 인터랙션 처리 시작:', customId);
  
  // 이벤트 로깅
  addEvent('interaction', {
    type: interaction.type,
    customId: interaction.customId || 'N/A',
    user: interaction.user.tag,
    channelId: interaction.channelId
  });
  
  if (interaction.isCommand()) {
    return await handleCommandInteraction(interaction, activeMessages);
  }

  // 버튼 인터랙션 처리
  if (interaction.isButton()) {
    return await handleButtonInteraction(interaction);
  }
  
  // 선택 메뉴 인터랙션 처리
  if (interaction.isStringSelectMenu()) {
    return await handleSelectInteraction(interaction);
  }
  
  // 모달 제출 처리
  if (interaction.isModalSubmit()) {
    // 분리된 modal 핸들러로 처리 시도
    const handled = await handleModalInteraction(interaction);
    
    // 처리되지 않은 경우 (수량 관리 등)
    if (!handled) {
      if (interaction.customId.startsWith('modal_add_') ||
          interaction.customId.startsWith('modal_edit_') ||
          interaction.customId.startsWith('modal_subtract_') ||
          interaction.customId.startsWith('modal_edit_required_')) {
        return await handleQuantityModal(interaction);
      }
    }
  } // isModalSubmit() 닫기
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
