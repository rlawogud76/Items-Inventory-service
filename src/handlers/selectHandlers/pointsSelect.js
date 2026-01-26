// 배점 관리 셀렉트 핸들러

import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { getItemPoints } from '../../database.js';
import { encodeCustomIdPart } from '../../utils.js';

/**
 * 아이템 선택 - 배점 입력 모달 표시 (재고/제작 설정용)
 */
export async function handlePointsItemSelect(interaction, parts) {
  const type = parts[3];
  const category = parts[4];
  const page = parts[5];
  const selectedItem = interaction.values[0];
  
  // 현재 배점 조회
  const itemPoints = await getItemPoints();
  const currentPoints = itemPoints?.[type]?.[category]?.[selectedItem] || 1;
  
  // 모달 생성
  const modal = new ModalBuilder()
    .setCustomId(`modal_points_${type}_${category}_${encodeCustomIdPart(selectedItem)}`)
    .setTitle('배점 설정');
  
  const pointsInput = new TextInputBuilder()
    .setCustomId('points')
    .setLabel(`${selectedItem} 배점 (1-100)`)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('1-100 사이의 숫자를 입력하세요')
    .setValue(currentPoints.toString())
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(3);
  
  const row = new ActionRowBuilder().addComponents(pointsInput);
  modal.addComponents(row);
  
  await interaction.showModal(modal);
}

/**
 * 기여도 배점 아이템 선택 - 배점 입력 모달 표시
 */
export async function handleContributionPointsItemSelect(interaction) {
  // customId: contribution_select_points_inventory_해양_0
  const parts = interaction.customId.split('_');
  const type = parts[3];
  const category = parts[4];
  const page = parts[5];
  const selectedItem = interaction.values[0];
  
  // 현재 배점 조회
  const itemPoints = await getItemPoints();
  const currentPoints = itemPoints?.[type]?.[category]?.[selectedItem] || 1;
  
  // 모달 생성 - contribution 전용 모달
  const modal = new ModalBuilder()
    .setCustomId(`contribution_modal_points_${type}_${category}_${encodeCustomIdPart(selectedItem)}`)
    .setTitle('배점 설정');
  
  const pointsInput = new TextInputBuilder()
    .setCustomId('points')
    .setLabel(`${selectedItem} 배점 (1-100)`)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('1-100 사이의 숫자를 입력하세요')
    .setValue(currentPoints.toString())
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(3);
  
  const row = new ActionRowBuilder().addComponents(pointsInput);
  modal.addComponents(row);
  
  await interaction.showModal(modal);
}
