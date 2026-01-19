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

// 재고 상태 이모지 반환
function getStatusEmoji(quantity, required) {
  const percentage = (quantity / required) * 100;
  if (percentage <= 25) return '🔴'; // 25% 이하
  if (percentage < 90) return '🟡'; // 25% 초과 ~ 90% 미만
  return '🟢'; // 90% 이상
}

// 아이템 아이콘 반환
function getItemIcon(itemName) {
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

// 재고 임베드 생성
function createInventoryEmbed(inventory, categoryName = null) {
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

    for (const [itemName, data] of Object.entries(inventory.categories[categoryName])) {
      const status = getStatusEmoji(data.quantity, data.required);
      const icon = getItemIcon(itemName);
      const progressBar = createProgressBar(data.quantity, data.required);
      const percentage = Math.round((data.quantity / data.required) * 100);
      
      const fieldValue = [
        `**현재 수량:** ${data.quantity}개`,
        `**충족 수량:** ${data.required}개 (${percentage}%)`,
        `${progressBar} ${status}`
      ].join('\n');

      embed.addFields({
        name: `${icon} ${itemName}`,
        value: fieldValue,
        inline: false
      });
    }
  } else {
    // 전체 카테고리 표시
    embed.setTitle('🏘️ 마을 재고 관리 시스템');
    
    if (!inventory.categories || Object.keys(inventory.categories).length === 0) {
      embed.setDescription('⚠️ 등록된 카테고리가 없습니다.');
      return embed;
    }

    for (const [catName, items] of Object.entries(inventory.categories)) {
      let categoryText = '';
      for (const [itemName, data] of Object.entries(items)) {
        const status = getStatusEmoji(data.quantity, data.required);
        const icon = getItemIcon(itemName);
        const percentage = Math.round((data.quantity / data.required) * 100);
        categoryText += `${icon} ${itemName}: ${data.quantity}/${data.required} (${percentage}%) ${status}\n`;
      }
      
      embed.addFields({
        name: `📦 ${catName}`,
        value: categoryText || '아이템 없음',
        inline: false
      });
    }
  }

  return embed;
}

// 버튼 생성
function createButtons(categoryName = null) {
  const customId = categoryName ? `refresh_${categoryName}` : 'refresh';
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(customId)
        .setLabel('🔄 새로고침')
        .setStyle(ButtonStyle.Primary)
    );
}

