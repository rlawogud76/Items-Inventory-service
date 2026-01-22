// 재고 커맨드 핸들러

import { createInventoryEmbed, createButtons } from '../../embeds.js';
import { loadInventory } from '../../database.js';

/**
 * /재고 커맨드 처리
 * @param {Interaction} interaction - Discord 인터랙션
 * @param {Map} activeMessages - 활성 메시지 맵
 */
export async function handleInventoryCommand(interaction, activeMessages) {
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
    }).catch((err) => {
      console.error('❌ 재고 표시 에러 응답 실패:', err);
    });
  }
}
