// 설정 핸들러 (UI 모드, 바 크기)
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { loadInventory, saveInventory } from '../../database.js';
import { createCraftingEmbed, createInventoryEmbed, createButtons } from '../../embeds.js';

// 자동 새로고침 타이머 저장소 (messageId -> setInterval). settings.js에서 단일 관리.
const autoRefreshTimers = new Map();

/**
 * autoRefreshTimers 조회 (modal 등 다른 핸들러에서 사용)
 * @returns {Map}
 */
export function getAutoRefreshTimers() {
  return autoRefreshTimers;
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
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
      console.error('❌ 바 크기 변경 에러 응답 실패:', err);
    });
  }
}

/**
 * UI 모드 변경 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleUiModeButton(interaction) {
  try {
    // 먼저 응답 지연 처리
    await interaction.deferUpdate();
    
    const parts = interaction.customId.split('_');
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.length > 3 ? parts.slice(3).join('_') : null;
    
    console.log('📏 UI 모드 변경 시작:', { type, category });
    
    const inventory = await loadInventory();
    
    // UI 모드 순환: normal -> detailed -> normal
    let currentMode = inventory.settings?.uiMode || 'normal';
    let newMode;
    if (currentMode === 'normal') newMode = 'detailed';
    else newMode = 'normal';
    
    console.log('📏 모드 변경:', currentMode, '->', newMode);
    
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
      embed = createCraftingEmbed(crafting, category, newMode, barLength, 0, inventory);
    } else {
      items = Object.entries(inventory.categories[category] || {});
      totalPages = Math.ceil(items.length / 25);
      embed = createInventoryEmbed(inventory, category, newMode, barLength, 0);
    }
    
    console.log('📏 Embed 생성 완료, totalPages:', totalPages);
    
    const messageId = interaction.message.id;
    const isAutoRefreshing = autoRefreshTimers.has(messageId);
    const buttons = createButtons(category, isAutoRefreshing, type || 'inventory', newMode, barLength, inventory, interaction.user.id, 0, totalPages);
    
    console.log('📏 Buttons 생성 완료, rows:', buttons?.length);
    
    try {
      // Embed를 JSON으로 변환
      const embedJSON = embed.toJSON ? embed.toJSON() : embed;
      
      // Discord 제한 검증
      if (embedJSON.description && embedJSON.description.length > 4096) {
        console.error('❌ Embed description이 너무 깁니다:', embedJSON.description.length);
        throw new Error('Embed description이 4096자를 초과했습니다.');
      }
      
      if (embedJSON.fields) {
        for (let i = 0; i < embedJSON.fields.length; i++) {
          const field = embedJSON.fields[i];
          if (field.name && field.name.length > 256) {
            console.error(`❌ Field ${i} name이 너무 깁니다:`, field.name.length);
            throw new Error(`Field name이 256자를 초과했습니다.`);
          }
          if (field.value && field.value.length > 1024) {
            console.error(`❌ Field ${i} value가 너무 깁니다:`, field.value.length);
            throw new Error(`Field value가 1024자를 초과했습니다.`);
          }
        }
      }
      
      // 전체 embed 크기 계산
      const embedString = JSON.stringify(embedJSON);
      const embedSize = embedString.length;
      console.log('📏 Embed 크기:', embedSize, 'bytes');
      
      if (embedSize > 6000) {
        console.error('❌ Embed 전체 크기가 너무 큽니다:', embedSize);
        throw new Error('Embed 전체 크기가 6000자를 초과했습니다.');
      }
      
      // Components를 JSON으로 변환
      const componentsJSON = buttons.map(row => row.toJSON ? row.toJSON() : row);
      
      // REST API로 메시지 수정
      await interaction.client.rest.patch(
        `/channels/${interaction.channelId}/messages/${interaction.message.id}`,
        {
          body: {
            embeds: [embedJSON],
            components: componentsJSON
          }
        }
      );
      
      console.log(`📏 UI 모드 변경 완료: ${currentMode} -> ${newMode}`);
    } catch (apiError) {
      console.error('❌ REST API 호출 에러:', apiError);
      console.error('❌ API 에러 상세:', apiError.message);
      throw apiError;
    }
  } catch (error) {
    console.error('❌ UI 모드 변경 에러:', error);
    console.error('❌ 에러 스택:', error.stack);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다.', flags: 64 }).catch((err) => {
        console.error('❌ UI 모드 변경 에러 응답 실패:', err);
      });
    }
  }
}

/**
 * 자동 새로고침 토글 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleAutoRefreshButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.length > 3 ? parts.slice(3).join('_') : null;
    const messageId = interaction.message.id;
    
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
        embed = createCraftingEmbed(crafting, category, 'normal', 15, 0, inventory);
      } else {
        embed = createInventoryEmbed(inventory, category);
      }
      
      const uiMode = inventory.settings?.uiMode || 'normal';
      const barLength = inventory.settings?.barLength || 15;
      const buttons = createButtons(category, false, type || 'inventory', uiMode, barLength);
      
      await interaction.update({ embeds: [embed], components: buttons });
    } else {
      // 시작
      console.log('▶️ 자동 새로고침 시작:', messageId, '/ 타입:', type, '/ 카테고리:', category || '전체');
      
      const inventory = await loadInventory();
      let embed;
      
      if (type === 'crafting') {
        const crafting = inventory.crafting || { categories: {}, crafting: {} };
        embed = createCraftingEmbed(crafting, category, 'normal', 15, 0, inventory);
      } else {
        embed = createInventoryEmbed(inventory, category);
      }
      
      const uiMode = inventory.settings?.uiMode || 'normal';
      const barLength = inventory.settings?.barLength || 15;
      const buttons = createButtons(category, true, type || 'inventory', uiMode, barLength);
      
      await interaction.update({ embeds: [embed], components: buttons });
      
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
            emb = createCraftingEmbed(crafting, category, 'normal', 15, 0, inv);
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
      await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
        console.error('❌ 자동 새로고침 토글 에러 응답 실패:', err);
      });
    }
  }
}
