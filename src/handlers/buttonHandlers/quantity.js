// 수량 관리 핸들러
import { ActionRowBuilder } from 'discord.js';
import { loadInventory } from '../../database.js';
import { formatQuantity, getItemIcon } from '../../utils.js';

/**
 * 수량 관리 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleQuantityButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[1]; // 'inventory' or 'crafting'
    const category = parts.length > 2 ? parts.slice(2).join('_') : null;
    
    console.log('📊 수량관리 버튼 클릭');
    console.log('  - 타입:', type);
    console.log('  - 카테고리:', category || '전체');
    
    const inventory = await loadInventory();
    
    if (!category) {
      return await interaction.reply({ 
        content: `❌ 특정 카테고리를 선택한 후 수량관리 버튼을 사용해주세요.\n\`/${type === 'inventory' ? '재고' : '제작'} 카테고리:해양\` 처럼 카테고리를 지정해주세요.`, 
        ephemeral: true 
      });
    }
    
    const targetData = type === 'inventory' ? inventory : inventory.crafting;
    
    if (!targetData.categories[category]) {
      return await interaction.reply({ 
        content: `❌ "${category}" 카테고리를 찾을 수 없습니다.`, 
        ephemeral: true 
      });
    }
    
    // 현재 카테고리의 아이템 목록 생성
    const items = Object.keys(targetData.categories[category]);
    
    if (items.length === 0) {
      return await interaction.reply({ 
        content: `❌ "${category}" 카테고리에 아이템이 없습니다.`, 
        ephemeral: true 
      });
    }
    
    const itemOptions = items.map(item => {
      const itemData = targetData.categories[category][item];
      const customEmoji = itemData?.emoji;
      const { boxes, sets, items: remainder } = formatQuantity(itemData.quantity);
      return {
        label: item,
        value: item,
        emoji: customEmoji || getItemIcon(item, inventory),
        description: `현재: ${boxes}상자/${sets}세트/${remainder}개 (${itemData.quantity}개) / 목표: ${itemData.required}개`
      };
    });
    
    // Discord 제한: 최대 25개 옵션
    const limitedOptions = itemOptions.slice(0, 25);
    const hasMore = itemOptions.length > 25;
    
    // 선택 메뉴 생성
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_quantity_${type}_${category}`)
      .setPlaceholder('수량을 관리할 아이템을 선택하세요')
      .addOptions(limitedOptions);
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    let contentMessage = `📊 **${category}** 카테고리에서 수량을 관리할 아이템을 선택하세요:`;
    if (hasMore) {
      contentMessage += `\n\n⚠️ 항목이 많아 처음 25개만 표시됩니다. (전체 ${itemOptions.length}개)`;
    }
    
    const reply = await interaction.reply({
      content: contentMessage,
      components: [row],
      ephemeral: true,
      fetchReply: true
    });
    
    // 15초 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {
        // 이미 삭제되었거나 삭제할 수 없는 경우 무시
      }
    }, 15000);
    
  } catch (error) {
    console.error('❌ 버튼 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}
