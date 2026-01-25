// 설정 핸들러 (UI 모드, 바 크기)
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { loadInventory, updateSettings } from '../../database.js';
import { createCraftingEmbed, createInventoryEmbed, createButtons } from '../../embeds.js';

// 자동 새로고침 타이머 저장소 (messageId -> { timer, type, category, page, errorCount, lastRefresh })
const autoRefreshTimers = new Map();

// 자동 새로고침 설정
const AUTO_REFRESH_CONFIG = {
  INTERVAL: 5000,           // 5초마다 새로고침
  MAX_ERRORS: 3,            // 연속 에러 최대 횟수 (초과 시 중지)
  MAX_DURATION: 600000,     // 최대 10분 동안 실행
  MIN_INTERVAL: 2000,       // 최소 간격 (rate limit 방지)
};

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
    
    // DB 저장 (새 스키마)
    await updateSettings({ uiMode: newMode });
    
    // UI 업데이트를 위해 로컬 객체도 수정
    if (!inventory.settings) inventory.settings = {};
    inventory.settings.uiMode = newMode;
    
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
    
    // 현재 페이지 추출 (버튼에서)
    let currentPage = 0;
    try {
      const pageButtons = interaction.message.components?.find(row => 
        row.components?.some(c => c.customId?.startsWith('page_prev_embed_') || c.customId?.startsWith('page_next_embed_'))
      );
      if (pageButtons) {
        const pageButton = pageButtons.components.find(c => c.customId?.startsWith('page_prev_embed_') || c.customId?.startsWith('page_next_embed_'));
        if (pageButton) {
          const btnParts = pageButton.customId.split('_');
          currentPage = parseInt(btnParts[btnParts.length - 2]) || 0;
        }
      }
    } catch (e) {
      currentPage = 0;
    }
    
    // 자동 새로고침 토글
    if (autoRefreshTimers.has(messageId)) {
      // 중지
      const timerData = autoRefreshTimers.get(messageId);
      clearInterval(timerData.timer);
      if (timerData.stopTimeout) clearTimeout(timerData.stopTimeout);
      autoRefreshTimers.delete(messageId);
      console.log('⏸️ 자동 새로고침 중지:', messageId);
      
      const inventory = await loadInventory();
      const uiMode = inventory.settings?.uiMode || 'normal';
      const barLength = inventory.settings?.barLength || 15;
      const page = timerData.page || 0;
      
      let embed, items, totalPages;
      if (type === 'crafting') {
        const crafting = inventory.crafting || { categories: {}, crafting: {} };
        items = Object.entries(crafting.categories?.[category] || {});
        totalPages = Math.ceil(items.length / 25) || 1;
        embed = createCraftingEmbed(crafting, category, uiMode, barLength, page, inventory);
      } else {
        items = Object.entries(inventory.categories?.[category] || {});
        totalPages = Math.ceil(items.length / 25) || 1;
        embed = createInventoryEmbed(inventory, category, uiMode, barLength, page);
      }
      
      const buttons = createButtons(category, false, type || 'inventory', uiMode, barLength, inventory, interaction.user.id, page, totalPages);
      
      await interaction.update({ embeds: [embed], components: buttons });
    } else {
      // 시작
      console.log('▶️ 자동 새로고침 시작:', messageId, '/ 타입:', type, '/ 카테고리:', category || '전체', '/ 페이지:', currentPage);
      
      const inventory = await loadInventory();
      const uiMode = inventory.settings?.uiMode || 'normal';
      const barLength = inventory.settings?.barLength || 15;
      
      let embed, items, totalPages;
      if (type === 'crafting') {
        const crafting = inventory.crafting || { categories: {}, crafting: {} };
        items = Object.entries(crafting.categories?.[category] || {});
        totalPages = Math.ceil(items.length / 25) || 1;
        embed = createCraftingEmbed(crafting, category, uiMode, barLength, currentPage, inventory);
      } else {
        items = Object.entries(inventory.categories?.[category] || {});
        totalPages = Math.ceil(items.length / 25) || 1;
        embed = createInventoryEmbed(inventory, category, uiMode, barLength, currentPage);
      }
      
      const buttons = createButtons(category, true, type || 'inventory', uiMode, barLength, inventory, interaction.user.id, currentPage, totalPages);
      
      await interaction.update({ embeds: [embed], components: buttons });
      
      // 타이머 데이터 초기화
      const timerData = {
        timer: null,
        stopTimeout: null,
        type,
        category,
        page: currentPage,
        errorCount: 0,
        startTime: Date.now(),
        channelId: interaction.channelId,
        client: interaction.client
      };
      
      // 자동 새로고침 타이머
      timerData.timer = setInterval(async () => {
        try {
          const now = Date.now();
          
          // Rate limit 방지: 최소 간격 체크
          if (timerData.lastRefresh && (now - timerData.lastRefresh) < AUTO_REFRESH_CONFIG.MIN_INTERVAL) {
            return;
          }
          timerData.lastRefresh = now;
          
          // 메시지가 여전히 존재하는지 확인
          let message;
          try {
            message = await interaction.message.fetch();
          } catch (fetchError) {
            // 메시지를 찾을 수 없음 (삭제됨)
            console.log('⚠️ 메시지가 삭제됨. 자동 새로고침 중지:', messageId);
            stopAutoRefresh(messageId, '메시지 삭제됨');
            return;
          }
          
          const inv = await loadInventory();
          const uiMode = inv.settings?.uiMode || 'normal';
          const barLength = inv.settings?.barLength || 15;
          const page = timerData.page;
          
          let emb, items, totalPages;
          if (type === 'crafting') {
            const crafting = inv.crafting || { categories: {}, crafting: {} };
            items = Object.entries(crafting.categories?.[category] || {});
            totalPages = Math.ceil(items.length / 25) || 1;
            emb = createCraftingEmbed(crafting, category, uiMode, barLength, page, inv);
          } else {
            items = Object.entries(inv.categories?.[category] || {});
            totalPages = Math.ceil(items.length / 25) || 1;
            emb = createInventoryEmbed(inv, category, uiMode, barLength, page);
          }
          
          const btns = createButtons(category, true, type || 'inventory', uiMode, barLength, inv, null, page, totalPages);
          
          await message.edit({ embeds: [emb], components: btns });
          
          // 성공 시 에러 카운트 리셋
          timerData.errorCount = 0;
          console.log('🔄 자동 새로고침 실행:', new Date().toLocaleTimeString(), `(페이지: ${page + 1}/${totalPages})`);
          
        } catch (error) {
          timerData.errorCount++;
          console.error(`❌ 자동 새로고침 에러 (${timerData.errorCount}/${AUTO_REFRESH_CONFIG.MAX_ERRORS}):`, error.message);
          
          // 연속 에러가 최대치를 초과하면 중지
          if (timerData.errorCount >= AUTO_REFRESH_CONFIG.MAX_ERRORS) {
            stopAutoRefresh(messageId, `연속 ${AUTO_REFRESH_CONFIG.MAX_ERRORS}회 에러 발생`, timerData);
          }
        }
      }, AUTO_REFRESH_CONFIG.INTERVAL);
      
      // 최대 시간 후 자동 중지 (안전장치)
      timerData.stopTimeout = setTimeout(() => {
        if (autoRefreshTimers.has(messageId)) {
          stopAutoRefresh(messageId, '10분 경과로 자동 중지', timerData);
        }
      }, AUTO_REFRESH_CONFIG.MAX_DURATION);
      
      autoRefreshTimers.set(messageId, timerData);
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

/**
 * 자동 새로고침 중지 헬퍼 함수
 * @param {string} messageId - 메시지 ID
 * @param {string} reason - 중지 사유
 * @param {object} timerData - 타이머 데이터 (선택)
 */
async function stopAutoRefresh(messageId, reason, timerData = null) {
  const data = timerData || autoRefreshTimers.get(messageId);
  if (!data) return;
  
  clearInterval(data.timer);
  if (data.stopTimeout) clearTimeout(data.stopTimeout);
  autoRefreshTimers.delete(messageId);
  
  console.log(`⏹️ 자동 새로고침 중지: ${messageId} (사유: ${reason})`);
  
  // 메시지 업데이트 시도 (버튼 상태 변경)
  try {
    if (data.client && data.channelId) {
      const channel = await data.client.channels.fetch(data.channelId);
      const message = await channel.messages.fetch(messageId);
      
      const inventory = await loadInventory();
      const uiMode = inventory.settings?.uiMode || 'normal';
      const barLength = inventory.settings?.barLength || 15;
      const page = data.page || 0;
      
      let embed, items, totalPages;
      if (data.type === 'crafting') {
        const crafting = inventory.crafting || { categories: {}, crafting: {} };
        items = Object.entries(crafting.categories?.[data.category] || {});
        totalPages = Math.ceil(items.length / 25) || 1;
        embed = createCraftingEmbed(crafting, data.category, uiMode, barLength, page, inventory);
      } else {
        items = Object.entries(inventory.categories?.[data.category] || {});
        totalPages = Math.ceil(items.length / 25) || 1;
        embed = createInventoryEmbed(inventory, data.category, uiMode, barLength, page);
      }
      
      const buttons = createButtons(data.category, false, data.type || 'inventory', uiMode, barLength, inventory, null, page, totalPages);
      
      await message.edit({ 
        embeds: [embed], 
        components: buttons 
      });
      console.log(`✅ 자동 새로고침 중지 후 버튼 상태 업데이트 완료`);
    }
  } catch (updateError) {
    console.error('⚠️ 자동 새로고침 중지 후 메시지 업데이트 실패:', updateError.message);
  }
}

/**
 * 외부에서 자동 새로고침 페이지 업데이트 (페이지 이동 시 호출)
 * @param {string} messageId - 메시지 ID
 * @param {number} newPage - 새 페이지 번호
 */
export function updateAutoRefreshPage(messageId, newPage) {
  if (autoRefreshTimers.has(messageId)) {
    const timerData = autoRefreshTimers.get(messageId);
    timerData.page = newPage;
    console.log(`📄 자동 새로고침 페이지 업데이트: ${messageId} -> ${newPage + 1}페이지`);
  }
}

/**
 * 타이머 설정 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleTimeoutSettingsButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.length > 3 ? parts.slice(3).join('_') : 'all';
    
    const inventory = await loadInventory();
    const selectTimeout = inventory.settings?.selectMessageTimeout || 30;
    const infoTimeout = inventory.settings?.infoMessageTimeout || 15;
    
    // 모달 생성
    const modal = new ModalBuilder()
      .setCustomId(`timeout_settings_modal_${type}_${category}`)
      .setTitle('⏱️ 메시지 자동 삭제 시간 설정');
    
    const selectTimeoutInput = new TextInputBuilder()
      .setCustomId('select_timeout')
      .setLabel('셀렉트 메뉴 메시지 (초)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 30 (10~300초)')
      .setValue(String(selectTimeout))
      .setRequired(true)
      .setMinLength(2)
      .setMaxLength(3);
    
    const infoTimeoutInput = new TextInputBuilder()
      .setCustomId('info_timeout')
      .setLabel('안내 메시지 (초)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 15 (5~300초)')
      .setValue(String(infoTimeout))
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(3);
    
    const row1 = new ActionRowBuilder().addComponents(selectTimeoutInput);
    const row2 = new ActionRowBuilder().addComponents(infoTimeoutInput);
    modal.addComponents(row1, row2);
    
    await interaction.showModal(modal);
    console.log(`⏱️ 타이머 설정 모달 표시 (셀렉트: ${selectTimeout}초, 안내: ${infoTimeout}초)`);
  } catch (error) {
    console.error('❌ 타이머 설정 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
      console.error('❌ 타이머 설정 에러 응답 실패:', err);
    });
  }
}
