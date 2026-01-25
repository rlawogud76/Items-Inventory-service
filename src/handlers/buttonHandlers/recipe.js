// 레시피 관리 핸들러
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { loadInventory } from '../../database.js';
import { getItemIcon, getTimeoutSettings } from '../../utils.js';

/**
 * 이모지 검증 함수 - Select Menu는 유니코드 이모지만 허용
 * @param {string} emoji - 검증할 이모지
 * @returns {string} - 유효한 이모지 또는 기본 이모지
 */
function validateEmoji(emoji) {
  if (!emoji) return '📦';
  // 커스텀 Discord 이모지 형식(<:name:id> 또는 <a:name:id>)이거나 잘못된 형식이면 기본 이모지 사용
  if (emoji.startsWith('<') || emoji.length > 10) {
    return '📦';
  }
  return emoji;
}

/**
 * 레시피 메인 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[1]; // 'crafting'
    const category = parts.slice(2).join('_');
    
    const inventory = await loadInventory();
    const { selectTimeout } = getTimeoutSettings(inventory);
    
    // 레시피 관리 버튼 생성
    const viewButton = new ButtonBuilder()
      .setCustomId(`recipe_view_${category}_0`)
      .setLabel('📖 조회')
      .setStyle(ButtonStyle.Primary);
    
    const addButton = new ButtonBuilder()
      .setCustomId(`recipe_add_${category}`)
      .setLabel('➕ 추가')
      .setStyle(ButtonStyle.Success);
    
    const editButton = new ButtonBuilder()
      .setCustomId(`recipe_edit_${category}`)
      .setLabel('✏️ 수정')
      .setStyle(ButtonStyle.Primary);
    
    const row = new ActionRowBuilder().addComponents(viewButton, addButton, editButton);
    
    await interaction.reply({
      content: `📋 **${category}** 카테고리 레시피 관리\n\n원하는 작업을 선택하세요:\n\n_이 메시지는 ${selectTimeout / 1000}초 후 자동 삭제됩니다_`,
      components: [row],
      ephemeral: true
    });
    
    // 설정된 시간 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {
        // 이미 삭제되었거나 삭제할 수 없는 경우 무시
      }
    }, selectTimeout);
    
  } catch (error) {
    console.error('❌ 레시피 버튼 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
        console.error('❌ 레시피 버튼 에러 응답 실패:', err);
      });
    }
  }
}

/**
 * 레시피 조회 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeViewButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const category = parts.slice(2, -1).join('_');
    const page = parseInt(parts[parts.length - 1]) || 0;
    
    const inventory = await loadInventory();
    
    if (!inventory.crafting?.recipes?.[category] || Object.keys(inventory.crafting.recipes[category]).length === 0) {
      return await interaction.update({
        content: `❌ "${category}" 카테고리에 레시피가 없습니다.`,
        components: []
      });
    }
    
    const recipes = inventory.crafting.recipes[category];
    const recipeEntries = Object.entries(recipes);
    const recipeCount = recipeEntries.length;
    
    // 페이지네이션 설정 (Discord embed는 최대 25개 필드)
    const recipesPerPage = 10; // 여유있게 10개씩
    const totalPages = Math.ceil(recipeCount / recipesPerPage);
    const startIndex = page * recipesPerPage;
    const endIndex = Math.min(startIndex + recipesPerPage, recipeCount);
    const pageRecipes = recipeEntries.slice(startIndex, endIndex);
    
    const embed = new EmbedBuilder()
      .setTitle(`📋 ${category} 레시피북`)
      .setDescription(`총 **${recipeCount}개**의 레시피가 등록되어 있습니다.${totalPages > 1 ? ` (${page + 1}/${totalPages} 페이지)` : ''}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      .setColor(0xFFA500)
      .setTimestamp()
      .setFooter({ text: '✅ 제작 가능 | ⚠️ 재료 부족' });
    
    for (const [itemName, materials] of pageRecipes) {
      const icon = getItemIcon(itemName, inventory);
      
      // 제작 가능 여부 확인
      let canCraft = true;
      const materialLines = materials.map(m => {
        const matIcon = getItemIcon(m.name, inventory);
        const materialData = inventory.categories[m.category]?.[m.name];
        const currentQty = materialData?.quantity || 0;
        const hasEnough = currentQty >= m.quantity;
        
        if (!hasEnough) canCraft = false;
        
        const statusIcon = hasEnough ? '✅' : '❌';
        const qtyDisplay = hasEnough 
          ? `${m.quantity}개` 
          : `${m.quantity}개 (보유: ${currentQty}개)`;
        
        return `${statusIcon} ${matIcon} ${m.name} × ${qtyDisplay}`;
      });
      
      const statusEmoji = canCraft ? '✅' : '⚠️';
      const statusText = canCraft ? '제작 가능' : '재료 부족';
      
      const fieldValue = [
        `**${statusEmoji} ${statusText}**`,
        '',
        ...materialLines,
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      ].join('\n');
      
      embed.addFields({
        name: `${icon} ${itemName}`,
        value: fieldValue,
        inline: false
      });
    }
    
    const components = [];
    
    // 페이지네이션 버튼 추가 (2페이지 이상일 때)
    if (totalPages > 1) {
      const pageButtons = [];
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`recipe_view_${category}_${page - 1}`)
          .setLabel('◀ 이전')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0)
      );
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`recipe_view_info_${category}_${page}`)
          .setLabel(`페이지 ${page + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`recipe_view_${category}_${page + 1}`)
          .setLabel('다음 ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1)
      );
      
      components.push(new ActionRowBuilder().addComponents(pageButtons));
    }
    
    await interaction.update({
      embeds: [embed],
      components
    });
    
    const { selectTimeout } = getTimeoutSettings(inventory);
    
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, selectTimeout);
    
  } catch (error) {
    console.error('❌ 레시피 조회 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
      console.error('❌ 레시피 조회 에러 응답 실패:', err);
    });
  }
}

/**
 * 레시피 수정 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeEditButton(interaction) {
  try {
    const category = interaction.customId.replace('recipe_edit_', '');
    const inventory = await loadInventory();
    const { selectTimeout } = getTimeoutSettings(inventory);
    
    if (!inventory.crafting?.categories?.[category] || Object.keys(inventory.crafting.categories[category]).length === 0) {
      return await interaction.update({
        content: `❌ "${category}" 카테고리에 제작품이 없습니다.`,
        components: []
      });
    }
    
    const items = Object.keys(inventory.crafting.categories[category]);
    const page = 0; // 첫 페이지
    const itemsPerPage = 25;
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const startIndex = page * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, items.length);
    const pageItems = items.slice(startIndex, endIndex);
    
    const itemOptions = pageItems.map(item => ({
      label: item,
      value: item,
      emoji: validateEmoji(getItemIcon(item, inventory))
    }));
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_recipe_edit_${category}`)
      .setPlaceholder('레시피를 수정할 제작품을 선택하세요')
      .addOptions(itemOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼 추가 (25개 초과 시)
    if (totalPages > 1) {
      const pageButtons = [];
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_prev_recipe_edit_${category}_${page}`)
          .setLabel('◀ 이전')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0)
      );
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_info_recipe_edit_${category}_${page}`)
          .setLabel(`페이지 ${page + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_next_recipe_edit_${category}_${page}`)
          .setLabel('다음 ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1)
      );
      
      rows.push(new ActionRowBuilder().addComponents(pageButtons));
    }
    
    await interaction.update({
      content: `✏️ **${category}** 카테고리에서 레시피를 수정할 제작품을 선택하세요${totalPages > 1 ? ` (${items.length}개 중 ${startIndex + 1}-${endIndex}번째)` : ''}:\n\n_이 메시지는 ${selectTimeout / 1000}초 후 자동 삭제됩니다_`,
      components: rows
    });
    
    // 설정된 시간 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, selectTimeout);
    
  } catch (error) {
    console.error('❌ 레시피 수정 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
      console.error('❌ 레시피 수정 에러 응답 실패:', err);
    });
  }
}

/**
 * 레시피 추가 버튼 핸들러 (독립 실행)
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeAddButton(interaction) {
  try {
    const category = interaction.customId.replace('recipe_add_', '');
    const inventory = await loadInventory();
    const { selectTimeout } = getTimeoutSettings(inventory);
    
    if (!inventory.crafting?.categories?.[category] || Object.keys(inventory.crafting.categories[category]).length === 0) {
      return await interaction.update({
        content: `❌ "${category}" 카테고리에 제작품이 없습니다.`,
        components: []
      });
    }
    
    const items = Object.keys(inventory.crafting.categories[category]);
    const page = 0; // 첫 페이지
    const itemsPerPage = 25;
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const startIndex = page * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, items.length);
    const pageItems = items.slice(startIndex, endIndex);
    
    const itemOptions = pageItems.map(item => ({
      label: item,
      value: item,
      emoji: validateEmoji(getItemIcon(item, inventory))
    }));
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_recipe_add_${category}`)
      .setPlaceholder('레시피를 추가할 제작품을 선택하세요')
      .addOptions(itemOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼 추가 (25개 초과 시)
    if (totalPages > 1) {
      const pageButtons = [];
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_prev_recipe_add_${category}_${page}`)
          .setLabel('◀ 이전')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0)
      );
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_info_recipe_add_${category}_${page}`)
          .setLabel(`페이지 ${page + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_next_recipe_add_${category}_${page}`)
          .setLabel('다음 ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1)
      );
      
      rows.push(new ActionRowBuilder().addComponents(pageButtons));
    }
    
    await interaction.update({
      content: `➕ **${category}** 카테고리에서 레시피를 추가할 제작품을 선택하세요${totalPages > 1 ? ` (${items.length}개 중 ${startIndex + 1}-${endIndex}번째)` : ''}:\n\n_이 메시지는 ${selectTimeout / 1000}초 후 자동 삭제됩니다_`,
      components: rows
    });
    
    // 설정된 시간 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, selectTimeout);
    
  } catch (error) {
    console.error('❌ 레시피 추가 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
      console.error('❌ 레시피 추가 에러 응답 실패:', err);
    });
  }
}

/**
 * 레시피 추가/스킵 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeAddSkipButton(interaction) {
  try {
    const isSkip = interaction.customId.startsWith('skip_recipe_');
    const prefix = isSkip ? 'skip_recipe_' : 'add_recipe_';
    const parts = interaction.customId.replace(prefix, '').split('_');
    const category = parts[0];
    const itemName = parts.slice(1).join('_');
    
    const inventory = await loadInventory();
    const { infoTimeout } = getTimeoutSettings(inventory);
    
    if (isSkip) {
      await interaction.update({
        content: `✅ ${itemName}\n제작품이 추가되었습니다. 나중에 \`/레시피수정\` 명령어로 레시피를 추가할 수 있습니다.\n\n_이 메시지는 ${infoTimeout / 1000}초 후 자동 삭제됩니다_`,
        embeds: [],
        components: []
      });
      
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {}
      }, infoTimeout);
      return;
    }
    
    // 레시피 추가 - 재료 선택 메뉴 표시
    
    // 같은 카테고리의 재고 아이템 목록 가져오기
    if (!inventory.categories?.[category] || Object.keys(inventory.categories[category]).length === 0) {
      return await interaction.update({
        content: `❌ "${category}" 카테고리에 재료가 없습니다. 먼저 재고 목록에 재료를 추가해주세요.`,
        embeds: [],
        components: []
      });
    }
    
    const materials = Object.keys(inventory.categories[category]);
    const page = 0; // 첫 페이지
    const itemsPerPage = 25;
    const totalPages = Math.ceil(materials.length / itemsPerPage);
    const startIndex = page * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, materials.length);
    const pageMaterials = materials.slice(startIndex, endIndex);
    
    const materialOptions = pageMaterials.map(mat => ({
      label: mat,
      value: mat,
      emoji: validateEmoji(getItemIcon(mat, inventory))
    }));
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_recipe_material_${category}_${itemName}_1`)
      .setPlaceholder('재료 1을 선택하세요 (필수)')
      .addOptions(materialOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼 추가 (25개 초과 시)
    if (totalPages > 1) {
      const pageButtons = [];
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_prev_recipe_material_${category}_${itemName}_1_${page}`)
          .setLabel('◀ 이전')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0)
      );
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_info_recipe_material_${category}_${itemName}_1_${page}`)
          .setLabel(`페이지 ${page + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_next_recipe_material_${category}_${itemName}_1_${page}`)
          .setLabel('다음 ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1)
      );
      
      rows.push(new ActionRowBuilder().addComponents(pageButtons));
    }
    
    await interaction.update({
      content: `📝 ${itemName}\n레시피 추가\n\n**1단계:** 첫 번째 재료를 선택하세요${totalPages > 1 ? ` (${materials.length}개 중 ${startIndex + 1}-${endIndex}번째)` : ''}`,
      embeds: [],
      components: rows
    });
    
  } catch (error) {
    console.error('❌ 레시피 추가 버튼 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 레시피 추가 버튼 에러 응답 실패:', err);
    });
  }
}

/**
 * 레시피 추가 더하기/완료 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeMoreFinishButton(interaction) {
  try {
    const isFinish = interaction.customId.startsWith('finish_recipe_');
    const isEdit = interaction.customId.includes('_edit_');
    
    let prefix, parts, category, step, itemName;
    
    if (isEdit) {
      prefix = isFinish ? 'finish_recipe_edit_' : 'add_more_recipe_edit_';
      parts = interaction.customId.replace(prefix, '').split('_');
      category = parts[0];
      step = isFinish ? null : parseInt(parts[parts.length - 1]);
      itemName = isFinish ? parts.slice(1).join('_') : parts.slice(1, -1).join('_');
    } else {
      prefix = isFinish ? 'finish_recipe_' : 'add_more_recipe_';
      parts = interaction.customId.replace(prefix, '').split('_');
      category = parts[0];
      step = isFinish ? null : parseInt(parts[parts.length - 1]);
      itemName = isFinish ? parts.slice(1).join('_') : parts.slice(1, -1).join('_');
    }
    
    const inventory = await loadInventory();
    const { infoTimeout, selectTimeout } = getTimeoutSettings(inventory);
    
    if (isFinish) {
      const recipe = inventory.crafting.recipes?.[category]?.[itemName] || [];
      const recipeText = recipe
        .map(m => `${getItemIcon(m.name, inventory)} ${m.name} x${m.quantity}`)
        .join('\n');
      
      await interaction.update({
        content: `✅ ${itemName}\n레시피 ${isEdit ? '수정' : '추가'} 완료!\n\n**${isEdit ? '새 ' : ''}레시피:**\n${recipeText}\n\n_이 메시지는 ${infoTimeout / 1000}초 후 자동 삭제됩니다_`,
        components: []
      });
      
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {}
      }, infoTimeout);
      return;
    }
    
    // 다음 재료 선택
    if (!inventory.categories?.[category]) {
      return await interaction.update({
        content: `❌ "${category}" 카테고리를 찾을 수 없습니다.`,
        components: []
      });
    }
    
    const materials = Object.keys(inventory.categories[category]);
    const page = 0; // 첫 페이지
    const itemsPerPage = 25;
    const totalPages = Math.ceil(materials.length / itemsPerPage);
    const startIndex = page * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, materials.length);
    const pageMaterials = materials.slice(startIndex, endIndex);
    
    const materialOptions = pageMaterials.map(mat => ({
      label: mat,
      value: mat,
      emoji: validateEmoji(getItemIcon(mat, inventory))
    }));
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_recipe_material${isEdit ? '_edit' : ''}_${category}_${itemName}_${step}`)
      .setPlaceholder(`재료 ${step}을 선택하세요`)
      .addOptions(materialOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼 추가 (25개 초과 시)
    if (totalPages > 1) {
      const pageButtons = [];
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_prev_recipe_material${isEdit ? '_edit' : ''}_${category}_${itemName}_${step}_${page}`)
          .setLabel('◀ 이전')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0)
      );
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_info_recipe_material${isEdit ? '_edit' : ''}_${category}_${itemName}_${step}_${page}`)
          .setLabel(`페이지 ${page + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_next_recipe_material${isEdit ? '_edit' : ''}_${category}_${itemName}_${step}_${page}`)
          .setLabel('다음 ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1)
      );
      
      rows.push(new ActionRowBuilder().addComponents(pageButtons));
    }
    
    const currentRecipe = inventory.crafting?.recipes?.[category]?.[itemName] || [];
    const recipeText = currentRecipe.length > 0
      ? currentRecipe.map(m => `${getItemIcon(m.name, inventory)} ${m.name} x${m.quantity}`).join('\n')
      : '없음';
    
    await interaction.update({
      content: `${isEdit ? '✏️' : '📝'} ${itemName}\n레시피 ${isEdit ? '수정' : '추가'}\n\n**현재 레시피:**\n${recipeText}\n\n**${step}단계:** ${step}번째 재료를 선택하세요${totalPages > 1 ? ` (${materials.length}개 중 ${startIndex + 1}-${endIndex}번째)` : ''}\n\n_이 메시지는 ${selectTimeout / 1000}초 후 자동 삭제됩니다_`,
      components: rows
    });
    
    // 설정된 시간 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {
        // 이미 삭제되었거나 삭제할 수 없는 경우 무시
      }
    }, selectTimeout);
    
  } catch (error) {
    console.error('❌ 레시피 버튼 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 레시피 버튼 에러 응답 실패:', err);
    });
  }
}

/**
 * 레시피 추가 더하기/완료 버튼 핸들러 (독립 실행)
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeStandaloneMoreFinishButton(interaction) {
  try {
    const isFinish = interaction.customId.startsWith('finish_recipe_standalone_');
    const prefix = isFinish ? 'finish_recipe_standalone_' : 'add_more_recipe_standalone_';
    const parts = interaction.customId.replace(prefix, '').split('_');
    const category = parts[0];
    const step = isFinish ? null : parseInt(parts[parts.length - 1]);
    const itemName = isFinish ? parts.slice(1).join('_') : parts.slice(1, -1).join('_');
    
    const inventory = await loadInventory();
    const { infoTimeout, selectTimeout } = getTimeoutSettings(inventory);
    
    if (isFinish) {
      const recipe = inventory.crafting.recipes?.[category]?.[itemName] || [];
      const recipeText = recipe
        .map(m => `${getItemIcon(m.name, inventory)} ${m.name} x${m.quantity}`)
        .join('\n');
      
      await interaction.update({
        content: `✅ ${itemName}\n레시피 추가 완료!\n\n**레시피:**\n${recipeText}\n\n_이 메시지는 ${infoTimeout / 1000}초 후 자동 삭제됩니다_`,
        components: []
      });
      
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {}
      }, infoTimeout);
      return;
    }
    
    // 다음 재료 선택
    if (!inventory.categories?.[category]) {
      return await interaction.update({
        content: `❌ "${category}" 카테고리를 찾을 수 없습니다.`,
        components: []
      });
    }
    
    const materials = Object.keys(inventory.categories[category]);
    const page = 0;
    const itemsPerPage = 25;
    const totalPages = Math.ceil(materials.length / itemsPerPage);
    const startIndex = page * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, materials.length);
    const pageMaterials = materials.slice(startIndex, endIndex);
    
    const materialOptions = pageMaterials.map(mat => ({
      label: mat,
      value: mat,
      emoji: validateEmoji(getItemIcon(mat, inventory))
    }));
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_recipe_material_standalone_${category}_${itemName}_${step}`)
      .setPlaceholder(`재료 ${step}을 선택하세요`)
      .addOptions(materialOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼 추가 (25개 초과 시)
    if (totalPages > 1) {
      const pageButtons = [];
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_prev_recipe_material_standalone_${category}_${itemName}_${step}_${page}`)
          .setLabel('◀ 이전')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0)
      );
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_info_recipe_material_standalone_${category}_${itemName}_${step}_${page}`)
          .setLabel(`페이지 ${page + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_next_recipe_material_standalone_${category}_${itemName}_${step}_${page}`)
          .setLabel('다음 ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1)
      );
      
      rows.push(new ActionRowBuilder().addComponents(pageButtons));
    }
    
    const currentRecipe = inventory.crafting?.recipes?.[category]?.[itemName] || [];
    const recipeText = currentRecipe.length > 0
      ? currentRecipe.map(m => `${getItemIcon(m.name, inventory)} ${m.name} x${m.quantity}`).join('\n')
      : '없음';
    
    await interaction.update({
      content: `📝 ${itemName}\n레시피 추가\n\n**현재 레시피:**\n${recipeText}\n\n**${step}단계:** ${step}번째 재료를 선택하세요${totalPages > 1 ? ` (${materials.length}개 중 ${startIndex + 1}-${endIndex}번째)` : ''}\n\n_이 메시지는 ${selectTimeout / 1000}초 후 자동 삭제됩니다_`,
      components: rows
    });
    
    // 설정된 시간 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {
        // 이미 삭제되었거나 삭제할 수 없는 경우 무시
      }
    }, selectTimeout);
    
  } catch (error) {
    console.error('❌ 레시피 추가 버튼 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 레시피 추가 버튼 에러 응답 실패:', err);
    });
  }
}