client.on('ready', async () => {
  console.log(`✅ ${client.user.tag} 봇이 준비되었습니다!`);
  console.log('슬래시 커맨드를 사용하세요: /재고, /현재수량변경, /충족수량변경, /목록추가, /목록제거, /도움말');
  
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
          option.setName('초기수량')
            .setDescription('초기 수량')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('충족수량')
            .setDescription('충족 수량 (목표치)')
            .setRequired(true)),
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
        const embed = createInventoryEmbed(inventory, category);
        const buttons = createButtons(category);
        await interaction.reply({ embeds: [embed], components: [buttons] });
      }

      else if (commandName === '현재수량변경') {
        const category = interaction.options.getString('카테고리');
        const itemName = interaction.options.getString('아이템');
        const newQuantity = interaction.options.getInteger('수량');

        const inventory = await loadInventory();
        if (!inventory.categories[category]) {
          return interaction.reply({ content: `❌ "${category}" 카테고리를 찾을 수 없습니다.`, ephemeral: true });
        }
        if (!inventory.categories[category][itemName]) {
          return interaction.reply({ content: `❌ "${itemName}" 아이템을 찾을 수 없습니다.`, ephemeral: true });
        }

        const oldQuantity = inventory.categories[category][itemName].quantity;
        inventory.categories[category][itemName].quantity = newQuantity;
        await saveInventory(inventory);

        const icon = getItemIcon(itemName);
        const successEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setDescription(`### ✅ 현재 수량 변경 완료\n**카테고리:** ${category}\n${icon} **${itemName}**\n${oldQuantity}개 → ${newQuantity}개`);
        
        await interaction.reply({ embeds: [successEmbed], ephemeral: true });
      }

      else if (commandName === '충족수량변경') {
        const category = interaction.options.getString('카테고리');
        const itemName = interaction.options.getString('아이템');
        const newRequired = interaction.options.getInteger('수량');

        const inventory = await loadInventory();
        if (!inventory.categories[category]) {
          return interaction.reply({ content: `❌ "${category}" 카테고리를 찾을 수 없습니다.`, ephemeral: true });
        }
        if (!inventory.categories[category][itemName]) {
          return interaction.reply({ content: `❌ "${itemName}" 아이템을 찾을 수 없습니다.`, ephemeral: true });
        }

        const oldRequired = inventory.categories[category][itemName].required;
        inventory.categories[category][itemName].required = newRequired;
        await saveInventory(inventory);

        const icon = getItemIcon(itemName);
        const successEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setDescription(`### ✅ 충족 수량 변경 완료\n**카테고리:** ${category}\n${icon} **${itemName}**\n${oldRequired}개 → ${newRequired}개`);
        
        await interaction.reply({ embeds: [successEmbed], ephemeral: true });
      }

      else if (commandName === '도움말') {
        const helpEmbed = new EmbedBuilder()
          .setTitle('📖 재고 관리 봇 사용법')
          .setColor(0x5865F2)
          .setDescription('**카테고리:** 해양, 채광, 요리')
          .addFields(
            { name: '/재고 [카테고리]', value: '재고 현황을 확인합니다. 카테고리 선택 안하면 전체 표시\n예: /재고 카테고리:해양' },
            { name: '/현재수량변경', value: '아이템의 현재 수량을 변경합니다.\n예: /현재수량변경 카테고리:해양 아이템:다이아몬드 수량:50' },
            { name: '/충족수량변경', value: '아이템의 충족 수량을 변경합니다.\n예: /충족수량변경 카테고리:채광 아이템:철괴 수량:200' },
            { name: '/목록추가', value: '새로운 아이템을 추가합니다.\n예: /목록추가 카테고리:요리 아이템:금괴 초기수량:20 충족수량:100' },
            { name: '/목록제거', value: '아이템을 제거합니다.\n예: /목록제거 카테고리:해양 아이템:금괴' },
            { name: '/도움말', value: '이 도움말을 표시합니다.' }
          );
        await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
      }

      else if (commandName === '목록추가') {
        const category = interaction.options.getString('카테고리');
        const itemName = interaction.options.getString('아이템');
        const initialQuantity = interaction.options.getInteger('초기수량');
        const requiredQuantity = interaction.options.getInteger('충족수량');

        const inventory = await loadInventory();
        
        if (!inventory.categories[category]) {
          inventory.categories[category] = {};
        }
        
        if (inventory.categories[category][itemName]) {
          return interaction.reply({ content: `❌ "${itemName}" 아이템이 이미 존재합니다.`, ephemeral: true });
        }

        inventory.categories[category][itemName] = {
          quantity: initialQuantity,
          required: requiredQuantity
        };
        
        await saveInventory(inventory);

        const icon = getItemIcon(itemName);
        const successEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setDescription(`### ✅ 목록 추가 완료\n**카테고리:** ${category}\n${icon} **${itemName}**이(가) 재고 목록에 추가되었습니다!\n\n**초기 수량:** ${initialQuantity}개\n**충족 수량:** ${requiredQuantity}개`);
        
        await interaction.reply({ embeds: [successEmbed], ephemeral: true });
      }

      else if (commandName === '목록제거') {
        const category = interaction.options.getString('카테고리');
        const itemName = interaction.options.getString('아이템');

        const inventory = await loadInventory();
        
        if (!inventory.categories[category] || !inventory.categories[category][itemName]) {
          return interaction.reply({ content: `❌ "${itemName}" 아이템을 찾을 수 없습니다.`, ephemeral: true });
        }

        delete inventory.categories[category][itemName];
        await saveInventory(inventory);

        const successEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription(`### ✅ 목록 제거 완료\n**카테고리:** ${category}\n**${itemName}**이(가) 재고 목록에서 제거되었습니다.`);
        
        await interaction.reply({ embeds: [successEmbed], ephemeral: true });
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
        const category = interaction.customId === 'refresh' ? null : interaction.customId.replace('refresh_', '');
        console.log('🔄 새로고침 버튼 클릭');
        console.log('  - customId:', interaction.customId);
        console.log('  - 추출된 카테고리:', category || '전체');
        
        const inventory = await loadInventory();
        const embed = createInventoryEmbed(inventory, category);
        const buttons = createButtons(category);
        
        await interaction.update({ embeds: [embed], components: [buttons] });
        console.log('✅ 새로고침 완료');
      } catch (error) {
        console.error('❌ 새로고침 에러:', error);
        await interaction.reply({ content: '새로고침 중 오류가 발생했습니다.', ephemeral: true }).catch(() => {});
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
