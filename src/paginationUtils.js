// 페이지네이션 유틸리티 함수들
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';

/**
 * 페이지네이션된 아이템 목록 생성
 * @param {Array} items - 전체 아이템 배열
 * @param {number} page - 현재 페이지 (0부터 시작)
 * @param {number} itemsPerPage - 페이지당 아이템 수 (기본 25)
 * @returns {Object} { pagedItems, totalPages, startIndex, endIndex }
 */
export function paginateItems(items, page = 0, itemsPerPage = 25) {
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const startIndex = page * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, items.length);
  const pagedItems = items.slice(startIndex, endIndex);
  
  return {
    pagedItems,
    totalPages,
    startIndex,
    endIndex,
    hasNextPage: page < totalPages - 1,
    hasPrevPage: page > 0
  };
}

/**
 * 페이지네이션 버튼 생성
 * @param {string} baseId - 버튼 ID 베이스 (예: 'page_prev_quantity')
 * @param {number} page - 현재 페이지
 * @param {number} totalPages - 전체 페이지 수
 * @param {string} suffix - 추가 suffix (선택)
 * @returns {ActionRowBuilder} 페이지네이션 버튼 row
 */
export function createPaginationButtons(baseId, page, totalPages, suffix = '') {
  const suffixStr = suffix ? `_${suffix}` : '';
  
  const prevButton = new ButtonBuilder()
    .setCustomId(`${baseId}_prev${suffixStr}_${page}`)
    .setLabel('◀ 이전')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page === 0);
  
  const infoButton = new ButtonBuilder()
    .setCustomId(`${baseId}_info${suffixStr}_${page}`)
    .setLabel(`페이지 ${page + 1}/${totalPages}`)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);
  
  const nextButton = new ButtonBuilder()
    .setCustomId(`${baseId}_next${suffixStr}_${page}`)
    .setLabel('다음 ▶')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page >= totalPages - 1);
  
  return new ActionRowBuilder().addComponents(prevButton, infoButton, nextButton);
}

/**
 * Select menu 옵션 생성 (페이지네이션 포함)
 * @param {Array} items - 아이템 배열 [{ label, value, emoji?, description? }]
 * @param {number} page - 현재 페이지
 * @param {number} maxOptions - 최대 옵션 수 (기본 25)
 * @returns {Object} { options, totalPages, hasMore }
 */
export function createSelectOptions(items, page = 0, maxOptions = 25) {
  const { pagedItems, totalPages, hasNextPage, hasPrevPage } = paginateItems(items, page, maxOptions);
  
  return {
    options: pagedItems,
    totalPages,
    hasNextPage,
    hasPrevPage,
    currentPage: page
  };
}

/**
 * 아이템 목록을 select menu 옵션 형식으로 변환
 * @param {Array} itemNames - 아이템 이름 배열
 * @param {Function} getIcon - 아이콘 가져오는 함수 (선택)
 * @param {Object} inventory - inventory 객체 (아이콘용, 선택)
 * @returns {Array} Select menu 옵션 배열
 */
export function itemsToSelectOptions(itemNames, getIcon = null, inventory = null) {
  return itemNames.map(name => {
    const option = {
      label: name.length > 100 ? name.substring(0, 97) + '...' : name,
      value: name
    };
    
    if (getIcon && inventory) {
      try {
        const emoji = getIcon(name, inventory);
        if (emoji) {
          option.emoji = emoji;
        }
      } catch (error) {
        // 아이콘 가져오기 실패해도 계속 진행
      }
    }
    
    return option;
  });
}

/**
 * 페이지 번호 파싱 (customId에서 추출)
 * @param {string} customId - 버튼 customId
 * @returns {number} 페이지 번호
 */
export function parsePageFromCustomId(customId) {
  const parts = customId.split('_');
  const lastPart = parts[parts.length - 1];
  const page = parseInt(lastPart, 10);
  return isNaN(page) ? 0 : page;
}

/**
 * 페이지 이동 처리 (prev/next)
 * @param {string} customId - 버튼 customId
 * @param {string} direction - 'prev' 또는 'next'
 * @returns {number} 새 페이지 번호
 */
export function getNewPage(customId, direction) {
  const currentPage = parsePageFromCustomId(customId);
  
  if (direction === 'prev') {
    return Math.max(0, currentPage - 1);
  } else if (direction === 'next') {
    return currentPage + 1;
  }
  
  return currentPage;
}

/**
 * 페이지네이션 정보 텍스트 생성
 * @param {number} page - 현재 페이지
 * @param {number} totalPages - 전체 페이지 수
 * @param {number} totalItems - 전체 아이템 수
 * @param {number} startIndex - 시작 인덱스
 * @param {number} endIndex - 끝 인덱스
 * @returns {string} 페이지네이션 정보 텍스트
 */
export function getPaginationInfo(page, totalPages, totalItems, startIndex, endIndex) {
  if (totalPages <= 1) {
    return `전체 ${totalItems}개`;
  }
  
  return `📄 페이지 ${page + 1}/${totalPages} (${startIndex + 1}-${endIndex}번째 / 전체 ${totalItems}개)`;
}
