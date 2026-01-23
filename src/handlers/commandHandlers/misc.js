// 기타 명령어 핸들러
import { EmbedBuilder } from 'discord.js';
import { loadInventory, saveInventory } from '../../database-old.js';
import { getStatus } from '../../statusLogger.js';

/**
 * 도움말 명령어
 */
export async function handleHelpCommand(interaction) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📚 재고 관리 봇 도움말')
    .setDescription('마인크래프트 마을 재고를 관리하는 봇입니다.')
    .addFields(
      { name: '📦 /재고', value: '재고 현황을 확인하고 관리합니다.', inline: false },
      { name: '🔨 /제작', value: '제작 현황을 확인하고 관리합니다.', inline: false },
      { name: '📊 /통계', value: '재고 및 제작 통계를 확인합니다.', inline: false },
      { name: '📜 /수정내역', value: '최근 수정 내역을 확인합니다.', inline: false },
      { name: '🎨 /이모지설정', value: '아이템 이모지를 설정합니다.', inline: false },
      { name: '🔄 /기여도초기화', value: '기여도를 초기화합니다.', inline: false },
      { name: '🤖 /봇상태', value: '봇의 현재 상태를 확인합니다.', inline: false }
    )
    .setFooter({ text: '버튼을 클릭하여 상세 기능을 사용하세요!' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * 봇 상태 명령어
 */
export async function handleBotStatusCommand(interaction) {
  try {
    const status = getStatus({ limit: 5 });
    
    const embed = new EmbedBuilder()
      .setColor(status.botInfo?.status === 'online' ? 0x57F287 : 0xED4245)
      .setTitle('🤖 봇 상태')
      .setTimestamp();

    if (status.botInfo) {
      embed.addFields(
        { name: '상태', value: status.botInfo.status === 'online' ? '🟢 온라인' : '🔴 오프라인', inline: true },
        { name: '핑', value: `${status.botInfo.ping}ms`, inline: true },
        { name: '가동 시간', value: `${Math.floor(status.botInfo.uptime / 60)}분`, inline: true },
        { name: '서버 수', value: `${status.botInfo.guilds?.length || 0}개`, inline: true },
        { name: '마지막 업데이트', value: new Date(status.lastUpdate).toLocaleString('ko-KR'), inline: false }
      );

      if (status.botInfo.guilds && status.botInfo.guilds.length > 0) {
        const guildList = status.botInfo.guilds
          .map(g => `• ${g.name} (${g.memberCount}명)`)
          .join('\n');
        embed.addFields({ name: '연결된 서버', value: guildList, inline: false });
      }
    } else {
      embed.setDescription('봇 정보를 불러올 수 없습니다.');
    }

    // 최근 이벤트
    if (status.events && status.events.length > 0) {
      const eventList = status.events
        .slice(0, 5)
        .map(e => {
          const time = new Date(e.timestamp).toLocaleTimeString('ko-KR');
          const typeEmoji = {
            'interaction': '🔘',
            'bot_ready': '✅',
            'error': '❌'
          }[e.type] || '📝';
          return `${typeEmoji} ${time} - ${e.type}`;
        })
        .join('\n');
      embed.addFields({ name: '최근 이벤트', value: eventList, inline: false });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error('❌ 봇 상태 조회 에러:', error);
    await interaction.reply({ 
      content: '봇 상태를 조회하는 중 오류가 발생했습니다.', 
      ephemeral: true 
    });
  }
}

/**
 * 통계 명령어
 */
export async function handleStatsCommand(interaction) {
  try {
    const inventory = await loadInventory();
    
    // 재고 통계
    let totalItems = 0;
    let totalCategories = 0;
    let completedItems = 0;
    
    for (const [category, items] of Object.entries(inventory.categories || {})) {
      totalCategories++;
      for (const [itemName, itemData] of Object.entries(items)) {
        totalItems++;
        const percentage = (itemData.quantity / itemData.required) * 100;
        if (percentage >= 100) completedItems++;
      }
    }
    
    // 제작 통계
    let totalCraftingItems = 0;
    let totalCraftingCategories = 0;
    let completedCraftingItems = 0;
    
    for (const [category, items] of Object.entries(inventory.crafting?.categories || {})) {
      totalCraftingCategories++;
      for (const [itemName, itemData] of Object.entries(items)) {
        totalCraftingItems++;
        const percentage = (itemData.quantity / itemData.required) * 100;
        if (percentage >= 100) completedCraftingItems++;
      }
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📊 재고 및 제작 통계')
      .addFields(
        { name: '📦 재고', value: `카테고리: ${totalCategories}개\n아이템: ${totalItems}개\n완료: ${completedItems}개 (${totalItems > 0 ? Math.round(completedItems / totalItems * 100) : 0}%)`, inline: true },
        { name: '🔨 제작', value: `카테고리: ${totalCraftingCategories}개\n아이템: ${totalCraftingItems}개\n완료: ${completedCraftingItems}개 (${totalCraftingItems > 0 ? Math.round(completedCraftingItems / totalCraftingItems * 100) : 0}%)`, inline: true }
      )
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error('❌ 통계 조회 에러:', error);
    await interaction.reply({ 
      content: '통계를 조회하는 중 오류가 발생했습니다.', 
      ephemeral: true 
    });
  }
}

/**
 * 수정 내역 명령어
 */
export async function handleHistoryCommand(interaction) {
  try {
    const inventory = await loadInventory();
    const history = inventory.history || [];
    
    if (history.length === 0) {
      return await interaction.reply({ 
        content: '수정 내역이 없습니다.', 
        ephemeral: true 
      });
    }
    
    const recentHistory = history.slice(0, 10);
    const historyText = recentHistory.map(h => {
      const time = new Date(h.timestamp).toLocaleString('ko-KR');
      const typeEmoji = {
        'add': '➕',
        'remove': '➖',
        'update_quantity': '📝',
        'update_required': '🎯'
      }[h.action] || '📝';
      return `${typeEmoji} ${time}\n**${h.itemName}** (${h.category})\n${h.details} - ${h.userName}`;
    }).join('\n\n');
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📜 최근 수정 내역')
      .setDescription(historyText)
      .setFooter({ text: `총 ${history.length}개의 기록 중 최근 10개` })
      .setTimestamp();
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error('❌ 수정 내역 조회 에러:', error);
    await interaction.reply({ 
      content: '수정 내역을 조회하는 중 오류가 발생했습니다.', 
      ephemeral: true 
    });
  }
}
