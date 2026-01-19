import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

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

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID; // 서버 ID (선택사항)

if (!token || !clientId) {
  console.error('❌ .env 파일에 DISCORD_TOKEN과 CLIENT_ID를 설정하세요.');
  console.log('현재 TOKEN:', token ? '설정됨' : '없음');
  console.log('현재 CLIENT_ID:', clientId ? '설정됨' : '없음');
  process.exit(1);
}

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log('슬래시 커맨드 등록 중...');
    console.log('CLIENT_ID:', clientId);
    
    // 서버 ID가 있으면 해당 서버에만 등록 (즉시 반영)
    // 없으면 전역 등록 (최대 1시간 소요)
    const route = guildId 
      ? Routes.applicationGuildCommands(clientId, guildId)
      : Routes.applicationCommands(clientId);
    
    console.log(guildId ? `서버 ${guildId}에 등록 (즉시 반영)` : '전역 등록 (최대 1시간 소요)');
    
    await rest.put(route, { body: commands });
    console.log('✅ 슬래시 커맨드 등록 완료!');
  } catch (error) {
    console.error('❌ 에러:', error);
  }
})();
