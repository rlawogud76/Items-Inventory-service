// 물품/품목 관리 핸들러
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { loadInventory } from '../../database.js';
import { formatQuantity, getItemIcon } from '../../utils.js';

/**
 * 관리 메인 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleManageButton(interaction) {
  try {
    // 이미 응답했는지 확인
    if (interaction.replied || interaction.deferred) {
      console.log('⚠️ 이미 응답한 인터랙션, 무시');
      return;
    }
    
    const parts = interaction.customId.split('_');
    const type = parts[1]; // 'inventory' or 'crafting'
    const category = parts.length > 2 ? parts.slice(2).join('_') : null;
    
    if (!category) {
      return await interaction.reply({ 
        content: '❌ 카테고리를 선택한 후 사용해주세요.',
        ephemeral: true
      });
    }
    
    // 추가/수정/삭제/태그 선택 버튼
    const addButton = new ButtonBuilder()
      .setCustomId(`manage_add_${type}_${category}`)
      .setLabel(type === 'inventory' ? '➕ 물품 추가' : '➕ 품목 추가')
      .setStyle(ButtonStyle.Success);
    
    const editButton = new ButtonBuilder()
      .setCustomId(`manage_edit_${type}_${category}`)
      .setLabel('✏️ 이름 수정')
      .setStyle(ButtonStyle.Primary);
    
    const tagButton = new ButtonBuilder()
      .setCustomId(`manage_tag_${type}_${category}`)
      .setLabel('🏷️ 태그 관리')
      .setStyle(ButtonStyle.Primary);
    
    const removeButton = new ButtonBuilder()
      .setCustomId(`manage_remove_${type}_${category}`)
      .setLabel(type === 'inventory' ? '➖ 물품 삭제' : '➖ 품목 삭제')
      .setStyle(ButtonStyle.Danger);
    
    const row1 = new ActionRowBuilder().addComponents(addButton, editButton, removeButton);
    const row2 = new ActionRowBuilder().addComponents(tagButton);
    
    await interaction.reply({
      content: `📝 **${category}** 카테고리 ${type === 'inventory' ? '물품' : '품목'} 관리\n\n원하는 작업을 선택하세요:`,
      components: [row1, row2],
      ephemeral: true
    });
    
    // 30초 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, 30000);
    
  } catch (error) {
    console.error('❌ 관리 버튼 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
    }
  }
}

/**
 * 물품/품목 추가 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleManageAddButton(interaction) {
  try {
    // 이미 응답했는지 확인
    if (interaction.replied || interaction.deferred) {
      console.log('⚠️ 이미 응답한 인터랙션, 무시');
      return;
    }
    
    const parts = interaction.customId.split('_');
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.slice(3).join('_');
    
    const modal = new ModalBuilder()
      .setCustomId(`add_item_modal_${type}_${category}`)
      .setTitle(`➕ ${type === 'inventory' ? '물품' : '품목'} 추가 - ${category}`);
    
    const nameInput = new TextInputBuilder()
      .setCustomId('item_name')
      .setLabel(type === 'inventory' ? '아이템 이름' : '제작품 이름')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 다이아몬드')
      .setRequired(true);
    
    const initialSetsInput = new TextInputBuilder()
      .setCustomId('initial_sets')
      .setLabel('초기 수량 - 세트 (1세트 = 64개)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 0')
      .setValue('0')
      .setRequired(false);
    
    const initialItemsInput = new TextInputBuilder()
      .setCustomId('initial_items')
      .setLabel('초기 수량 - 낱개')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 0')
      .setValue('0')
      .setRequired(false);
    
    const requiredSetsInput = new TextInputBuilder()
      .setCustomId('required_sets')
      .setLabel('충족 수량 - 세트 (1세트 = 64개)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 10')
      .setRequired(false);
    
    const requiredItemsInput = new TextInputBuilder()
      .setCustomId('required_items')
      .setLabel('충족 수량 - 낱개')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 32')
      .setRequired(false);
    
    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(initialSetsInput),
      new ActionRowBuilder().addComponents(initialItemsInput),
      new ActionRowBuilder().addComponents(requiredSetsInput),
      new ActionRowBuilder().addComponents(requiredItemsInput)
    );
    
    await interaction.showModal(modal);
    
  } catch (error) {
    console.error('❌ 추가 모달 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
    }
  }
}

/**
 * 물품/품목 삭제 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleManageRemoveButton(interaction) {
  try {
    // 이미 응답했는지 확인
    if (interaction.replied || interaction.deferred) {
      console.log('⚠️ 이미 응답한 인터랙션, 무시');
      return;
    }
    
    const parts = interaction.customId.split('_');
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.slice(3).join('_');
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    
    if (!targetData?.[category] || Object.keys(targetData[category]).length === 0) {
      return await interaction.update({
        content: `❌ "${category}" 카테고리에 ${type === 'inventory' ? '아이템' : '제작품'}이 없습니다.`,
        components: []
      });
    }
    
    const items = Object.keys(targetData[category]);
    const itemOptions = items.map(item => {
      const formatted = formatQuantity(targetData[category][item].quantity);
      return {
        label: item,
        value: item,
        description: `현재: ${formatted.boxes}상자/${formatted.sets}세트/${formatted.items}개 / 목표: ${targetData[category][item].required}개`
      };
    });
    
    // Discord 제한: 최대 25개 옵션
    const limitedOptions = itemOptions.slice(0, 25);
    const hasMore = itemOptions.length > 25;
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_remove_${type}_${category}`)
      .setPlaceholder('삭제할 항목을 선택하세요')
      .addOptions(limitedOptions);
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    let contentMessage = `🗑️ **${category}** 카테고리에서 삭제할 ${type === 'inventory' ? '물품' : '품목'}을 선택하세요:`;
    if (hasMore) {
      contentMessage += `\n\n⚠️ 항목이 많아 처음 25개만 표시됩니다. (전체 ${itemOptions.length}개)`;
    }
    
    await interaction.update({
      content: contentMessage,
      components: [row]
    });
    
    // 30초 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, 30000);
    
  } catch (error) {
    console.error('❌ 삭제 선택 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
    }
  }
}

/**
 * 물품/품목 이름 수정 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleManageEditButton(interaction) {
  try {
    // 이미 응답했는지 확인
    if (interaction.replied || interaction.deferred) {
      console.log('⚠️ 이미 응답한 인터랙션, 무시');
      return;
    }
    
    const parts = interaction.customId.split('_');
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.slice(3).join('_');
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    
    if (!targetData?.[category] || Object.keys(targetData[category]).length === 0) {
      return await interaction.update({
        content: `❌ "${category}" 카테고리에 ${type === 'inventory' ? '아이템' : '제작품'}이 없습니다.`,
        components: []
      });
    }
    
    const items = Object.keys(targetData[category]);
    const itemOptions = items.map(item => {
      const formatted = formatQuantity(targetData[category][item].quantity);
      return {
        label: item,
        value: item,
        description: `현재: ${formatted.boxes}상자/${formatted.sets}세트/${formatted.items}개`
      };
    });
    
    // Discord 제한: 최대 25개 옵션
    const limitedOptions = itemOptions.slice(0, 25);
    const hasMore = itemOptions.length > 25;
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_edit_${type}_${category}`)
      .setPlaceholder('이름을 수정할 항목을 선택하세요')
      .addOptions(limitedOptions);
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    let contentMessage = `✏️ **${category}** 카테고리에서 이름을 수정할 ${type === 'inventory' ? '물품' : '품목'}을 선택하세요:`;
    if (hasMore) {
      contentMessage += `\n\n⚠️ 항목이 많아 처음 25개만 표시됩니다. (전체 ${itemOptions.length}개)`;
    }
    
    await interaction.update({
      content: contentMessage,
      components: [row]
    });
    
    // 30초 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, 30000);
    
  } catch (error) {
    console.error('❌ 이름 수정 선택 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
    }
  }
}
