// 설정 핸들러 (UI 모드, 바 크기)
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { loadInventory, saveInventory } from '../../database.js';
import { createCraftingEmbed, createInventoryEmbed, createButtons } from '../../embeds.js';

// autoRefreshTimers는 buttons.js에서 import 필요
let autoRefreshTimers;

/**
 * autoRefreshTimers 설정 (buttons.js에서 호출)
 * @param {Map} timers - 타이머 맵
 */
export function setAutoRefreshTimers(timers) {
  autoRefreshTimers = timers;
}

/**
 * 바 크기 설정 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleBarSizeButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.length > 3 ? parts.slice(3).join('_') : null;
    
    const inventory = await loadInventory();
    const currentLength = inventory.settings?.barLength || 15;
    
    // 모달 생성
    const modal = new ModalBuilder()
      .setCustomId(`bar_size_modal_${type}_${category || 'all'}`)
      .setTitle('📊 프로그레스 바 크기 설정');
    
    const barSizeInput = new TextInputBuilder()
      .setCustomId('bar_size_value')
      .setLabel('바 크기 (25% ~ 200%)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 100')
      .setValue(String(Math.round(currentLength * 10)))
      .setRequired(true)
      .setMinLength(2)
      .setMaxLength(3);
    
    const row = new ActionRowBuilder().addComponents(barSizeInput);
    modal.addComponents(row);
    
    await interaction.showModal(modal);
    console.log(`📊 바 크기 설정 모달 표시 (현재: ${Math.round(currentLength * 10)}%)`);
  } catch (error) {
    console.error('❌ 바 크기 변경 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * UI 모드 변경 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleUiModeButton(interaction) {
  try {
    // 먼저 응답 지연 처리 (3초 제한 회피)
    await interaction.deferUpdate();
    
    const parts = interaction.customId.split('_');
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.length > 3 ? parts.slice(3).join('_') : null;
    
    const inventory = await loadInventory();
    
    // UI 모드 순환: normal -> detailed -> normal
    let currentMode = inventory.settings?.uiMode || 'normal';
    let newMode;
    if (currentMode === 'normal') newMode = 'detailed';
    else newMode = 'normal';
    
    // 설정 저장
    if (!inventory.settings) inventory.settings = {};
    inventory.settings.uiMode = newMode;
    await saveInventory(inventory);
    
    const barLength = inventory.settings?.barLength || 15;
    let embed, items, totalPages;
    if (type === 'crafting') {
      const crafting = inventory.crafting || { categories: {}, crafting: {} };
      items = Object.entries(crafting.categories[category] || {});
      totalPages = Math.ceil(items.length / 25);
      embed = createCraftingEmbed(crafting, category, newMode, barLength, 0);
    } else {
      items = Object.entries(inventory.categories[category] || {});
      totalPages = Math.ceil(items.length / 25);
      embed = createInventoryEmbed(inventory, category, newMode, barLength, 0);
    }
    
    const messageId = interaction.message.id;
    const isAutoRefreshing = autoRefreshTimers?.has(messageId) || false;
    const buttons = createButtons(category, isAutoRefreshing, type || 'inventory', newMode, barLength, inventory, interaction.user.id, 0, totalPages);
    
    // deferUpdate 후에는 webhook을 통해 메시지 수정
    await interaction.webhook.editMessage(interaction.message.id, { 
      embeds: [embed], 
      components: buttons 
    });
    console.log(`📏 UI 모드 변경: ${currentMode} -> ${newMode}`);
  } catch (error) {
    console.error('❌ UI 모드 변경 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
    }
  }
}

/**
 * 자동 새로고침 토글 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleAutoRefreshButton(interaction) {
  try {
    // 먼저 응답 지연 처리 (3초 제한 회피)
    await interaction.deferUpdate();
    
    const parts = interaction.customId.split('_');
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.length > 3 ? parts.slice(3).join('_') : null;
    const messageId = interaction.message.id;
    
    if (!autoRefreshTimers) {
      console.error('❌ autoRefreshTimers가 설정되지 않았습니다');
      return await interaction.editReply({ content: '오류가 발생했습니다.' });
    }
    
    // 자동 새로고침 토글
    if (autoRefreshTimers.has(messageId)) {
      // 중지
      clearInterval(autoRefreshTimers.get(messageId));
      autoRefreshTimers.delete(messageId);
      console.log('⏸️ 자동 새로고침 중지:', messageId);
      
      const inventory = await loadInventory();
      let embed;
      
      if (type === 'crafting') {
        const crafting = inventory.crafting || { categories: {}, crafting: {} };
        embed = createCraftingEmbed(crafting, category);
      } else {
        embed = createInventoryEmbed(inventory, category);
      }
      
      const uiMode = inventory.settings?.uiMode || 'normal';
      const barLength = inventory.settings?.barLength || 15;
      const buttons = createButtons(category, false, type || 'inventory', uiMode, barLength);
      
      // deferUpdate 후에는 webhook을 통해 메시지 수정
      await interaction.webhook.editMessage(interaction.message.id, { 
        embeds: [embed], 
        components: buttons 
      });
    } else {
      // 시작
      console.log('▶️ 자동 새로고침 시작:', messageId, '/ 타입:', type, '/ 카테고리:', category || '전체');
      
      const inventory = await loadInventory();
      let embed;
      
      if (type === 'crafting') {
        const crafting = inventory.crafting || { categories: {}, crafting: {} };
        embed = createCraftingEmbed(crafting, category);
      } else {
        embed = createInventoryEmbed(inventory, category);
      }
      
      const uiMode = inventory.settings?.uiMode || 'normal';
      const barLength = inventory.settings?.barLength || 15;
      const buttons = createButtons(category, true, type || 'inventory', uiMode, barLength);
      
      // deferUpdate 후에는 webhook을 통해 메시지 수정
      await interaction.webhook.editMessage(interaction.message.id, { 
        embeds: [embed], 
        components: buttons 
      });
      
      // 5초마다 자동 새로고침
      const timer = setInterval(async () => {
        try {
          // 메시지가 여전히 존재하는지 확인
          const message = await interaction.message.fetch().catch(() => null);
          if (!message) {
            console.log('⚠️ 메시지가 삭제됨. 자동 새로고침 중지:', messageId);
            clearInterval(timer);
            autoRefreshTimers.delete(messageId);
            return;
          }
          
          const inv = await loadInventory();
          let emb;
          
          if (type === 'crafting') {
            const crafting = inv.crafting || { categories: {}, crafting: {} };
            emb = createCraftingEmbed(crafting, category);
          } else {
            emb = createInventoryEmbed(inv, category);
          }
          
          const uiMode = inv.settings?.uiMode || 'normal';
          const barLength = inv.settings?.barLength || 15;
          const btns = createButtons(category, true, type || 'inventory', uiMode, barLength);
          
          await interaction.message.edit({ embeds: [emb], components: btns });
          console.log('🔄 자동 새로고침 실행:', new Date().toLocaleTimeString());
        } catch (error) {
          console.error('❌ 자동 새로고침 에러:', error);
          // 에러 발생 시 타이머 중지
          clearInterval(timer);
          autoRefreshTimers.delete(messageId);
        }
      }, 5000); // 5초
      
      autoRefreshTimers.set(messageId, timer);
      
      // 10분 후 자동 중지 (안전장치)
      setTimeout(() => {
        if (autoRefreshTimers.has(messageId)) {
          console.log('⏰ 10분 경과. 자동 새로고침 자동 중지:', messageId);
          clearInterval(timer);
          autoRefreshTimers.delete(messageId);
        }
      }, 600000); // 10분
    }
  } catch (error) {
    console.error('❌ 자동 새로고침 토글 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
    }
  }
}
