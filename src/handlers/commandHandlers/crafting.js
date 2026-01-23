// 제작 관련 커맨드 핸들러

import { EmbedBuilder } from 'discord.js';
import { createCraftingEmbed, createButtons } from '../../embeds.js';
import { loadInventory, saveInventory } from '../../database-old.js';
import { getItemIcon, addHistory, sendTemporaryReply } from '../../utils.js';

/**
 * /제작 커맨드 처리
 * @param {Interaction} interaction - Discord 인터랙션
 * @param {Map} activeMessages - 활성 메시지 맵
 */
export async function handleCraftingCommand(interaction, activeMessages) {
  const category = interaction.options.getString('카테고리');
  
  // 먼저 응답 (3초 제한 회피)
  await interaction.deferReply();
  
  try {
    const inventory = await loadInventory();
    const crafting = inventory.crafting || { categories: {}, crafting: {} };
    const uiMode = inventory.settings?.uiMode || 'normal';
    const barLength = inventory.settings?.barLength || 15;
    
    // 페이지 계산
    const items = Object.entries(crafting.categories[category] || {});
    const totalPages = Math.ceil(items.length / 25);
    
    const embed = createCraftingEmbed(crafting, category, uiMode, barLength, 0);
    const buttons = createButtons(category, true, 'crafting', uiMode, barLength, inventory, interaction.user.id, 0, totalPages);
    const reply = await interaction.editReply({ embeds: [embed], components: buttons, fetchReply: true });
    
    // 활성 메시지로 등록 (변경 감지용)
    const messageId = reply.id;
    activeMessages.set(messageId, {
      interaction,
      category,
      type: 'crafting'
    });
    
    console.log(`📌 활성 메시지 등록: ${messageId} (제작 - ${category})`);
  } catch (error) {
    console.error('❌ 제작 표시 에러:', error);
    await interaction.editReply({ 
      content: `❌ 제작 현황을 표시하는 중 오류가 발생했습니다.\n${error.message}`,
      embeds: [],
      components: []
    }).catch((err) => {
      console.error('❌ 제작 표시 에러 응답 실패:', err);
    });
  }
}

/**
 * /제작품목추가 커맨드 처리
 */
export async function handleCraftingAddCommand(interaction) {
  const category = interaction.options.getString('카테고리');
  const itemName = interaction.options.getString('제작품');
  const requiredQuantity = interaction.options.getInteger('목표수량');
  const initialQuantity = interaction.options.getInteger('초기수량');
  const emoji = interaction.options.getString('이모지');
  
  // 레시피 정보
  const material1 = interaction.options.getString('재료1');
  const material1Qty = interaction.options.getInteger('재료1수량');
  const material2 = interaction.options.getString('재료2');
  const material2Qty = interaction.options.getInteger('재료2수량');
  const material3 = interaction.options.getString('재료3');
  const material3Qty = interaction.options.getInteger('재료3수량');

  const inventory = await loadInventory();
  
  if (!inventory.crafting) {
    inventory.crafting = { categories: {}, crafting: {}, recipes: {} };
  }
  if (!inventory.crafting.categories[category]) {
    inventory.crafting.categories[category] = {};
  }
  if (!inventory.crafting.recipes) {
    inventory.crafting.recipes = {};
  }
  if (!inventory.crafting.recipes[category]) {
    inventory.crafting.recipes[category] = {};
  }
  
  if (inventory.crafting.categories[category][itemName]) {
    return sendTemporaryReply(interaction, `❌ "${itemName}" 제작품이 이미 존재합니다.`);
  }

  // 재료가 같은 카테고리에 존재하는지 확인
  if (!inventory.categories[category]) {
    return sendTemporaryReply(interaction, `❌ "${category}" 카테고리에 재료가 없습니다. 먼저 재고 목록에 재료를 추가해주세요.`);
  }

  const materials = [];
  
  // 재료1 확인
  if (!inventory.categories[category][material1]) {
    return sendTemporaryReply(interaction, `❌ "${material1}" 재료를 "${category}" 카테고리에서 찾을 수 없습니다. 먼저 재고 목록에 추가해주세요.`);
  }
  materials.push({ name: material1, quantity: material1Qty, category: category });

  // 재료2 확인 (선택사항)
  if (material2 && material2Qty) {
    if (!inventory.categories[category][material2]) {
      return sendTemporaryReply(interaction, `❌ "${material2}" 재료를 "${category}" 카테고리에서 찾을 수 없습니다. 먼저 재고 목록에 추가해주세요.`);
    }
    materials.push({ name: material2, quantity: material2Qty, category: category });
  }

  // 재료3 확인 (선택사항)
  if (material3 && material3Qty) {
    if (!inventory.categories[category][material3]) {
      return sendTemporaryReply(interaction, `❌ "${material3}" 재료를 "${category}" 카테고리에서 찾을 수 없습니다. 먼저 재고 목록에 추가해주세요.`);
    }
    materials.push({ name: material3, quantity: material3Qty, category: category });
  }

  // 제작품 추가
  inventory.crafting.categories[category][itemName] = {
    quantity: initialQuantity,
    required: requiredQuantity
  };
  
  if (emoji) {
    inventory.crafting.categories[category][itemName].emoji = emoji;
  }
  
  // 레시피 저장
  inventory.crafting.recipes[category][itemName] = materials;
  
  // 수정 내역 추가
  addHistory(inventory, 'crafting', category, itemName, 'add', 
    `초기: ${initialQuantity}개, 목표: ${requiredQuantity}개, 레시피: ${materials.map(m => `${m.name} x${m.quantity}`).join(', ')}`, 
    interaction.user.displayName || interaction.user.username);
  
  await saveInventory(inventory);

  // 레시피 표시
  const recipeText = materials.map(m => {
    const icon = getItemIcon(m.name, inventory);
    return `${icon} **${m.name}** x${m.quantity}개`;
  }).join('\n');

  const icon = emoji || getItemIcon(itemName, inventory);
  const successEmbed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('✅ 제작 목록 추가 완료')
    .setDescription(`**카테고리:** ${category}\n${icon} **${itemName}**이(가) 제작 목록에 추가되었습니다!\n\n**초기 수량:** ${initialQuantity}개\n**목표 수량:** ${requiredQuantity}개\n\n**레시피 (1개 제작 시):**\n${recipeText}`);
  
  await sendTemporaryReply(interaction, { embeds: [successEmbed] });
}

/**
 * /제작품목제거 커맨드 처리
 */
export async function handleCraftingRemoveCommand(interaction) {
  const category = interaction.options.getString('카테고리');
  const itemName = interaction.options.getString('제작품');

  const inventory = await loadInventory();
  
  if (!inventory.crafting?.categories[category] || !inventory.crafting.categories[category][itemName]) {
    return sendTemporaryReply(interaction, `❌ "${itemName}" 제작품을 찾을 수 없습니다.`);
  }

  const itemData = inventory.crafting.categories[category][itemName];
  delete inventory.crafting.categories[category][itemName];
  
  // 수정 내역 추가
  addHistory(inventory, 'crafting', category, itemName, 'remove', 
    `수량: ${itemData.quantity}/${itemData.required}`, 
    interaction.user.displayName || interaction.user.username);
  
  await saveInventory(inventory);

  const successEmbed = new EmbedBuilder()
    .setColor(0xED4245)
    .setDescription(`### ✅ 제작 목록 제거 완료\n**카테고리:** ${category}\n**${itemName}**이(가) 제작 목록에서 제거되었습니다.`);
  
  await sendTemporaryReply(interaction, { embeds: [successEmbed] });
}
