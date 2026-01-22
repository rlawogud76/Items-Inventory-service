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
import { handleModalInteraction } from './src/handlers/modals.js';
import { handleCommandInteraction } from './src/handlers/commands.js';

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
          .setDescription(`### ${actionEmojis[action]} ${actionLabels[action]} 완료\n**카테고리:** ${category}\n${icon} **${itemName}**\n${old.boxes}상자/${old.sets}세트/${old.items}개 (${oldQuantity}개)\n↓\n${newFormatted.boxes}상자/${newFormatted.sets}세트/${newFormatted.items}개 (${newQuantity}개)${materialInfo}`);
        
        await sendTemporaryReply(interaction, { embeds: [successEmbed] });
        
        console.log(`${actionEmojis[action]} ${interaction.user.displayName}님이 ${category} - ${itemName} ${actionLabels[action]}: ${oldQuantity} -> ${newQuantity}`);
        
      } catch (error) {
        console.error('❌ 모달 제출 에러:', error);
        await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
      }
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
