// 설정 관련 modal 핸들러 (바 크기 등)
import { loadInventory, getItemPoints, updateSettings } from '../../database.js';
import { createCraftingEmbed, createInventoryEmbed, createButtons } from '../../embeds.js';
import { getAutoRefreshTimers } from '../buttonHandlers/settings.js';

/**
 * 바 크기 설정 모달 제출 핸들러
 * bar_size_modal_${type}_${category || 'all'}
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleBarSizeModal(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[3]; // 'inventory' or 'crafting'
    const category = parts[4] === 'all' ? null : parts.slice(4).join('_');

    const barSizeValue = interaction.fields.getTextInputValue('bar_size_value').trim();
    const percentage = parseInt(barSizeValue, 10);

    if (isNaN(percentage) || percentage < 25 || percentage > 200) {
      return await interaction.reply({
        content: `❌ 25% ~ 200% 사이의 숫자를 입력해주세요. (입력값: ${barSizeValue})`,
        ephemeral: true
      });
    }

    const newLength = Math.round(percentage / 10);

    const [inventory, itemPoints] = await Promise.all([
      loadInventory(),
      getItemPoints()
    ]);
    
    // DB 저장 (새 스키마)
    await updateSettings({ barLength: newLength });
    
    // UI 업데이트를 위해 로컬 객체도 수정 (loadInventory를 다시 부르지 않기 위해)
    if (!inventory.settings) inventory.settings = {};
    inventory.settings.barLength = newLength;

    const uiMode = inventory.settings?.uiMode || 'normal';
    let embed;
    let totalPages;

    if (type === 'crafting') {
      const crafting = inventory.crafting || { categories: {}, crafting: {} };
      const items = Object.entries(crafting.categories[category] || {});
      totalPages = Math.ceil(items.length / 25);
      embed = createCraftingEmbed(crafting, category, uiMode, newLength, 0, inventory, itemPoints);
    } else {
      const items = Object.entries(inventory.categories[category] || {});
      totalPages = Math.ceil(items.length / 25);
      embed = createInventoryEmbed(inventory, category, uiMode, newLength, 0, itemPoints);
    }

    const messageId = interaction.message?.id;
    const isAutoRefreshing = getAutoRefreshTimers().has(messageId);
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

/**
 * 타이머 설정 모달 제출 핸들러
 * timeout_settings_modal_${type}_${category}
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleTimeoutSettingsModal(interaction) {
  try {
    const selectTimeoutValue = interaction.fields.getTextInputValue('select_timeout').trim();
    const infoTimeoutValue = interaction.fields.getTextInputValue('info_timeout').trim();
    
    const selectTimeout = parseInt(selectTimeoutValue, 10);
    const infoTimeout = parseInt(infoTimeoutValue, 10);
    
    if (isNaN(selectTimeout) || selectTimeout < 10 || selectTimeout > 300) {
      return await interaction.reply({
        content: `❌ 셀렉트 메뉴 타이머는 10~300초 사이여야 합니다. (입력값: ${selectTimeoutValue})`,
        ephemeral: true
      });
    }
    
    if (isNaN(infoTimeout) || infoTimeout < 5 || infoTimeout > 300) {
      return await interaction.reply({
        content: `❌ 안내 메시지 타이머는 5~300초 사이여야 합니다. (입력값: ${infoTimeoutValue})`,
        ephemeral: true
      });
    }
    
    // DB 저장
    await updateSettings({ 
      selectMessageTimeout: selectTimeout,
      infoMessageTimeout: infoTimeout
    });
    
    await interaction.reply({
      content: `✅ 타이머 설정 완료!\n\n📋 셀렉트 메뉴: ${selectTimeout}초\n💬 안내 메시지: ${infoTimeout}초\n\n_이 메시지는 ${infoTimeout}초 후 자동 삭제됩니다_`,
      ephemeral: true
    });
    
    // 설정한 시간 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, infoTimeout * 1000);
    
    console.log(`⏱️ 타이머 설정 변경: 셀렉트=${selectTimeout}초, 안내=${infoTimeout}초`);
  } catch (error) {
    console.error('❌ 타이머 설정 모달 제출 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 타이머 설정 모달 응답 실패:', err);
    });
  }
}
