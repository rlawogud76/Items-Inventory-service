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
function getStatusEmoji(quantity, min, max) {
  if (quantity < min) return '🔴';
  if (quantity >= max) return '🟢';
  return '🟡';
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
function createProgressBar(current, min, max, length = 10) {
  const percentage = Math.min(Math.max((current - min) / (max - min), 0), 1);
  const filled = Math.round(percentage * length);
  const empty = length - filled;
  
  const filledChar = '█';
  const emptyChar = '░';
  
  return filledChar.repeat(filled) + emptyChar.repeat(empty);
}

// 재고 임베드 생성
function createInventoryEmbed(inventory) {
  const embed = new EmbedBuilder()
    .setTitle('🏘️ 마을 재고 관리 시스템')
    .setColor(0x5865F2)
    .setTimestamp()
    .setFooter({ text: '마지막 업데이트' });

  // 아이템이 없는 경우
  if (!inventory.items || Object.keys(inventory.items).length === 0) {
    embed.setDescription('⚠️ 등록된 아이템이 없습니다.');
    return embed;
  }

  // 각 아이템을 필드로 추가
  for (const [itemName, data] of Object.entries(inventory.items)) {
    const status = getStatusEmoji(data.quantity, data.min, data.max);
    const icon = getItemIcon(itemName);
    const progressBar = createProgressBar(data.quantity, data.min, data.max);
    const percentage = Math.round((data.quantity / data.max) * 100);
    
    const fieldValue = [
      `**수량:** ${data.quantity}개 / ${data.max}개 (${percentage}%)`,
      `${progressBar} ${status}`,
      `**최소 요구량:** ${data.min}개`
    ].join('\n');

    embed.addFields({
      name: `${icon} ${itemName}`,
      value: fieldValue,
      inline: false
    });
  }

  return embed;
}

// 버튼 생성
function createButtons() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('refresh')
        .setLabel('🔄 새로고침')
        .setStyle(ButtonStyle.Primary)
    );
}

