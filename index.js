import { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import dotenv from 'dotenv';
import { connectDatabase, loadInventory, saveInventory, watchInventoryChanges, addChangeListener } from './src/database.js';
import { getItemIcon } from './src/utils.js';
import { createCraftingEmbed, createInventoryEmbed, createButtons } from './src/embeds.js';
import { handleButtonInteraction } from './src/handlers/buttons.js';
import { handleSelectInteraction } from './src/handlers/selects.js';
import { handleModalInteraction } from './src/handlers/modals.js';
import { handleCommandInteraction } from './src/handlers/commands.js';
import { handleQuantityModal } from './src/handlers/modalHandlers/quantityModal.js';

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
  
  // MongoDB 연결
  const connected = await connectDatabase();
  if (!connected) {
    console.error('❌ MongoDB 연결 실패로 봇을 종료합니다.');
    process.exit(1);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 재고 관리: /재고');
  console.log('🔨 제작 관리: /제작 (레시피는 제작 화면 버튼으로 관리)');
  console.log('🔧 기타: /도움말, /수정내역, /통계, /이모지설정, /기여도초기화');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // 변경 감지 시작
  watchInventoryChanges();
  
  // 변경 감지 리스너 등록
  addChangeListener(async () => {
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
    return await handleCommandInteraction(interaction, activeMessages);
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
        
        const page = 0; // 첫 페이지
        const itemsPerPage = 25;
        const totalPages = Math.ceil(materials.length / itemsPerPage);
        const startIndex = page * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, materials.length);
        const pageMaterials = materials.slice(startIndex, endIndex);
        
        const materialOptions = pageMaterials.map(mat => ({
          label: mat,
          value: mat,
          emoji: getItemIcon(mat, inventory)
        }));
        
        const { StringSelectMenuBuilder } = await import('discord.js');
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`select_recipe_material_edit_${category}_${selectedItem}_1`)
          .setPlaceholder('재료 1을 선택하세요')
          .addOptions(materialOptions);
        
        const rows = [new ActionRowBuilder().addComponents(selectMenu)];
        
        // 페이지네이션 버튼 추가 (25개 초과 시)
        if (totalPages > 1) {
          const pageButtons = [];
          
          pageButtons.push(
            new ButtonBuilder()
              .setCustomId(`page_prev_recipe_material_edit_${category}_${selectedItem}_1_${page}`)
              .setLabel('◀ 이전')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page === 0)
          );
          
          pageButtons.push(
            new ButtonBuilder()
              .setCustomId(`page_info_recipe_material_edit_${category}_${selectedItem}_1_${page}`)
              .setLabel(`페이지 ${page + 1}/${totalPages}`)
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          );
          
          pageButtons.push(
            new ButtonBuilder()
              .setCustomId(`page_next_recipe_material_edit_${category}_${selectedItem}_1_${page}`)
              .setLabel('다음 ▶')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page >= totalPages - 1)
          );
          
          rows.push(new ActionRowBuilder().addComponents(pageButtons));
        }
        
        await interaction.update({
          content: `✏️ **${selectedItem}** 레시피 수정\n\n**현재 레시피:**\n${recipeText}\n\n**새 레시피 입력 - 1단계:** 첫 번째 재료를 선택하세요${totalPages > 1 ? ` (${materials.length}개 중 ${startIndex + 1}-${endIndex}번째)` : ''}`,
          components: rows
        });
        
      } catch (error) {
        console.error('❌ 레시피 수정 선택 에러:', error);
        await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
          console.error('❌ 레시피 수정 선택 응답 실패:', err);
        });
      }
    }
    // 나머지 모든 select 핸들러는 분리된 핸들러로 처리
    else {
      return await handleSelectInteraction(interaction);
    }
  }
  
  // 모달 제출 처리
  if (interaction.isModalSubmit()) {
    // 분리된 modal 핸들러로 처리 시도
    const handled = await handleModalInteraction(interaction);
    
    // 처리되지 않은 경우 (수량 관리, 바 크기 설정 등)
    if (!handled) {
      if (interaction.customId.startsWith('bar_size_modal_')) {
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
        const autoRefreshTimers = new Map(); // 임시 - settings.js에서 관리
        const isAutoRefreshing = autoRefreshTimers.has(messageId);
        const buttons = createButtons(category, isAutoRefreshing, type || 'inventory', uiMode, newLength, inventory, interaction.user.id, 0, totalPages);
        
        await interaction.update({ embeds: [embed], components: buttons });
        console.log(`📊 바 크기 변경: ${percentage}% (길이: ${newLength})`);
      } catch (error) {
        console.error('❌ 바 크기 모달 제출 에러:', error);
        await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
          console.error('❌ 바 크기 모달 응답 실패:', err);
        });
      }
    }

    
    else if (interaction.customId.startsWith('modal_add_') || 
             interaction.customId.startsWith('modal_edit_') || 
             interaction.customId.startsWith('modal_subtract_') ||
             interaction.customId.startsWith('modal_edit_required_')) {
      // 수량 관리 modal - 분리된 핸들러로 처리
      return await handleQuantityModal(interaction);
    }
    } // if (!handled) 닫기
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
