// 수량 액션 핸들러 (추가/수정/차감)
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { loadInventory } from '../../database.js';
import { formatQuantity } from '../../utils.js';

/**
 * 수량 추가/수정/차감/목표수정 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleQuantityActionButton(interaction) {
  try {
    console.log('🔘 수량 추가/수정/차감/목표수정 버튼 클릭');
    console.log('  - customId:', interaction.customId);
    
    // quantity_add_inventory_해양_산호 형식 파싱
    // 마지막 _를 기준으로 아이템명 분리
    const lastUnderscoreIndex = interaction.customId.lastIndexOf('_');
    const selectedItem = interaction.customId.substring(lastUnderscoreIndex + 1);
    const prefix = interaction.customId.substring(0, lastUnderscoreIndex);
    const parts = prefix.split('_');
    
    let action, type, category;
    // quantity_edit_required_inventory_해양 형식 처리
    if (parts[1] === 'edit' && parts[2] === 'required') {
      action = 'edit_required';
      type = parts[3];
      category = parts.slice(4).join('_');
    } else {
      action = parts[1]; // 'add', 'edit', or 'subtract'
      type = parts[2]; // 'inventory' or 'crafting'
      category = parts.slice(3).join('_');
    }
    
    console.log('  - action:', action);
    console.log('  - type:', type);
    console.log('  - category:', category);
    console.log('  - selectedItem:', selectedItem);
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory : inventory.crafting;
    
    console.log('  - targetData.categories:', Object.keys(targetData.categories || {}));
    
    if (!targetData.categories[category]) {
      console.error('❌ 카테고리를 찾을 수 없습니다:', category);
      return await interaction.reply({ 
        content: `❌ "${category}" 카테고리를 찾을 수 없습니다.`, 
        ephemeral: true 
      });
    }
    
    if (!targetData.categories[category][selectedItem]) {
      console.error('❌ 아이템을 찾을 수 없습니다:', selectedItem);
      return await interaction.reply({ 
        content: `❌ "${selectedItem}" 아이템을 "${category}" 카테고리에서 찾을 수 없습니다.`, 
        ephemeral: true 
      });
    }
    
    const itemData = targetData.categories[category][selectedItem];
    const current = formatQuantity(itemData.quantity);
    const required = formatQuantity(itemData.required);
    
    console.log('  - itemData:', itemData);
    console.log('✅ 모달 생성 시작');
    
    // 모달 생성
    let modalTitle, boxesLabel, boxesPlaceholder, boxesDefault, setsLabel, setsPlaceholder, setsDefault, itemsLabel, itemsPlaceholder, itemsDefault;
    
    if (action === 'add') {
      modalTitle = `${selectedItem} 추가`;
      boxesLabel = '추가할 상자 수 (1상자 = 54세트 = 3456개)';
      boxesPlaceholder = '예: 0';
      boxesDefault = '';
      setsLabel = '추가할 세트 수 (1세트 = 64개)';
      setsPlaceholder = '예: 2';
      setsDefault = '';
      itemsLabel = '추가할 낱개 수';
      itemsPlaceholder = '예: 32';
      itemsDefault = '';
    } else if (action === 'subtract') {
      modalTitle = `${selectedItem} 차감`;
      boxesLabel = '차감할 상자 수 (1상자 = 54세트 = 3456개)';
      boxesPlaceholder = '예: 0';
      boxesDefault = '';
      setsLabel = '차감할 세트 수 (1세트 = 64개)';
      setsPlaceholder = '예: 1';
      setsDefault = '';
      itemsLabel = '차감할 낱개 수';
      itemsPlaceholder = '예: 32';
      itemsDefault = '';
    } else if (action === 'edit_required') {
      modalTitle = `${selectedItem} 목표 수정 (현재: ${required.items}개/${required.sets}세트/${required.boxes}상자)`;
      boxesLabel = '목표 상자 수 (1상자 = 54세트 = 3456개)';
      boxesPlaceholder = '예: 0';
      boxesDefault = required.boxes.toString();
      setsLabel = '목표 세트 수 (1세트 = 64개)';
      setsPlaceholder = '예: 10';
      setsDefault = required.sets.toString();
      itemsLabel = '목표 낱개 수';
      itemsPlaceholder = '예: 32';
      itemsDefault = required.items.toString();
    } else {
      modalTitle = `${selectedItem} 수정 (현재: ${current.items}개/${current.sets}세트/${current.boxes}상자)`;
      boxesLabel = '설정할 상자 수 (1상자 = 54세트 = 3456개)';
      boxesPlaceholder = '예: 0';
      boxesDefault = current.boxes.toString();
      setsLabel = '설정할 세트 수 (1세트 = 64개)';
      setsPlaceholder = '예: 5';
      setsDefault = current.sets.toString();
      itemsLabel = '설정할 낱개 수';
      itemsPlaceholder = '예: 32';
      itemsDefault = current.items.toString();
    }
    
    const modal = new ModalBuilder()
      .setCustomId(`modal_${action}_${type}_${category}_${selectedItem}`)
      .setTitle(modalTitle);
    
    const boxesInput = new TextInputBuilder()
      .setCustomId('boxes_change')
      .setLabel(boxesLabel)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(boxesPlaceholder)
      .setValue(boxesDefault)
      .setRequired(false);
    
    const setsInput = new TextInputBuilder()
      .setCustomId('sets_change')
      .setLabel(setsLabel)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(setsPlaceholder)
      .setValue(setsDefault)
      .setRequired(false);
    
    const itemsInput = new TextInputBuilder()
      .setCustomId('items_change')
      .setLabel(itemsLabel)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(itemsPlaceholder)
      .setValue(itemsDefault)
      .setRequired(false);
    
    const row1 = new ActionRowBuilder().addComponents(boxesInput);
    const row2 = new ActionRowBuilder().addComponents(setsInput);
    const row3 = new ActionRowBuilder().addComponents(itemsInput);
    modal.addComponents(row1, row2, row3);
    
    console.log('✅ 모달 표시 시도');
    await interaction.showModal(modal);
    console.log('✅ 모달 표시 완료');
    
  } catch (error) {
    console.error('❌ 수량관리 액션 에러:', error);
    console.error('❌ 에러 스택:', error.stack);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}