client.on('ready', async () => {
  console.log(`✅ ${client.user.tag} 봇이 준비되었습니다!`);
  console.log('슬래시 커맨드를 사용하세요: /재고, /추가, /제거, /목록추가, /목록제거, /도움말');
  
  // 슬래시 커맨드 자동 등록
  try {
    console.log('슬래시 커맨드 등록 중...');
    const { REST, Routes, SlashCommandBuilder } = await import('discord.js');
    
    const commands = [
      new SlashCommandBuilder()
        .setName('재고')
        .setDescription('현재 재고 현황을 확인합니다'),
      new SlashCommandBuilder()
        .setName('추가')
        .setDescription('재고를 추가합니다')
        .addStringOption(option =>
          option.setName('아이템')
            .setDescription('추가할 아이템 이름')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('수량')
            .setDescription('추가할 수량')
            .setRequired(true)),
      new SlashCommandBuilder()
        .setName('제거')
        .setDescription('재고를 제거합니다')
        .addStringOption(option =>
          option.setName('아이템')
            .setDescription('제거할 아이템 이름')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('수량')
            .setDescription('제거할 수량')
            .setRequired(true)),
      new SlashCommandBuilder()
        .setName('도움말')
        .setDescription('재고 관리 봇 사용법을 확인합니다'),
      new SlashCommandBuilder()
        .setName('목록추가')
        .setDescription('새로운 아이템을 재고 목록에 추가합니다')
        .addStringOption(option =>
          option.setName('아이템')
            .setDescription('추가할 아이템 이름')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('초기수량')
            .setDescription('초기 수량')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('최소수량')
            .setDescription('최소 요구량')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('최대수량')
            .setDescription('최대 수량')
            .setRequired(true)),
      new SlashCommandBuilder()
        .setName('목록제거')
        .setDescription('재고 목록에서 아이템을 제거합니다')
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
  if (interaction.isCommand()) {
    const { commandName } = interaction;

    try {
      if (commandName === '재고') {
        const inventory = await loadInventory();
        const embed = createInventoryEmbed(inventory);
        const buttons = createButtons();
        await interaction.reply({ embeds: [embed], components: [buttons] });
      }

      else if (commandName === '추가') {
        const itemName = interaction.options.getString('아이템');
        const amount = interaction.options.getInteger('수량');

        const inventory = await loadInventory();
        if (!inventory.items[itemName]) {
          return interaction.reply({ content: `❌ "${itemName}" 아이템을 찾을 수 없습니다.`, ephemeral: true });
        }

        inventory.items[itemName].quantity += amount;
        await saveInventory(inventory);

        const icon = getItemIcon(itemName);
        const embed = createInventoryEmbed(inventory);
        const successEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setDescription(`### ✅ 재고 추가 완료\n${icon} **${itemName}** ${amount}개가 추가되었습니다!`);
        
        await interaction.reply({ embeds: [successEmbed, embed] });
      }

      else if (commandName === '제거') {
        const itemName = interaction.options.getString('아이템');
        const amount = interaction.options.getInteger('수량');

        const inventory = await loadInventory();
        if (!inventory.items[itemName]) {
          return interaction.reply({ content: `❌ "${itemName}" 아이템을 찾을 수 없습니다.`, ephemeral: true });
        }

        inventory.items[itemName].quantity = Math.max(0, inventory.items[itemName].quantity - amount);
        await saveInventory(inventory);

        const icon = getItemIcon(itemName);
        const embed = createInventoryEmbed(inventory);
        const successEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription(`### ✅ 재고 제거 완료\n${icon} **${itemName}** ${amount}개가 제거되었습니다!`);
        
        await interaction.reply({ embeds: [successEmbed, embed] });
      }

      else if (commandName === '도움말') {
        const helpEmbed = new EmbedBuilder()
          .setTitle('📖 재고 관리 봇 사용법')
          .setColor(0x5865F2)
          .addFields(
            { name: '/재고', value: '현재 재고 현황을 확인합니다.' },
            { name: '/추가 [아이템] [수량]', value: '재고를 추가합니다.\n예: /추가 아이템:다이아몬드 수량:10' },
            { name: '/제거 [아이템] [수량]', value: '재고를 제거합니다.\n예: /제거 아이템:철괴 수량:5' },
            { name: '/목록추가 [아이템] [초기수량] [최소수량] [최대수량]', value: '새로운 아이템을 목록에 추가합니다.\n예: /목록추가 아이템:금괴 초기수량:20 최소수량:10 최대수량:64' },
            { name: '/목록제거 [아이템]', value: '아이템을 목록에서 제거합니다.\n예: /목록제거 아이템:금괴' },
            { name: '/도움말', value: '이 도움말을 표시합니다.' }
          );
        await interaction.reply({ embeds: [helpEmbed] });
      }

      else if (commandName === '목록추가') {
        const itemName = interaction.options.getString('아이템');
        const initialQuantity = interaction.options.getInteger('초기수량');
        const minQuantity = interaction.options.getInteger('최소수량');
        const maxQuantity = interaction.options.getInteger('최대수량');

        const inventory = await loadInventory();
        
        if (inventory.items[itemName]) {
          return interaction.reply({ content: `❌ "${itemName}" 아이템이 이미 존재합니다.`, ephemeral: true });
        }

        if (minQuantity > maxQuantity) {
          return interaction.reply({ content: `❌ 최소수량이 최대수량보다 클 수 없습니다.`, ephemeral: true });
        }

        inventory.items[itemName] = {
          quantity: initialQuantity,
          min: minQuantity,
          max: maxQuantity
        };
        
        await saveInventory(inventory);

        const icon = getItemIcon(itemName);
        const successEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setDescription(`### ✅ 목록 추가 완료\n${icon} **${itemName}**이(가) 재고 목록에 추가되었습니다!\n\n**초기 수량:** ${initialQuantity}개\n**최소 요구량:** ${minQuantity}개\n**최대 수량:** ${maxQuantity}개`);
        
        const embed = createInventoryEmbed(inventory);
        await interaction.reply({ embeds: [successEmbed, embed] });
      }

      else if (commandName === '목록제거') {
        const itemName = interaction.options.getString('아이템');

        const inventory = await loadInventory();
        
        if (!inventory.items[itemName]) {
          return interaction.reply({ content: `❌ "${itemName}" 아이템을 찾을 수 없습니다.`, ephemeral: true });
        }

        delete inventory.items[itemName];
        await saveInventory(inventory);

        const successEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription(`### ✅ 목록 제거 완료\n**${itemName}**이(가) 재고 목록에서 제거되었습니다.`);
        
        const embed = createInventoryEmbed(inventory);
        await interaction.reply({ embeds: [successEmbed, embed] });
      }
    } catch (error) {
      console.error('커맨드 실행 에러:', error);
      await interaction.reply({ content: '❌ 에러가 발생했습니다: ' + error.message, ephemeral: true });
    }
  }

  // 버튼 인터랙션 처리
  else if (interaction.isButton()) {
    if (interaction.customId === 'refresh') {
      const inventory = await loadInventory();
      const embed = createInventoryEmbed(inventory);
      const buttons = createButtons();
      await interaction.update({ embeds: [embed], components: [buttons] });
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
