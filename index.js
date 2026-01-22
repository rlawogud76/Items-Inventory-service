import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import dotenv from 'dotenv';
import { connectDatabase, loadInventory, saveInventory, migrateFromDataFile, watchInventoryChanges, addChangeListener, removeChangeListener } from './src/database.js';
import { 
  formatQuantity, 
  formatQuantityString, 
  getItemTag, 
  getItemsByTag, 
  getAllTags, 
  getStatusEmoji, 
  getItemIcon, 
  createProgressBar,
  addHistory,
  sendTemporaryReply
} from './src/utils.js';
import { createCraftingEmbed, createInventoryEmbed, createButtons } from './src/embeds.js';
import { handleButtonInteraction } from './src/handlers/buttons.js';
import { handleSelectInteraction } from './src/handlers/selects.js';

// .env 파일 로드
dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// 활성 메시지 추적 (변경 감지용)
const activeMessages = new Map(); // messageId -> { interaction, category, type }

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
  
  // 봇 이름 변경 (선택사항 - 원하는 이름으로 변경)
  // await client.user.setUsername('새로운봇이름');
  
  // 봇 프로필 사진 변경 (선택사항)
  // 방법 1: URL에서 이미지 가져오기
  // await client.user.setAvatar('https://example.com/image.png');
  
  // 방법 2: 로컬 파일 사용 (프로젝트에 이미지 파일 추가 필요)
  // await client.user.setAvatar('./avatar.png');
  
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
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 재고 관리: /재고, /재고물품추가, /재고물품제거');
  console.log('🔨 제작 관리: /제작, /제작품목추가, /제작품목제거');
  console.log('📋 레시피 관리: /레시피조회, /레시피수정, /레시피삭제');
  console.log('🔧 기타: /도움말, /수정내역');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // 변경 감지 시작
  watchInventoryChanges();
  
  // 변경 감지 리스너 등록
  addChangeListener(async (change) => {
    console.log('🔄 데이터 변경 감지 - 활성 메시지 업데이트 중...');
    
    // 모든 활성 메시지 업데이트
    for (const [messageId, data] of activeMessages.entries()) {
      try {
        const { interaction, category, type } = data;
        const inventory = await loadInventory();
        const uiMode = inventory.settings?.uiMode || 'normal';
        const barLength = inventory.settings?.barLength || 15;
        
        let embed, items, totalPages;
        if (type === 'crafting') {
          const crafting = inventory.crafting || { categories: {}, crafting: {} };
          items = Object.entries(crafting.categories[category] || {});
          totalPages = Math.ceil(items.length / 25);
          embed = createCraftingEmbed(crafting, category, uiMode, barLength, 0);
        } else {
          items = Object.entries(inventory.categories[category] || {});
          totalPages = Math.ceil(items.length / 25);
          embed = createInventoryEmbed(inventory, category, uiMode, barLength, 0);
        }
        
        const buttons = createButtons(category, true, type, uiMode, barLength, inventory, interaction.user.id, 0, totalPages);
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
        .setName('통계')
        .setDescription('마을 재고 및 제작 통계를 확인합니다'),
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
        .setDescription('기여도 통계를 초기화합니다 (수정 내역 삭제)')
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
        
        // 먼저 응답 (3초 제한 회피)
        await interaction.deferReply();
        
        try {
          const inventory = await loadInventory();
          const uiMode = inventory.settings?.uiMode || 'normal';
          const barLength = inventory.settings?.barLength || 15;
          
          // 페이지 계산
          const items = Object.entries(inventory.categories[category] || {});
          const totalPages = Math.ceil(items.length / 25);
          
          const embed = createInventoryEmbed(inventory, category, uiMode, barLength, 0);
          const buttons = createButtons(category, true, 'inventory', uiMode, barLength, inventory, interaction.user.id, 0, totalPages);
          const reply = await interaction.editReply({ embeds: [embed], components: buttons, fetchReply: true });
          
          // 활성 메시지로 등록 (변경 감지용)
          const messageId = reply.id;
          activeMessages.set(messageId, {
            interaction,
            category,
            type: 'inventory'
          });
          
          console.log(`📌 활성 메시지 등록: ${messageId} (재고 - ${category})`);
        } catch (error) {
          console.error('❌ 재고 표시 에러:', error);
          await interaction.editReply({ 
            content: `❌ 재고를 표시하는 중 오류가 발생했습니다.\n${error.message}`,
            embeds: [],
            components: []
          }).catch(() => {});
        }
      }

      else if (commandName === '도움말') {
        const helpEmbed = new EmbedBuilder()
          .setTitle('📖 재고 관리 봇 사용법')
          .setColor(0x5865F2)
          .setDescription('**MongoDB 기반 실시간 재고 관리 시스템**\n변경사항이 자동으로 감지되어 즉시 반영됩니다.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
          .addFields(
            { 
              name: '📦 재고 관리', 
              value: [
                '**`/재고 [카테고리]`**',
                '재고 현황을 실시간으로 확인합니다.',
                '> 예: `/재고 카테고리:해양`',
                '> 💡 변경사항이 자동으로 업데이트됩니다!',
                '',
                '**버튼 기능:**',
                '• 📦 수집하기: 작업자 등록 (다른 사람에게 표시)',
                '• 📊 수량관리: 추가/수정/차감/목표 수정',
                '• 📋 물품관리: 물품 추가 및 삭제',
                '• ♻️ 초기화: 개별 또는 일괄 초기화',
                '• 📏 UI 모드: 일반/상세 모드 전환',
                '• 📊 바 크기: 프로그레스 바 크기 조절'
              ].join('\n'),
              inline: false
            },
            { 
              name: '\u200B', 
              value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
              inline: false
            },
            { 
              name: '🔨 제작 관리', 
              value: [
                '**`/제작 [카테고리]`**',
                '제작 현황을 실시간으로 확인합니다.',
                '> 예: `/제작 카테고리:해양`',
                '> 💡 변경사항이 자동으로 업데이트됩니다!',
                '',
                '**버튼 기능:**',
                '• 🔨 제작하기: 작업자 등록 (다른 사람에게 표시)',
                '• 📊 수량관리: 추가/수정/차감/목표 수정',
                '• 📦 품목관리: 품목 추가 및 삭제',
                '• 📋 레시피: 레시피 조회 및 수정',
                '• ♻️ 초기화: 개별 또는 일괄 초기화',
                '• 📏 UI 모드: 일반/상세 모드 전환',
                '• 📊 바 크기: 프로그레스 바 크기 조절'
              ].join('\n'),
              inline: false
            },
            { 
              name: '\u200B', 
              value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
              inline: false
            },
            { 
              name: '📋 레시피 관리', 
              value: [
                '**`/레시피조회 [카테고리]`**',
                '카테고리의 모든 레시피를 확인합니다.',
                '> 재료 충분 여부도 함께 표시됩니다.',
                '',
                '**레시피 버튼 (제작 화면):**',
                '• 📖 조회: 레시피 확인',
                '• ✏️ 수정: 레시피 수정 (최대 5개 재료)'
              ].join('\n'),
              inline: false
            },
            { 
              name: '\u200B', 
              value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
              inline: false
            },
            { 
              name: '🔧 기타 기능', 
              value: [
                '**`/통계`**',
                '마을 전체 통계를 확인합니다.',
                '> 전체 진행률, 카테고리별 현황, 활동 통계, 주의 필요 항목',
                '',
                '**`/이모지설정`**',
                '아이템의 커스텀 이모지를 설정합니다.',
                '> 예: `/이모지설정 타입:재고 카테고리:해양 아이템:나무 이모지:🪵`',
                '',
                '**`/수정내역 [개수]`**',
                '최근 수정 내역을 확인합니다 (최대 25개).',
                '> 예: `/수정내역 개수:20`'
              ].join('\n'),
              inline: false
            },
            { 
              name: '\u200B', 
              value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
              inline: false
            },
            { 
              name: '💡 팁', 
              value: [
                '• **실시간 업데이트**: 누군가 수량을 변경하면 모든 화면이 자동으로 업데이트됩니다.',
                '• **작업자 표시**: 수집하기/제작하기 버튼으로 작업자를 등록하면 다른 사람들이 볼 수 있습니다.',
                '• **자동 삭제**: 선택 메뉴는 30초 후 자동으로 사라집니다.',
                '• **세트 단위**: 수량은 세트(64개) + 낱개로 표시됩니다.',
                '• **진행률 표시**: 🔴(25%↓) 🟡(25-90%) 🟢(90%↑)'
              ].join('\n'),
              inline: false
            }
          );
        await sendTemporaryReply(interaction, { embeds: [helpEmbed] }, 60000);
      }

      else if (commandName === '통계') {
        const inventory = await loadInventory();
        const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
        
        // 전체 진행률 계산
        let totalQuantity = 0, totalRequired = 0;
        let inventoryQuantity = 0, inventoryRequired = 0;
        let craftingQuantity = 0, craftingRequired = 0;
        
        // 카테고리별 통계
        const categoryStats = {
          inventory: {},
          crafting: {}
        };
        
        // 재고 통계
        for (const [category, items] of Object.entries(inventory.categories || {})) {
          let catQty = 0, catReq = 0, completed = 0, total = 0;
          
          for (const [itemName, itemData] of Object.entries(items)) {
            catQty += itemData.quantity;
            catReq += itemData.required;
            total++;
            if (itemData.quantity >= itemData.required) completed++;
          }
          
          inventoryQuantity += catQty;
          inventoryRequired += catReq;
          
          const percentage = catReq > 0 ? Math.round((catQty / catReq) * 100) : 0;
          const emoji = percentage >= 90 ? '🟢' : percentage >= 25 ? '🟡' : '🔴';
          
          categoryStats.inventory[category] = {
            percentage,
            emoji,
            completed,
            total
          };
        }
        
        // 제작 통계
        for (const [category, items] of Object.entries(inventory.crafting?.categories || {})) {
          let catQty = 0, catReq = 0, completed = 0, total = 0;
          
          for (const [itemName, itemData] of Object.entries(items)) {
            catQty += itemData.quantity;
            catReq += itemData.required;
            total++;
            if (itemData.quantity >= itemData.required) completed++;
          }
          
          craftingQuantity += catQty;
          craftingRequired += catReq;
          
          const percentage = catReq > 0 ? Math.round((catQty / catReq) * 100) : 0;
          const emoji = percentage >= 90 ? '🟢' : percentage >= 25 ? '🟡' : '🔴';
          
          categoryStats.crafting[category] = {
            percentage,
            emoji,
            completed,
            total
          };
        }
        
        totalQuantity = inventoryQuantity + craftingQuantity;
        totalRequired = inventoryRequired + craftingRequired;
        
        const totalPercentage = totalRequired > 0 ? Math.round((totalQuantity / totalRequired) * 100) : 0;
        const inventoryPercentage = inventoryRequired > 0 ? Math.round((inventoryQuantity / inventoryRequired) * 100) : 0;
        const craftingPercentage = craftingRequired > 0 ? Math.round((craftingQuantity / craftingRequired) * 100) : 0;
        
        // 최근 7일 활동 통계
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const recentHistory = (inventory.history || []).filter(h => 
          new Date(h.timestamp) >= sevenDaysAgo
        );
        
        // 사용자별 활동
        const userActivity = {};
        recentHistory.forEach(h => {
          userActivity[h.userName] = (userActivity[h.userName] || 0) + 1;
        });
        
        const topUsers = Object.entries(userActivity)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);
        
        // 아이템별 변경 횟수
        const itemActivity = {};
        recentHistory.forEach(h => {
          itemActivity[h.itemName] = (itemActivity[h.itemName] || 0) + 1;
        });
        
        const topItems = Object.entries(itemActivity)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);
        
        // 부족한 아이템 (30% 미만)
        const lackingItems = [];
        for (const [category, items] of Object.entries(inventory.categories || {})) {
          for (const [itemName, itemData] of Object.entries(items)) {
            const percentage = (itemData.quantity / itemData.required) * 100;
            if (percentage < 30) {
              lackingItems.push({
                category,
                name: itemName,
                quantity: itemData.quantity,
                required: itemData.required,
                icon: getItemIcon(itemName, inventory)
              });
            }
          }
        }
        lackingItems.sort((a, b) => (a.quantity / a.required) - (b.quantity / b.required));
        
        // 제작 불가 아이템 (재료 부족)
        const cannotCraft = [];
        for (const [category, items] of Object.entries(inventory.crafting?.categories || {})) {
          for (const [itemName, itemData] of Object.entries(items)) {
            const recipe = inventory.crafting?.recipes?.[category]?.[itemName];
            if (recipe) {
              let canCraft = true;
              const missingMaterials = [];
              
              for (const material of recipe) {
                const matData = inventory.categories[material.category]?.[material.name];
                const currentQty = matData?.quantity || 0;
                if (currentQty < material.quantity) {
                  canCraft = false;
                  missingMaterials.push(material.name);
                }
              }
              
              if (!canCraft) {
                cannotCraft.push({
                  name: itemName,
                  missing: missingMaterials,
                  icon: getItemIcon(itemName, inventory)
                });
              }
            }
          }
        }
        
        // Embed 생성
        const statsEmbed = new EmbedBuilder()
          .setTitle(`📊 마을 재고 통계 (${today})`)
          .setColor(0x5865F2)
          .setDescription([
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            `📦 **전체 진행률: ${totalPercentage}%**`,
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            '',
            '🏘️ **재고:** ' + inventoryPercentage + '%',
            ...Object.entries(categoryStats.inventory).map(([cat, stats]) => 
              `${cat}: ${stats.percentage}% ${stats.emoji} (${stats.completed}/${stats.total} 완료)`
            ),
            '',
            '🔨 **제작:** ' + craftingPercentage + '%',
            ...Object.entries(categoryStats.crafting).map(([cat, stats]) => 
              `${cat}: ${stats.percentage}% ${stats.emoji} (${stats.completed}/${stats.total} 완료)`
            ),
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
          ].join('\n'))
          .setTimestamp();
        
        // 활동 현황 필드
        if (recentHistory.length > 0) {
          // 점수 계산 함수 (횟수 x 수량)
          const calculateScore = (historyList) => {
            const userScores = {};
            
            historyList.forEach(h => {
              if (!userScores[h.userName]) {
                userScores[h.userName] = {
                  score: 0,
                  count: 0,
                  add: 0,
                  update: 0,
                  remove: 0,
                  reset: 0
                };
              }
              
              // details에서 수량 추출 - 추가는 +점수, 차감은 -점수
              let quantity = 0; // 기본값 0
              
              if (h.action === 'add') {
                // 아이템 추가
                const match = h.details.match(/초기:\s*(\d+)개/);
                if (match) {
                  const initialQty = parseInt(match[1]);
                  quantity = initialQty > 0 ? initialQty : 10; // 초기 수량이 있으면 그만큼, 없으면 10점
                } else {
                  quantity = 10; // 기본 10점
                }
              } else if (h.action === 'update_quantity') {
                // "0 -> 192" 형식 - 증가는 +점수, 감소는 0점
                const match1 = h.details.match(/(\d+)\s*->\s*(\d+)/);
                if (match1) {
                  const oldQty = parseInt(match1[1]);
                  const newQty = parseInt(match1[2]);
                  const diff = newQty - oldQty;
                  quantity = diff > 0 ? diff : 0; // 증가만 점수, 감소는 0점
                }
                
                // "192개 추가" 형식 - +점수
                const match2 = h.details.match(/(\d+)개\s*추가/);
                if (match2) {
                  quantity = parseInt(match2[1]);
                }
                
                // "192개 차감" 형식 - 마이너스 점수
                const match3 = h.details.match(/(\d+)개\s*차감/);
                if (match3) {
                  quantity = -parseInt(match3[1]); // 차감은 마이너스 점수
                }
              }
              // remove, reset, update_required는 모두 0점
              
              userScores[h.userName].score += quantity;
              userScores[h.userName].count += 1;
              
              // 활동 유형별 카운트
              if (h.action === 'add') userScores[h.userName].add += 1;
              else if (h.action === 'update_quantity' || h.action === 'update_required') userScores[h.userName].update += 1;
              else if (h.action === 'remove') userScores[h.userName].remove += 1;
              else if (h.action === 'reset') userScores[h.userName].reset += 1;
            });
            
            return Object.entries(userScores)
              .sort((a, b) => b[1].score - a[1].score)
              .slice(0, 3);
          };
          
          // 재고 활동 분석
          const inventoryHistory = recentHistory.filter(h => h.type === 'inventory');
          const topInventoryUsers = calculateScore(inventoryHistory);
          
          // 제작 활동 분석
          const craftingHistory = recentHistory.filter(h => h.type === 'crafting');
          const topCraftingUsers = calculateScore(craftingHistory);
          
          const activityText = [];
          
          // 재고 기여도
          if (topInventoryUsers.length > 0) {
            activityText.push('**📦 재고 관리 기여도 (TOP 3)**');
            activityText.push('');
            
            const medals = ['🥇', '🥈', '🥉'];
            
            topInventoryUsers.forEach(([user, data], idx) => {
              // 상세 정보
              const details = [];
              if (data.add > 0) details.push(`추가 ${data.add}`);
              if (data.update > 0) details.push(`수정 ${data.update}`);
              if (data.remove > 0) details.push(`삭제 ${data.remove}`);
              if (data.reset > 0) details.push(`초기화 ${data.reset}`);
              
              activityText.push(`${medals[idx]} **${user}** - ${Math.round(data.score)}점 (${data.count}회)`);
              activityText.push(`   └ ${details.join(', ')}`);
              activityText.push('');
            });
          }
          
          // 제작 기여도
          if (topCraftingUsers.length > 0) {
            activityText.push('**🔨 제작 관리 기여도 (TOP 3)**');
            activityText.push('');
            
            const medals = ['🥇', '🥈', '🥉'];
            
            topCraftingUsers.forEach(([user, data], idx) => {
              // 상세 정보
              const details = [];
              if (data.add > 0) details.push(`추가 ${data.add}`);
              if (data.update > 0) details.push(`수정 ${data.update}`);
              if (data.remove > 0) details.push(`삭제 ${data.remove}`);
              if (data.reset > 0) details.push(`초기화 ${data.reset}`);
              
              activityText.push(`${medals[idx]} **${user}** - ${Math.round(data.score)}점 (${data.count}회)`);
              activityText.push(`   └ ${details.join(', ')}`);
              activityText.push('');
            });
          }
          
          // 가장 많이 변경된 아이템
          if (topItems.length > 0) {
            activityText.push('**📦 가장 많이 변경된 아이템 (TOP 5)**');
            topItems.slice(0, 5).forEach(([item, count], idx) => {
              activityText.push(`${idx + 1}. ${item} - ${count}회`);
            });
          }
          
          if (activityText.length > 0) {
            statsEmbed.addFields({
              name: '👥 활동 현황 (최근 7일)',
              value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' + activityText.join('\n') + '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
              inline: false
            });
          }
        }
        
        // 주의 필요 필드
        const warningText = [];
        
        if (lackingItems.length > 0) {
          warningText.push(`🔴 **부족한 아이템 (${lackingItems.length}개):**`);
          lackingItems.slice(0, 5).forEach(item => {
            warningText.push(`- ${item.category} > ${item.icon} ${item.name} (${item.quantity}/${item.required})`);
          });
          if (lackingItems.length > 5) {
            warningText.push(`... 외 ${lackingItems.length - 5}개`);
          }
          warningText.push('');
        }
        
        if (cannotCraft.length > 0) {
          warningText.push(`❌ **제작 불가 (재료 부족):**`);
          cannotCraft.slice(0, 5).forEach(item => {
            warningText.push(`- ${item.icon} ${item.name} (${item.missing.join(', ')} 부족)`);
          });
          if (cannotCraft.length > 5) {
            warningText.push(`... 외 ${cannotCraft.length - 5}개`);
          }
        }
        
        if (warningText.length > 0) {
          statsEmbed.addFields({
            name: '⚠️ 주의 필요',
            value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' + warningText.join('\n'),
            inline: false
          });
        }
        
        await sendTemporaryReply(interaction, { embeds: [statsEmbed] }, 30000);
      }

      else if (commandName === '이모지설정') {
        const type = interaction.options.getString('타입');
        const category = interaction.options.getString('카테고리');
        const itemName = interaction.options.getString('아이템');
        const emoji = interaction.options.getString('이모지');
        
        const inventory = await loadInventory();
        
        // 아이템 존재 확인
        const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
        
        if (!targetData?.[category]?.[itemName]) {
          return await sendTemporaryReply(interaction, `❌ "${category}" 카테고리에 "${itemName}" 아이템이 존재하지 않습니다.`);
        }
        
        // 이모지 설정
        targetData[category][itemName].emoji = emoji;
        await saveInventory(inventory);
        
        const successEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ 이모지 설정 완료')
          .setDescription([
            `**타입:** ${type === 'inventory' ? '재고' : '제작'}`,
            `**카테고리:** ${category}`,
            `**아이템:** ${emoji} ${itemName}`,
            '',
            '이제 이 아이템은 설정한 이모지로 표시됩니다.'
          ].join('\n'));
        
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
        
        // 먼저 응답 (3초 제한 회피)
        await interaction.deferReply();
        
        try {
          const inventory = await loadInventory();
          const crafting = inventory.crafting || { categories: {}, crafting: {} };
          const uiMode = inventory.settings?.uiMode || 'normal';
          const barLength = inventory.settings?.barLength || 15;
          
          // 페이지 계산
          const items = Object.entries(crafting.categories[category] || {});
          const totalPages = Math.ceil(items.length / 25);
          
          const embed = createCraftingEmbed(crafting, category, uiMode, barLength, 0);
          const buttons = createButtons(category, true, 'crafting', uiMode, barLength, inventory, interaction.user.id, 0, totalPages);
          const reply = await interaction.editReply({ embeds: [embed], components: buttons, fetchReply: true });
          
          // 활성 메시지로 등록 (변경 감지용)
          const messageId = reply.id;
          activeMessages.set(messageId, {
            interaction,
            category,
            type: 'crafting'
          });
          
          console.log(`📌 활성 메시지 등록: ${messageId} (제작 - ${category})`);
        } catch (error) {
          console.error('❌ 제작 표시 에러:', error);
          await interaction.editReply({ 
            content: `❌ 제작 현황을 표시하는 중 오류가 발생했습니다.\n${error.message}`,
            embeds: [],
            components: []
          }).catch(() => {});
        }
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
          .setDescription(`**총 ${Object.keys(recipes).length}개의 레시피**\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
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

      else if (commandName === '기여도초기화') {
        const inventory = await loadInventory();
        
        // 기여도 데이터 확인
        const historyCount = inventory.history?.length || 0;
        
        if (historyCount === 0) {
          return await sendTemporaryReply(interaction, '❌ 초기화할 기여도 데이터가 없습니다.');
        }
        
        // 확인 버튼 생성
        const confirmRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('confirm_contribution_reset')
              .setLabel('✅ 확인')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('cancel_contribution_reset')
              .setLabel('❌ 취소')
              .setStyle(ButtonStyle.Secondary)
          );
        
        const confirmEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('⚠️ 기여도 초기화 확인')
          .setDescription([
            '**모든 수정 내역이 삭제됩니다!**',
            '',
            `현재 저장된 내역: **${historyCount}개**`,
            '',
            '이 작업은 되돌릴 수 없습니다.',
            '정말로 초기화하시겠습니까?'
          ].join('\n'));
        
        await interaction.reply({ 
          embeds: [confirmEmbed], 
          components: [confirmRow], 
          ephemeral: true 
        });
      }

    } catch (error) {
      console.error('커맨드 실행 에러:', error);
      await interaction.reply({ content: '❌ 에러가 발생했습니다: ' + error.message, ephemeral: true });
    }
  }

  // 버튼 인터랙션 처리
  if (interaction.isButton()) {
    return await handleButtonInteraction(interaction);
  }
  
  // 선택 메뉴 인터랙션 처리
  if (interaction.isStringSelectMenu()) {
    // select_recipe_edit는 여기서 처리 (레시피 수정 시작)
    if (interaction.customId.startsWith('select_recipe_edit_')) {
      try {
        const category = interaction.customId.replace('select_recipe_edit_', '');
        const selectedItem = interaction.values[0];
        const inventory = await loadInventory();
        
        // 현재 레시피 표시
        const currentRecipe = inventory.crafting.recipes?.[category]?.[selectedItem] || [];
        const recipeText = currentRecipe.length > 0
          ? currentRecipe.map(m => `${getItemIcon(m.name, inventory)} ${m.name} x${m.quantity}`).join('\n')
          : '레시피 없음';
        
        // 재료 선택 메뉴 생성
        const materials = Object.keys(inventory.categories[category] || {});
        if (materials.length === 0) {
          return await interaction.update({
            content: `❌ "${category}" 카테고리에 재료가 없습니다.`,
            components: []
          });
        }
        
        const materialOptions = materials.map(mat => ({
          label: mat,
          value: mat,
          emoji: getItemIcon(mat, inventory)
        }));
        
        const { StringSelectMenuBuilder } = await import('discord.js');
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`select_recipe_material_edit_${category}_${selectedItem}_1`)
          .setPlaceholder('재료 1을 선택하세요')
          .addOptions(materialOptions);
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        await interaction.update({
          content: `✏️ **${selectedItem}** 레시피 수정\n\n**현재 레시피:**\n${recipeText}\n\n**새 레시피 입력 - 1단계:** 첫 번째 재료를 선택하세요`,
          components: [row]
        });
        
      } catch (error) {
        console.error('❌ 레시피 수정 선택 에러:', error);
        await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
      }
    }
    // 나머지 모든 select 핸들러는 분리된 핸들러로 처리
    else {
      return await handleSelectInteraction(interaction);
    }
  }
  
  // 모달 제출 처리
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('recipe_edit_quantity_modal_')) {
      try {
        const parts = interaction.customId.replace('recipe_edit_quantity_modal_', '').split('_');
        const category = parts[0];
        const step = parseInt(parts[parts.length - 2]);
        const materialName = parts[parts.length - 1];
        const itemName = parts.slice(1, -2).join('_');
        
        const quantity = parseInt(interaction.fields.getTextInputValue('material_quantity').trim());
        
        if (isNaN(quantity) || quantity <= 0) {
          return await interaction.reply({
            content: '❌ 올바른 수량을 입력해주세요. (1 이상의 숫자)',
            ephemeral: true
          });
        }
        
        const inventory = await loadInventory();
        
        // 첫 번째 재료면 레시피 초기화
        if (step === 1) {
          inventory.crafting.recipes[category][itemName] = [];
        }
        
        // 재료 추가
        inventory.crafting.recipes[category][itemName].push({
          name: materialName,
          quantity: quantity,
          category: category
        });
        
        await saveInventory(inventory);
        
        const icon = getItemIcon(materialName, inventory);
        
        // 다음 재료 추가 또는 완료
        if (step < 3) {
          const addMoreButton = new ButtonBuilder()
            .setCustomId(`add_more_recipe_edit_${category}_${itemName}_${step + 1}`)
            .setLabel(`➕ 재료 ${step + 1} 추가`)
            .setStyle(ButtonStyle.Primary);
          
          const finishButton = new ButtonBuilder()
            .setCustomId(`finish_recipe_edit_${category}_${itemName}`)
            .setLabel('✅ 완료')
            .setStyle(ButtonStyle.Success);
          
          const row = new ActionRowBuilder().addComponents(addMoreButton, finishButton);
          
          const currentRecipe = inventory.crafting.recipes[category][itemName]
            .map(m => `${getItemIcon(m.name, inventory)} ${m.name} x${m.quantity}`)
            .join('\n');
          
          await interaction.reply({
            content: `✅ 재료 ${step} 추가 완료: ${icon} ${materialName} x${quantity}\n\n**현재 레시피:**\n${currentRecipe}\n\n더 추가하시겠습니까?`,
            components: [row],
            ephemeral: true
          });
        } else {
          const currentRecipe = inventory.crafting.recipes[category][itemName]
            .map(m => `${getItemIcon(m.name, inventory)} ${m.name} x${m.quantity}`)
            .join('\n');
          
          await interaction.reply({
            content: `✅ **${itemName}** 레시피 수정 완료!\n\n**새 레시피:**\n${currentRecipe}`,
            ephemeral: true
          });
          
          setTimeout(async () => {
            try {
              await interaction.deleteReply();
            } catch (error) {}
          }, 15000);
        }
        
      } catch (error) {
        console.error('❌ 레시피 수정 모달 제출 에러:', error);
        await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
      }
    }
    
    else if (interaction.customId.startsWith('add_item_modal_')) {
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
        const initialFormatted = formatQuantity(initialQty);
        const requiredFormatted = formatQuantity(requiredQty);
        
        // 제작 품목인 경우 레시피 입력 버튼 추가
        if (type === 'crafting') {
          const addRecipeButton = new ButtonBuilder()
            .setCustomId(`add_recipe_${category}_${itemName}`)
            .setLabel('📝 레시피 추가')
            .setStyle(ButtonStyle.Primary);
          
          const skipButton = new ButtonBuilder()
            .setCustomId(`skip_recipe_${category}_${itemName}`)
            .setLabel('⏭️ 나중에 추가')
            .setStyle(ButtonStyle.Secondary);
          
          const row = new ActionRowBuilder().addComponents(addRecipeButton, skipButton);
          
          const successEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ 제작품 추가 완료')
            .setDescription(`**카테고리:** ${category}\n${icon} **${itemName}**이(가) 추가되었습니다!\n\n**초기 수량:** ${initialQty}개 (${initialSetsDisplay}세트 + ${initialRemainderDisplay}개)\n**충족 수량:** ${requiredQty}개 (${requiredSetsDisplay}세트 + ${requiredRemainderDisplay}개)\n\n레시피를 추가하시겠습니까?`);
          
          await interaction.reply({ embeds: [successEmbed], components: [row], ephemeral: true });
        } else {
          const successEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ 추가 완료')
            .setDescription(`**카테고리:** ${category}\n${icon} **${itemName}**이(가) 추가되었습니다!\n\n**초기 수량:** ${initialQty}개 (${initialFormatted.boxes}상자/${initialFormatted.sets}세트/${initialFormatted.items}개)\n**충족 수량:** ${requiredQty}개 (${requiredFormatted.boxes}상자/${requiredFormatted.sets}세트/${requiredFormatted.items}개)`);
          
          const reply = await interaction.reply({ embeds: [successEmbed], ephemeral: true, fetchReply: true });
          
          // 15초 후 자동 삭제
          setTimeout(async () => {
            try {
              await interaction.deleteReply();
            } catch (error) {
              // 이미 삭제되었거나 삭제할 수 없는 경우 무시
            }
          }, 15000);
        }
        
      } catch (error) {
        console.error('❌ 아이템 추가 모달 제출 에러:', error);
        await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
      }
    }
    
    else if (interaction.customId.startsWith('edit_name_modal_')) {
      try {
        const parts = interaction.customId.replace('edit_name_modal_', '').split('_');
        const type = parts[0]; // 'inventory' or 'crafting'
        const oldName = parts[parts.length - 1];
        const category = parts.slice(1, -1).join('_');
        
        const newName = interaction.fields.getTextInputValue('new_name').trim();
        
        if (!newName) {
          return await interaction.reply({ 
            content: '❌ 이름을 입력해주세요.', 
            ephemeral: true 
          });
        }
        
        if (newName === oldName) {
          return await interaction.reply({ 
            content: '❌ 기존 이름과 동일합니다.', 
            ephemeral: true 
          });
        }
        
        const inventory = await loadInventory();
        const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
        
        if (!targetData?.[category]?.[oldName]) {
          return await interaction.reply({ 
            content: `❌ "${oldName}"을(를) 찾을 수 없습니다.`, 
            ephemeral: true 
          });
        }
        
        if (targetData[category][newName]) {
          return await interaction.reply({ 
            content: `❌ "${newName}"은(는) 이미 존재하는 이름입니다.`, 
            ephemeral: true 
          });
        }
        
        // 데이터 복사 및 이름 변경
        const itemData = { ...targetData[category][oldName] };
        targetData[category][newName] = itemData;
        delete targetData[category][oldName];
        
        // 수집중/제작중 정보도 함께 변경
        if (type === 'inventory' && inventory.collecting?.[category]?.[oldName]) {
          inventory.collecting[category][newName] = inventory.collecting[category][oldName];
          delete inventory.collecting[category][oldName];
        } else if (type === 'crafting' && inventory.crafting?.crafting?.[category]?.[oldName]) {
          inventory.crafting.crafting[category][newName] = inventory.crafting.crafting[category][oldName];
          delete inventory.crafting.crafting[category][oldName];
        }
        
        // 레시피도 함께 변경 (제작품인 경우)
        let recipeUpdated = false;
        if (type === 'crafting' && inventory.crafting?.recipes?.[category]?.[oldName]) {
          inventory.crafting.recipes[category][newName] = inventory.crafting.recipes[category][oldName];
          delete inventory.crafting.recipes[category][oldName];
          recipeUpdated = true;
        }
        
        // 다른 제작품의 레시피에서 재료 이름도 변경 (재고 아이템인 경우)
        let materialUpdated = false;
        if (type === 'inventory' && inventory.crafting?.recipes) {
          for (const [cat, recipes] of Object.entries(inventory.crafting.recipes)) {
            for (const [item, recipe] of Object.entries(recipes)) {
              for (const material of recipe) {
                if (material.category === category && material.name === oldName) {
                  material.name = newName;
                  materialUpdated = true;
                }
              }
            }
          }
        }
        
        addHistory(
          inventory, 
          type, 
          category, 
          newName, 
          'update_quantity', 
          `이름 변경: "${oldName}" → "${newName}"`, 
          interaction.user.displayName || interaction.user.username
        );
        
        await saveInventory(inventory);
        
        const icon = getItemIcon(newName, inventory);
        const successEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('✅ 이름 수정 완료')
          .setDescription([
            `**카테고리:** ${category}`,
            `${icon} **"${oldName}"** → **"${newName}"**`,
            '',
            recipeUpdated ? '🔨 레시피도 함께 변경되었습니다.' : '',
            materialUpdated ? '📦 다른 제작품의 재료 이름도 함께 변경되었습니다.' : ''
          ].filter(Boolean).join('\n'));
        
        await interaction.reply({ embeds: [successEmbed], ephemeral: true });
        
        // 15초 후 자동 삭제
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {
            // 이미 삭제되었거나 삭제할 수 없는 경우 무시
          }
        }, 15000);
        
      } catch (error) {
        console.error('❌ 이름 수정 모달 제출 에러:', error);
        await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
      }
    }
    
    else if (interaction.customId.startsWith('tag_name_input_')) {
      try {
        const parts = interaction.customId.replace('tag_name_input_', '').split('_');
        const type = parts[0];
        const category = parts.slice(1).join('_');
        
        const tagName = interaction.fields.getTextInputValue('tag_name').trim();
        
        if (!tagName) {
          return await interaction.reply({ 
            content: '❌ 태그 이름을 입력해주세요.', 
            ephemeral: true 
          });
        }
        
        const inventory = await loadInventory();
        const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
        
        if (!targetData?.[category]) {
          return await interaction.reply({ 
            content: `❌ "${category}" 카테고리를 찾을 수 없습니다.`, 
            ephemeral: true 
          });
        }
        
        // 항목 선택 메뉴 생성 (다중 선택 가능)
        const items = Object.keys(targetData[category]);
        const itemOptions = items.map(item => {
          const currentTag = getItemTag(item, category, type, inventory);
          const icon = getItemIcon(item, inventory);
          return {
            label: item,
            value: item,
            emoji: icon,
            description: currentTag ? `현재: ${currentTag}` : '태그 없음'
          };
        });
        
        // Discord 제한: 최대 25개 옵션
        const limitedOptions = itemOptions.slice(0, 25);
        const hasMore = itemOptions.length > 25;
        
        const { StringSelectMenuBuilder } = await import('discord.js');
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`select_tag_items_${type}_${category}_${tagName}`)
          .setPlaceholder(`"${tagName}" 태그에 추가할 항목을 선택하세요 (여러 개 가능)`)
          .setMinValues(1)
          .setMaxValues(Math.min(limitedOptions.length, 25))
          .addOptions(limitedOptions);
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        let contentMessage = `🏷️ **태그: ${tagName}**\n\n"${tagName}" 태그에 추가할 항목을 선택하세요.\n💡 여러 개를 한 번에 선택할 수 있습니다.`;
        
        await interaction.reply({
          content: contentMessage,
          components: [row],
          ephemeral: true
        });
        
        // 30초 후 자동 삭제
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {}
        }, 30000);
        
      } catch (error) {
        console.error('❌ 태그 이름 입력 모달 제출 에러:', error);
        await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
      }
    }
    
    else if (interaction.customId.startsWith('tag_name_modal_')) {
      try {
        const parts = interaction.customId.replace('tag_name_modal_', '').split('_');
        const type = parts[0];
        const itemName = parts[parts.length - 1];
        const category = parts.slice(1, -1).join('_');
        
        const tagName = interaction.fields.getTextInputValue('tag_name').trim();
        
        if (!tagName) {
          return await interaction.reply({ 
            content: '❌ 태그 이름을 입력해주세요.', 
            ephemeral: true 
          });
        }
        
        const inventory = await loadInventory();
        
        // 태그 구조 초기화
        if (!inventory.tags) inventory.tags = { inventory: {}, crafting: {} };
        if (!inventory.tags[type]) inventory.tags[type] = {};
        if (!inventory.tags[type][category]) inventory.tags[type][category] = {};
        
        // 기존 태그에서 제거
        const oldTag = getItemTag(itemName, category, type, inventory);
        if (oldTag && inventory.tags[type][category][oldTag]) {
          inventory.tags[type][category][oldTag] = inventory.tags[type][category][oldTag].filter(item => item !== itemName);
          // 빈 태그 삭제
          if (inventory.tags[type][category][oldTag].length === 0) {
            delete inventory.tags[type][category][oldTag];
          }
        }
        
        // 새 태그에 추가
        if (!inventory.tags[type][category][tagName]) {
          inventory.tags[type][category][tagName] = [];
        }
        if (!inventory.tags[type][category][tagName].includes(itemName)) {
          inventory.tags[type][category][tagName].push(itemName);
        }
        
        await saveInventory(inventory);
        
        const icon = getItemIcon(itemName, inventory);
        const successEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ 태그 설정 완료')
          .setDescription([
            `**카테고리:** ${category}`,
            `${icon} **${itemName}**`,
            `🏷️ **태그:** ${tagName}`,
            oldTag ? `\n이전 태그 "${oldTag}"에서 제거되었습니다.` : ''
          ].filter(Boolean).join('\n'));
        
        await interaction.reply({ embeds: [successEmbed], ephemeral: true });
        
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {}
        }, 15000);
        
      } catch (error) {
        console.error('❌ 태그 설정 모달 제출 에러:', error);
        await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
      }
    }
    
    else if (interaction.customId.startsWith('recipe_quantity_modal_')) {
      try {
        const parts = interaction.customId.replace('recipe_quantity_modal_', '').split('_');
        const category = parts[0];
        const step = parseInt(parts[parts.length - 2]); // 1, 2, 3
        const materialName = parts[parts.length - 1];
        const itemName = parts.slice(1, -2).join('_');
        
        const quantity = parseInt(interaction.fields.getTextInputValue('material_quantity').trim());
        
        if (isNaN(quantity) || quantity <= 0) {
          return await interaction.reply({
            content: '❌ 올바른 수량을 입력해주세요. (1 이상의 숫자)',
            ephemeral: true
          });
        }
        
        const inventory = await loadInventory();
        
        // 레시피 임시 저장 (interaction.message.content에 저장하거나 별도 관리)
        // 여기서는 간단하게 바로 저장하는 방식으로 구현
        
        if (!inventory.crafting.recipes) {
          inventory.crafting.recipes = {};
        }
        if (!inventory.crafting.recipes[category]) {
          inventory.crafting.recipes[category] = {};
        }
        if (!inventory.crafting.recipes[category][itemName]) {
          inventory.crafting.recipes[category][itemName] = [];
        }
        
        // 재료 추가
        inventory.crafting.recipes[category][itemName].push({
          name: materialName,
          quantity: quantity,
          category: category
        });
        
        await saveInventory(inventory);
        
        const icon = getItemIcon(materialName, inventory);
        
        // 다음 재료 추가 또는 완료
        if (step < 5) {
          const addMoreButton = new ButtonBuilder()
            .setCustomId(`add_more_recipe_${category}_${itemName}_${step + 1}`)
            .setLabel(`➕ 재료 ${step + 1} 추가`)
            .setStyle(ButtonStyle.Primary);
          
          const finishButton = new ButtonBuilder()
            .setCustomId(`finish_recipe_${category}_${itemName}`)
            .setLabel('✅ 완료')
            .setStyle(ButtonStyle.Success);
          
          const row = new ActionRowBuilder().addComponents(addMoreButton, finishButton);
          
          const currentRecipe = inventory.crafting.recipes[category][itemName]
            .map(m => `${getItemIcon(m.name, inventory)} ${m.name} x${m.quantity}`)
            .join('\n');
          
          await interaction.reply({
            content: `✅ 재료 ${step} 추가 완료: ${icon} ${materialName} x${quantity}\n\n**현재 레시피:**\n${currentRecipe}\n\n더 추가하시겠습니까? (최대 5개)`,
            components: [row],
            ephemeral: true
          });
        } else {
          // 5개 재료 모두 추가 완료
          const currentRecipe = inventory.crafting.recipes[category][itemName]
            .map(m => `${getItemIcon(m.name, inventory)} ${m.name} x${m.quantity}`)
            .join('\n');
          
          await interaction.reply({
            content: `✅ **${itemName}** 레시피 추가 완료!\n\n**레시피:**\n${currentRecipe}`,
            ephemeral: true
          });
          
          setTimeout(async () => {
            try {
              await interaction.deleteReply();
            } catch (error) {}
          }, 15000);
        }
        
      } catch (error) {
        console.error('❌ 레시피 수량 모달 제출 에러:', error);
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
        let embed, items, totalPages;
        if (type === 'crafting') {
          const crafting = inventory.crafting || { categories: {}, crafting: {} };
          items = Object.entries(crafting.categories[category] || {});
          totalPages = Math.ceil(items.length / 25);
          embed = createCraftingEmbed(crafting, category, uiMode, newLength, 0);
        } else {
          items = Object.entries(inventory.categories[category] || {});
          totalPages = Math.ceil(items.length / 25);
          embed = createInventoryEmbed(inventory, category, uiMode, newLength, 0);
        }
        
        const messageId = interaction.message.id;
        const isAutoRefreshing = autoRefreshTimers.has(messageId);
        const buttons = createButtons(category, isAutoRefreshing, type || 'inventory', uiMode, newLength, inventory, interaction.user.id, 0, totalPages);
        
        await interaction.update({ embeds: [embed], components: buttons });
        console.log(`📊 바 크기 변경: ${percentage}% (길이: ${newLength})`);
      } catch (error) {
        console.error('❌ 바 크기 모달 제출 에러:', error);
        await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
      }
    }
    
    else if (interaction.customId.startsWith('modal_add_') || 
             interaction.customId.startsWith('modal_edit_') || 
             interaction.customId.startsWith('modal_subtract_') ||
             interaction.customId.startsWith('modal_edit_required_')) {
      try {
        // modal_add_inventory_해양_산호 형식 파싱
        // 마지막 _를 기준으로 아이템명 분리
        const lastUnderscoreIndex = interaction.customId.lastIndexOf('_');
        const itemName = interaction.customId.substring(lastUnderscoreIndex + 1);
        const prefix = interaction.customId.substring(0, lastUnderscoreIndex);
        const parts = prefix.split('_');
        
        let action, type, category;
        // modal_edit_required_inventory_해양 형식 처리
        if (parts[1] === 'edit' && parts[2] === 'required') {
          action = 'edit_required';
          type = parts[3];
          category = parts.slice(4).join('_');
        } else {
          action = parts[1]; // 'add', 'edit', or 'subtract'
          type = parts[2]; // 'inventory' or 'crafting'
          category = parts.slice(3).join('_');
        }
        
        console.log('📝 모달 제출 - 수량 관리');
        console.log('  - customId:', interaction.customId);
        console.log('  - action:', action);
        console.log('  - type:', type);
        console.log('  - category:', category);
        console.log('  - itemName:', itemName);
        
        const boxesInput = interaction.fields.getTextInputValue('boxes_change')?.trim() || '';
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
        const old = formatQuantity(oldQuantity);
        let newQuantity;
        
        // 입력값 처리 (빈 값은 0으로)
        const boxes = boxesInput === '' ? 0 : parseFloat(boxesInput);
        const sets = setsInput === '' ? 0 : parseFloat(setsInput);
        const items = itemsInput === '' ? 0 : parseFloat(itemsInput);
        
        if (isNaN(boxes) || boxes < 0 || isNaN(sets) || sets < 0 || isNaN(items) || items < 0) {
          return await interaction.reply({ 
            content: `❌ 올바른 숫자를 입력해주세요. (0 이상의 숫자)`, 
            ephemeral: true 
          });
        }
        
        // 상자, 세트, 낱개를 합쳐서 총 개수 계산
        const totalChange = Math.round(boxes * 3456) + Math.round(sets * 64) + Math.round(items);
        
        if (action === 'edit_required') {
          // 목표 수량 수정
          const oldRequired = itemData.required;
          const newRequired = totalChange;
          
          itemData.required = newRequired;
          
          addHistory(inventory, type, category, itemName, 'update_required',
            `목표: ${oldRequired}개 → ${newRequired}개`,
            interaction.user.displayName || interaction.user.username);
          
          await saveInventory(inventory);
          
          const icon = getItemIcon(itemName, inventory);
          const successEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setDescription(`### 🎯 목표 수정 완료\n**카테고리:** ${category}\n${icon} **${itemName}**\n**이전 목표:** ${oldRequired}개\n**새 목표:** ${newRequired}개`);
          
          await sendTemporaryReply(interaction, { embeds: [successEmbed] });
          
          console.log(`🎯 ${interaction.user.displayName}님이 ${category} - ${itemName} 목표 수정: ${oldRequired} → ${newRequired}`);
          return;
        }
        
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
          
          // 제작품 차감 시 레시피가 있으면 재료 반환
          if (type === 'crafting' && totalChange > 0) {
            const recipe = inventory.crafting?.recipes?.[category]?.[itemName];
            if (recipe) {
              // 재료 반환
              for (const material of recipe) {
                const returnQty = material.quantity * totalChange;
                
                // 재고 카테고리에 재료가 있는지 확인
                if (inventory.categories[material.category]?.[material.name]) {
                  inventory.categories[material.category][material.name].quantity += returnQty;
                  
                  // 재료 반환 내역 추가
                  addHistory(inventory, 'inventory', material.category, material.name, 'update_quantity',
                    `[제작 취소] ${itemName} ${totalChange}개 차감으로 ${returnQty}개 반환`,
                    interaction.user.displayName || interaction.user.username);
                }
              }
            }
          }
        } else {
          // 수정 (직접 설정)
          newQuantity = Math.max(0, totalChange);
          
          // 제작품 수정 시 레시피가 있으면 재료 조정
          if (type === 'crafting') {
            const recipe = inventory.crafting?.recipes?.[category]?.[itemName];
            if (recipe) {
              const quantityDiff = newQuantity - oldQuantity; // 양수면 증가, 음수면 감소
              
              if (quantityDiff > 0) {
                // 수량 증가 - 재료 차감 필요
                let canCraft = true;
                const materialCheck = [];
                
                for (const material of recipe) {
                  const materialData = inventory.categories[material.category]?.[material.name];
                  const requiredQty = material.quantity * quantityDiff;
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
                    content: `❌ **${itemName}**을(를) ${newQuantity}개로 수정하려면 ${quantityDiff}개를 추가 제작해야 하는데 재료가 부족합니다!\n\n**부족한 재료:**\n${lackingMaterials}`,
                    ephemeral: true
                  });
                }
                
                // 재료 차감
                for (const material of recipe) {
                  const requiredQty = material.quantity * quantityDiff;
                  inventory.categories[material.category][material.name].quantity -= requiredQty;
                  
                  addHistory(inventory, 'inventory', material.category, material.name, 'update_quantity',
                    `[제작 재료 소모] ${itemName} ${quantityDiff}개 추가 제작으로 ${requiredQty}개 소모`,
                    interaction.user.displayName || interaction.user.username);
                }
              } else if (quantityDiff < 0) {
                // 수량 감소 - 재료 반환
                const returnAmount = Math.abs(quantityDiff);
                
                for (const material of recipe) {
                  const returnQty = material.quantity * returnAmount;
                  
                  if (inventory.categories[material.category]?.[material.name]) {
                    inventory.categories[material.category][material.name].quantity += returnQty;
                    
                    addHistory(inventory, 'inventory', material.category, material.name, 'update_quantity',
                      `[제작 취소] ${itemName} ${returnAmount}개 감소로 ${returnQty}개 반환`,
                      interaction.user.displayName || interaction.user.username);
                  }
                }
              }
            }
          }
        }
        
        itemData.quantity = newQuantity;
        
        const newFormatted = formatQuantity(newQuantity);
        
        // 수정 내역 추가
        const actionLabels = {
          'add': '추가',
          'edit': '수정',
          'subtract': '차감'
        };
        const changeDetail = `${old.boxes}상자/${old.sets}세트/${old.items}개 (${oldQuantity}개) → ${newFormatted.boxes}상자/${newFormatted.sets}세트/${newFormatted.items}개 (${newQuantity}개)`;
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
