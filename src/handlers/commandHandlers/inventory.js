// 재고 커맨드 핸들러

import { createInventoryEmbed, createButtons } from '../../embeds.js';
import { loadInventory, getItemPoints } from '../../database.js';

/**
 * /재고 커맨드 처리
 * @param {Interaction} interaction - Discord 인터랙션
 * @param {Map} activeMessages - 활성 메시지 맵
 */
export async function handleInventoryCommand(interaction, activeMessages) {
  const category = interaction.options.getString('카테고리');
  
  // 먼저 응답 (3초 제한 회피) - ephemeral로 변경
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const [inventory, itemPoints] = await Promise.all([
      loadInventory(),
      getItemPoints()
    ]);
    const uiMode = inventory.settings?.uiMode || 'normal';
    const barLength = inventory.settings?.barLength || 15;
    
    // 페이지 계산
    const items = Object.entries(inventory.categories[category] || {});
    const totalPages = Math.ceil(items.length / 25);
    
    const embed = createInventoryEmbed(inventory, category, uiMode, barLength, 0, itemPoints);
    const buttons = createButtons(category, true, 'inventory', uiMode, barLength, inventory, interaction.user.id, 0, totalPages);
    const reply = await interaction.editReply({ embeds: [embed], components: buttons, fetchReply: true });
    
    // 활성 메시지로 등록 (자동 새로고침용) - 10분 후 자동 만료
    const messageId = reply.id;
    
    // 5초마다 자동 새로고침 인터벌 설정
    const refreshInterval = setInterval(async () => {
      try {
        const messageData = activeMessages.get(messageId);
        if (!messageData) {
          clearInterval(refreshInterval);
          return;
        }
        
        const [latestInventory, latestItemPoints] = await Promise.all([
          loadInventory(),
          getItemPoints()
        ]);
        const latestUiMode = latestInventory.settings?.uiMode || 'normal';
        const latestBarLength = latestInventory.settings?.barLength || 15;
        const currentPage = messageData.page || 0;
        
        const latestItems = Object.entries(latestInventory.categories[category] || {});
        const latestTotalPages = Math.ceil(latestItems.length / 25);
        
        const latestEmbed = createInventoryEmbed(latestInventory, category, latestUiMode, latestBarLength, currentPage, latestItemPoints);
        const latestButtons = createButtons(category, true, 'inventory', latestUiMode, latestBarLength, latestInventory, interaction.user.id, currentPage, latestTotalPages);
        
        await interaction.editReply({ embeds: [latestEmbed], components: latestButtons });
      } catch (error) {
        // interaction 토큰 만료 또는 메시지 삭제 시 인터벌 정지
        console.log(`⏹️ 자동 새로고침 중단: ${messageId}`);
        clearInterval(refreshInterval);
        activeMessages.delete(messageId);
      }
    }, 5000); // 5초마다
    
    // 10분 후 자동 종료
    setTimeout(() => {
      clearInterval(refreshInterval);
      activeMessages.delete(messageId);
      console.log(`⏰ 자동 새로고침 만료: ${messageId} (10분 경과)`);
    }, 10 * 60 * 1000);
    
    activeMessages.set(messageId, {
      interaction,
      category,
      type: 'inventory',
      page: 0,
      timestamp: Date.now(),
      refreshInterval
    });
    
    console.log(`📌 활성 메시지 등록: ${messageId} (재고 - ${category})`);
  } catch (error) {
    console.error('❌ 재고 표시 에러:', error);
    await interaction.editReply({ 
      content: `❌ 재고를 표시하는 중 오류가 발생했습니다.\n${error.message}`,
      embeds: [],
      components: []
    }).catch((err) => {
      console.error('❌ 재고 표시 에러 응답 실패:', err);
    });
  }
}
