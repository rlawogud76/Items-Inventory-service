// ?˜ì´ì§€?¤ì´???¸ë“¤??
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { loadInventory } from '../../database.js';
import { createCraftingEmbed, createInventoryEmbed, createButtons } from '../../embeds.js';
import { getItemIcon, getTimeoutSettings } from '../../utils.js';

/**
 * ?´ëª¨ì§€ ê²€ì¦??¨ìˆ˜ - Select Menu??? ë‹ˆì½”ë“œ ?´ëª¨ì§€ë§??ˆìš©
 * @param {string} emoji - ê²€ì¦í•  ?´ëª¨ì§€
 * @returns {string} - ? íš¨???´ëª¨ì§€ ?ëŠ” ê¸°ë³¸ ?´ëª¨ì§€
 */
function validateEmoji(emoji) {
  if (!emoji) return '?“¦';
  // ì»¤ìŠ¤?€ Discord ?´ëª¨ì§€ ?•ì‹(<:name:id> ?ëŠ” <a:name:id>)?´ê±°???˜ëª»???•ì‹?´ë©´ ê¸°ë³¸ ?´ëª¨ì§€ ?¬ìš©
  if (emoji.startsWith('<') || emoji.length > 10) {
    return '?“¦';
  }
  return emoji;
}

export async function handlePageNavigation(interaction) {
  try {
    // customId ?•ì‹: page_prev_embed_inventory_?´ì–‘_0 ?ëŠ” page_next_embed_crafting_ì±„ê´‘_2
    const parts = interaction.customId.split('_');
    const direction = parts[1]; // 'prev' or 'next'
    // parts[2]??'embed'
    const type = parts[3]; // 'inventory' or 'crafting'
    const currentPage = parseInt(parts[parts.length - 1]);
    const category = parts.slice(4, -1).join('_');
    
    const newPage = direction === 'prev' ? currentPage - 1 : currentPage + 1;
    
    const inventory = await loadInventory();
    const uiMode = inventory.settings?.uiMode || 'normal';
    const barLength = inventory.settings?.barLength || 15;
    
    let embed, items, totalPages;
    
    if (type === 'crafting') {
      const crafting = inventory.crafting || { categories: {}, crafting: {} };
      items = Object.entries(crafting.categories[category] || {});
      totalPages = Math.ceil(items.length / 25);
      embed = createCraftingEmbed(crafting, category, uiMode, barLength, newPage, inventory);
    } else {
      items = Object.entries(inventory.categories[category] || {});
      totalPages = Math.ceil(items.length / 25);
      embed = createInventoryEmbed(inventory, category, uiMode, barLength, newPage);
    }
    
    const buttons = createButtons(category, true, type, uiMode, barLength, inventory, interaction.user.id, newPage, totalPages);
    
    await interaction.update({ embeds: [embed], components: buttons });
    
    // ?œì„± ë©”ì‹œì§€???˜ì´ì§€ ë²ˆí˜¸ ?…ë°?´íŠ¸
    const messageId = interaction.message.id;
    const messageData = global.activeMessages?.get(messageId);
    if (messageData) {
      messageData.page = newPage;
      messageData.timestamp = Date.now(); // ?€?„ìŠ¤?¬í”„??ê°±ì‹ 
      global.activeMessages.set(messageId, messageData);
      console.log(`?“„ ?„ë² ???˜ì´ì§€ ?´ë™: ${currentPage + 1} ??${newPage + 1} (ë©”ì‹œì§€ ${messageId} ?˜ì´ì§€ ?íƒœ ?€??`);
    } else {
      console.log(`?“„ ?„ë² ???˜ì´ì§€ ?´ë™: ${currentPage + 1} ??${newPage + 1}`);
    }
  } catch (error) {
    console.error('???˜ì´ì§€ ?´ë™ ?ëŸ¬:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '?˜ì´ì§€ ?´ë™ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.', flags: 64 }).catch((err) => {
        console.error('???˜ì´ì§€ ?´ë™ ?ëŸ¬ ?‘ë‹µ ?¤íŒ¨:', err);
      });
    }
  }
}

/**
 * ?˜ì´ì§€ ?í”„ ë²„íŠ¼ ?¸ë“¤??(ëª¨ë‹¬ ?œì‹œ)
 * @param {Interaction} interaction - Discord ?¸í„°?™ì…˜
 */
export async function handlePageJump(interaction) {
  try {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
    
    // customId ?•ì‹: page_jump_embed_inventory_?´ì–‘_2_10 (?„ì¬?˜ì´ì§€_ì´í˜?´ì?)
    const parts = interaction.customId.split('_');
    const type = parts[3]; // 'inventory' or 'crafting'
    const totalPages = parseInt(parts[parts.length - 1]);
    const currentPage = parseInt(parts[parts.length - 2]);
    const category = parts.slice(4, -2).join('_');
    
    const inventory = await loadInventory();
    const { infoTimeout } = getTimeoutSettings(inventory);
    
    const modal = new ModalBuilder()
      .setCustomId(`page_jump_modal_${type}_${category}_${totalPages}`)
      .setTitle('?˜ì´ì§€ ?´ë™');
    
    const pageInput = new TextInputBuilder()
      .setCustomId('page_number')
      .setLabel(`?´ë™???˜ì´ì§€ (1-${totalPages})`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(`?„ì¬: ${currentPage + 1}?˜ì´ì§€`)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(String(totalPages).length);
    
    modal.addComponents(new ActionRowBuilder().addComponents(pageInput));
    
    await interaction.showModal(modal);
  } catch (error) {
    console.error('???˜ì´ì§€ ?í”„ ëª¨ë‹¬ ?ëŸ¬:', error);
    await interaction.reply({ content: '?˜ì´ì§€ ?´ë™ ëª¨ë‹¬???œì‹œ?˜ëŠ” ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.', ephemeral: true }).catch(() => {});
  }
}


/**
 * ?ˆì‹œ???¬ë£Œ ? íƒ ?˜ì´ì§€?¤ì´???¸ë“¤??
 * @param {Interaction} interaction - Discord ?¸í„°?™ì…˜
 */
export async function handleRecipeMaterialPageNavigation(interaction) {
  try {
    // customId ?•ì‹: page_prev_recipe_material_?´ì–‘_?„ì´?œëª…_2_0 ?ëŠ” page_next_recipe_material_edit_?´ì–‘_?„ì´?œëª…_2_0
    const parts = interaction.customId.split('_');
    const direction = parts[1]; // 'prev' or 'next'
    const isEdit = parts[4] === 'edit'; // parts[4]ê°€ 'edit'?¸ì? ?•ì¸ (parts[3]?€ ??ƒ 'material')
    
    let category, itemName, step, currentPage;
    
    if (isEdit) {
      // page_prev_recipe_material_edit_category_itemName_step_page
      category = parts[5];
      currentPage = parseInt(parts[parts.length - 1]);
      step = parseInt(parts[parts.length - 2]);
      itemName = parts.slice(6, -2).join('_');
    } else {
      // page_prev_recipe_material_category_itemName_step_page
      category = parts[4];
      currentPage = parseInt(parts[parts.length - 1]);
      step = parseInt(parts[parts.length - 2]);
      itemName = parts.slice(5, -2).join('_');
    }
    
    const newPage = direction === 'prev' ? currentPage - 1 : currentPage + 1;
    
    const inventory = await loadInventory();
    
    // ì¹´í…Œê³ ë¦¬ ì¡´ì¬ ?•ì¸
    if (!inventory.categories?.[category]) {
      return await interaction.update({
        content: `??"${category}" ì¹´í…Œê³ ë¦¬ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤.`,
        components: []
      });
    }
    
    const materials = Object.keys(inventory.categories[category]);
    const itemsPerPage = 25;
    const totalPages = Math.ceil(materials.length / itemsPerPage);
    const startIndex = newPage * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, materials.length);
    const pageMaterials = materials.slice(startIndex, endIndex);
    
    const materialOptions = pageMaterials.map(mat => ({
      label: mat,
      value: mat,
      emoji: validateEmoji(getItemIcon(mat, inventory))
    }));
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_recipe_material${isEdit ? '_edit' : ''}_${category}_${itemName}_${step}`)
      .setPlaceholder(`?¬ë£Œ ${step}??? íƒ?˜ì„¸??)
      .addOptions(materialOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // ?˜ì´ì§€?¤ì´??ë²„íŠ¼
    const pageButtons = [];
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_prev_recipe_material${isEdit ? '_edit' : ''}_${category}_${itemName}_${step}_${newPage}`)
        .setLabel('?€ ?´ì „')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage === 0)
    );
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_info_recipe_material${isEdit ? '_edit' : ''}_${category}_${itemName}_${step}_${newPage}`)
        .setLabel(`?˜ì´ì§€ ${newPage + 1}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_next_recipe_material${isEdit ? '_edit' : ''}_${category}_${itemName}_${step}_${newPage}`)
        .setLabel('?¤ìŒ ??)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage >= totalPages - 1)
    );
    
    rows.push(new ActionRowBuilder().addComponents(pageButtons));
    
    const currentRecipe = inventory.crafting?.recipes?.[category]?.[itemName] || [];
    const recipeText = currentRecipe.length > 0
      ? currentRecipe.map(m => `${getItemIcon(m.name, inventory)} ${m.name} x${m.quantity}`).join('\n')
      : '?†ìŒ';
    
    await interaction.update({
      content: `${isEdit ? '?ï¸' : '?“'} ${itemName}\n?ˆì‹œ??${isEdit ? '?˜ì •' : 'ì¶”ê?'}\n\n**?„ì¬ ?ˆì‹œ??**\n${recipeText}\n\n**${step}?¨ê³„:** ${step}ë²ˆì§¸ ?¬ë£Œë¥?? íƒ?˜ì„¸??(${materials.length}ê°?ì¤?${startIndex + 1}-${endIndex}ë²ˆì§¸)`,
      components: rows
    });
    
    console.log(`?“„ ?ˆì‹œ???¬ë£Œ ?˜ì´ì§€ ?´ë™: ${currentPage + 1} ??${newPage + 1}`);
  } catch (error) {
    console.error('???ˆì‹œ???¬ë£Œ ?˜ì´ì§€ ?´ë™ ?ëŸ¬:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '?˜ì´ì§€ ?´ë™ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.', ephemeral: true }).catch((err) => {
        console.error('???ˆì‹œ???¬ë£Œ ?˜ì´ì§€ ?´ë™ ?ëŸ¬ ?‘ë‹µ ?¤íŒ¨:', err);
      });
    }
  }
}


/**
 * ?ˆì‹œ??ì¶”ê? ?¬ë£Œ ? íƒ ?˜ì´ì§€?¤ì´???¸ë“¤??(?…ë¦½ ?¤í–‰)
 * @param {Interaction} interaction - Discord ?¸í„°?™ì…˜
 */
export async function handleRecipeMaterialStandalonePageNavigation(interaction) {
  try {
    // customId ?•ì‹: page_prev_recipe_material_standalone_?´ì–‘_?„ì´?œëª…_2_0
    const parts = interaction.customId.split('_');
    const direction = parts[1]; // 'prev' or 'next'
    
    // parts[4] = 'standalone'?´ë?ë¡??¤ì œ ì¹´í…Œê³ ë¦¬??parts[5]ë¶€??
    const category = parts[5];
    const currentPage = parseInt(parts[parts.length - 1]);
    const step = parseInt(parts[parts.length - 2]);
    const itemName = parts.slice(6, -2).join('_');
    
    const newPage = direction === 'prev' ? currentPage - 1 : currentPage + 1;
    
    const inventory = await loadInventory();
    
    // ì¹´í…Œê³ ë¦¬ ì¡´ì¬ ?•ì¸
    if (!inventory.categories?.[category]) {
      return await interaction.update({
        content: `??"${category}" ì¹´í…Œê³ ë¦¬ë¥?ì°¾ì„ ???†ìŠµ?ˆë‹¤.`,
        components: []
      });
    }
    
    const materials = Object.keys(inventory.categories[category]);
    const itemsPerPage = 25;
    const totalPages = Math.ceil(materials.length / itemsPerPage);
    const startIndex = newPage * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, materials.length);
    const pageMaterials = materials.slice(startIndex, endIndex);
    
    const materialOptions = pageMaterials.map(mat => ({
      label: mat,
      value: mat,
      emoji: validateEmoji(getItemIcon(mat, inventory))
    }));
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_recipe_material_standalone_${category}_${itemName}_${step}`)
      .setPlaceholder(`?¬ë£Œ ${step}??? íƒ?˜ì„¸??)
      .addOptions(materialOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // ?˜ì´ì§€?¤ì´??ë²„íŠ¼
    const pageButtons = [];
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_prev_recipe_material_standalone_${category}_${itemName}_${step}_${newPage}`)
        .setLabel('?€ ?´ì „')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage === 0)
    );
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_info_recipe_material_standalone_${category}_${itemName}_${step}_${newPage}`)
        .setLabel(`?˜ì´ì§€ ${newPage + 1}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_next_recipe_material_standalone_${category}_${itemName}_${step}_${newPage}`)
        .setLabel('?¤ìŒ ??)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage >= totalPages - 1)
    );
    
    rows.push(new ActionRowBuilder().addComponents(pageButtons));
    
    const currentRecipe = inventory.crafting?.recipes?.[category]?.[itemName] || [];
    const recipeText = currentRecipe
      .map(m => `${getItemIcon(m.name, inventory)} ${m.name} x${m.quantity}`)
      .join('\n');
    
    await interaction.update({
      content: `?“ ${itemName}\n?ˆì‹œ??ì¶”ê?\n\n**?„ì¬ ?ˆì‹œ??**\n${recipeText || '?†ìŒ'}\n\n**${step}?¨ê³„:** ${step}ë²ˆì§¸ ?¬ë£Œë¥?? íƒ?˜ì„¸??(${materials.length}ê°?ì¤?${startIndex + 1}-${endIndex}ë²ˆì§¸)`,
      components: rows
    });
    
    console.log(`?“„ ?ˆì‹œ??ì¶”ê? ?¬ë£Œ ?˜ì´ì§€ ?´ë™: ${currentPage + 1} ??${newPage + 1}`);
  } catch (error) {
    console.error('???ˆì‹œ??ì¶”ê? ?¬ë£Œ ?˜ì´ì§€ ?´ë™ ?ëŸ¬:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '?˜ì´ì§€ ?´ë™ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.', ephemeral: true }).catch((err) => {
        console.error('???ˆì‹œ??ì¶”ê? ?¬ë£Œ ?˜ì´ì§€ ?´ë™ ?ëŸ¬ ?‘ë‹µ ?¤íŒ¨:', err);
      });
    }
  }
}

/**
 * ?ˆì‹œ??ì¶”ê? ?œì‘??? íƒ ?˜ì´ì§€?¤ì´???¸ë“¤??
 * @param {Interaction} interaction - Discord ?¸í„°?™ì…˜
 */
export async function handleRecipeAddPageNavigation(interaction) {
  try {
    // customId ?•ì‹: page_prev_recipe_add_?´ì–‘_0
    const parts = interaction.customId.split('_');
    const direction = parts[1]; // 'prev' or 'next'
    const category = parts[3];
    const currentPage = parseInt(parts[parts.length - 1]);
    
    const newPage = direction === 'prev' ? currentPage - 1 : currentPage + 1;
    
    const inventory = await loadInventory();
    const items = Object.keys(inventory.crafting?.categories?.[category] || {});
    const itemsPerPage = 25;
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const startIndex = newPage * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, items.length);
    const pageItems = items.slice(startIndex, endIndex);
    
    const itemOptions = pageItems.map(item => ({
      label: item,
      value: item,
      emoji: validateEmoji(getItemIcon(item, inventory))
    }));
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_recipe_add_${category}`)
      .setPlaceholder('?ˆì‹œ?¼ë? ì¶”ê????œì‘?ˆì„ ? íƒ?˜ì„¸??)
      .addOptions(itemOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // ?˜ì´ì§€?¤ì´??ë²„íŠ¼
    const pageButtons = [];
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_prev_recipe_add_${category}_${newPage}`)
        .setLabel('?€ ?´ì „')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage === 0)
    );
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_info_recipe_add_${category}_${newPage}`)
        .setLabel(`?˜ì´ì§€ ${newPage + 1}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_next_recipe_add_${category}_${newPage}`)
        .setLabel('?¤ìŒ ??)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage >= totalPages - 1)
    );
    
    rows.push(new ActionRowBuilder().addComponents(pageButtons));
    
    await interaction.update({
      content: `??**${category}** ì¹´í…Œê³ ë¦¬?ì„œ ?ˆì‹œ?¼ë? ì¶”ê????œì‘?ˆì„ ? íƒ?˜ì„¸??(${items.length}ê°?ì¤?${startIndex + 1}-${endIndex}ë²ˆì§¸):`,
      components: rows
    });
    
    console.log(`?“„ ?ˆì‹œ??ì¶”ê? ?œì‘???˜ì´ì§€ ?´ë™: ${currentPage + 1} ??${newPage + 1}`);
  } catch (error) {
    console.error('???ˆì‹œ??ì¶”ê? ?œì‘???˜ì´ì§€ ?´ë™ ?ëŸ¬:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '?˜ì´ì§€ ?´ë™ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.', ephemeral: true }).catch((err) => {
        console.error('???ˆì‹œ??ì¶”ê? ?œì‘???˜ì´ì§€ ?´ë™ ?ëŸ¬ ?‘ë‹µ ?¤íŒ¨:', err);
      });
    }
  }
}


/**
 * ?˜ì´ì§€ ?í”„ ëª¨ë‹¬ ?œì¶œ ?¸ë“¤??
 * @param {Interaction} interaction - Discord ?¸í„°?™ì…˜
 */
export async function handlePageJumpModal(interaction) {
  try {
    // customId ?•ì‹: page_jump_modal_inventory_?´ì–‘_10 (ì´í˜?´ì?)
    const parts = interaction.customId.split('_');
    const type = parts[3]; // 'inventory' or 'crafting'
    const totalPages = parseInt(parts[parts.length - 1]);
    const category = parts.slice(4, -1).join('_');
    
    const pageInput = interaction.fields.getTextInputValue('page_number').trim();
    const targetPage = parseInt(pageInput);
    
    const inventory = await loadInventory();
    const { infoTimeout } = getTimeoutSettings(inventory);
    
    // ?˜ì´ì§€ ë²ˆí˜¸ ê²€ì¦?
    if (isNaN(targetPage) || targetPage < 1 || targetPage > totalPages) {
      return await interaction.reply({
        content: `???˜ëª»???˜ì´ì§€ ë²ˆí˜¸?…ë‹ˆ?? 1ë¶€??${totalPages}ê¹Œì? ?…ë ¥?´ì£¼?¸ìš”.\n\n_??ë©”ì‹œì§€??${infoTimeout / 1000}ì´????ë™ ?? œ?©ë‹ˆ??`,
        ephemeral: true
      }).then(() => {
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {}
        }, infoTimeout);
      });
    }
    
    const newPage = targetPage - 1; // 0-based index
    
    const uiMode = inventory.settings?.uiMode || 'normal';
    const barLength = inventory.settings?.barLength || 15;
    
    let embed;
    
    if (type === 'crafting') {
      const crafting = inventory.crafting || { categories: {}, crafting: {} };
      embed = createCraftingEmbed(crafting, category, uiMode, barLength, newPage, inventory);
    } else {
      embed = createInventoryEmbed(inventory, category, uiMode, barLength, newPage);
    }
    
    const buttons = createButtons(category, true, type, uiMode, barLength, inventory, interaction.user.id, newPage, totalPages);
    
    await interaction.update({ embeds: [embed], components: buttons });
    
    // ?œì„± ë©”ì‹œì§€???˜ì´ì§€ ë²ˆí˜¸ ?…ë°?´íŠ¸
    const messageId = interaction.message.id;
    const messageData = global.activeMessages?.get(messageId);
    if (messageData) {
      messageData.page = newPage;
      messageData.timestamp = Date.now();
      global.activeMessages.set(messageId, messageData);
      console.log(`?”¢ ?˜ì´ì§€ ?í”„: ${targetPage}?˜ì´ì§€ë¡??´ë™ (ë©”ì‹œì§€ ${messageId} ?˜ì´ì§€ ?íƒœ ?€??`);
    } else {
      console.log(`?”¢ ?˜ì´ì§€ ?í”„: ${targetPage}?˜ì´ì§€ë¡??´ë™`);
    }
  } catch (error) {
    console.error('???˜ì´ì§€ ?í”„ ëª¨ë‹¬ ?œì¶œ ?ëŸ¬:', error);
    await interaction.reply({ content: '?˜ì´ì§€ ?´ë™ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.', ephemeral: true }).catch(() => {});
  }
}


/**
 * ë²”ìš© ?˜ì´ì§€ ?í”„ ë²„íŠ¼ ?¸ë“¤??
 * @param {Interaction} interaction - Discord ?¸í„°?™ì…˜
 */
export async function handleGenericPageJump(interaction) {
  try {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
    
    // customId ?•ì‹: page_quantity_jump_inventory_?´ì–‘_2_10 (?„ì¬?˜ì´ì§€_ì´í˜?´ì?)
    const parts = interaction.customId.split('_');
    const totalPages = parseInt(parts[parts.length - 1]);
    const currentPage = parseInt(parts[parts.length - 2]);
    
    // jump ?´ì „ê¹Œì?ê°€ baseId, jump ?´í›„ ë§ˆì?ë§?2ê°??œì™¸ê°€ suffix
    const jumpIndex = parts.indexOf('jump');
    const baseId = parts.slice(0, jumpIndex).join('_'); // 'page_quantity'
    const suffix = parts.slice(jumpIndex + 1, -2).join('_'); // 'inventory_?´ì–‘'
    
    // ëª¨ë‹¬ customId??baseId?€ suffixë¥?ëª¨ë‘ ?¬í•¨
    const modal = new ModalBuilder()
      .setCustomId(`generic_page_jump_modal_${baseId}_${suffix}_${totalPages}`)
      .setTitle('?˜ì´ì§€ ?´ë™');
    
    const pageInput = new TextInputBuilder()
      .setCustomId('page_number')
      .setLabel(`?´ë™???˜ì´ì§€ (1-${totalPages})`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(`?„ì¬: ${currentPage + 1}?˜ì´ì§€`)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(String(totalPages).length);
    
    const row = new ActionRowBuilder().addComponents(pageInput);
    modal.addComponents(row);
    
    await interaction.showModal(modal);
  } catch (error) {
    console.error('??ë²”ìš© ?˜ì´ì§€ ?í”„ ëª¨ë‹¬ ?ëŸ¬:', error);
    await interaction.reply({ content: '?˜ì´ì§€ ?´ë™ ëª¨ë‹¬???œì‹œ?˜ëŠ” ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.', ephemeral: true }).catch(() => {});
  }
}

/**
 * ë²”ìš© ?˜ì´ì§€ ?í”„ ëª¨ë‹¬ ?œì¶œ ?¸ë“¤??
 * @param {Interaction} interaction - Discord ?¸í„°?™ì…˜
 */
export async function handleGenericPageJumpModal(interaction) {
  try {
    // customId ?•ì‹: generic_page_jump_modal_page_quantity_inventory_?´ì–‘_10
    // parts: ['generic', 'page', 'jump', 'modal', 'page', 'quantity', 'inventory', '?´ì–‘', '10']
    const parts = interaction.customId.split('_');
    const totalPages = parseInt(parts[parts.length - 1]);
    
    // 'generic_page_jump_modal_' ?œê±° (4ê°??”ì†Œ)
    // ?¨ì? ê²? ['page', 'quantity', 'inventory', '?´ì–‘', '10']
    const remainingParts = parts.slice(4);
    
    // ë§ˆì?ë§?totalPages) ?œì™¸: ['page', 'quantity', 'inventory', '?´ì–‘']
    const dataParts = remainingParts.slice(0, -1);
    
    // baseId??ì²˜ìŒ 2ê°? 'page_quantity'
    const baseId = dataParts.slice(0, 2).join('_');
    
    // suffix???˜ë¨¸ì§€: 'inventory_?´ì–‘'
    const suffix = dataParts.slice(2).join('_');
    
    const pageInput = interaction.fields.getTextInputValue('page_number').trim();
    const targetPage = parseInt(pageInput);
    
    const inventory = await loadInventory();
    const { infoTimeout } = getTimeoutSettings(inventory);
    
    // ?˜ì´ì§€ ë²ˆí˜¸ ê²€ì¦?
    if (isNaN(targetPage) || targetPage < 1 || targetPage > totalPages) {
      return await interaction.reply({
        content: `???˜ëª»???˜ì´ì§€ ë²ˆí˜¸?…ë‹ˆ?? 1ë¶€??${totalPages}ê¹Œì? ?…ë ¥?´ì£¼?¸ìš”.\n\n_??ë©”ì‹œì§€??${infoTimeout / 1000}ì´????ë™ ?? œ?©ë‹ˆ??`,
        ephemeral: true
      }).then(() => {
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {}
        }, infoTimeout);
      });
    }
    
    const newPage = targetPage - 1; // 0-based index
    
    // ?ë˜ ?¸ë“¤?¬ë¡œ ë¦¬ë‹¤?´ë ‰??(?˜ì´ì§€ ë²ˆí˜¸ë§?ë³€ê²?
    // ?? page_quantity_inventory_?´ì–‘ -> page_quantity_next_inventory_?´ì–‘_newPage
    const redirectCustomId = `${baseId}_next_${suffix}_${newPage}`;
    
    console.log(`?”¢ ë²”ìš© ?˜ì´ì§€ ?í”„ ?”ë²„ê·?
  - original customId: ${interaction.customId}
  - baseId: ${baseId}
  - suffix: ${suffix}
  - redirectCustomId: ${redirectCustomId}`);
    
    // customId ë³€ê²½í•˜???ë˜ ?¸ë“¤???¸ì¶œ
    const modifiedInteraction = {
      ...interaction,
      customId: redirectCustomId,
      replied: false,
      deferred: false
    };
    
    // baseIdë¡??¸ë“¤??ê²°ì •
    if (baseId === 'page_quantity') {
      const { handleQuantityPageButton } = await import('./quantity.js');
      await handleQuantityPageButton(modifiedInteraction);
    } else if (baseId === 'page_prev' || baseId === 'page_next') {
      // suffix??ì²?ë¶€ë¶„ìœ¼ë¡??¡ì…˜ ?€??ê²°ì •
      const actionType = suffix.split('_')[0];
      
      if (actionType === 'remove') {
        const { handleManageRemovePageButton } = await import('./manage.js');
        await handleManageRemovePageButton(modifiedInteraction);
      } else if (actionType === 'edit') {
        const { handleManageEditPageButton } = await import('./manage.js');
        await handleManageEditPageButton(modifiedInteraction);
      } else if (actionType === 'type') {
        const { handleManageTypePageButton } = await import('./manage.js');
        await handleManageTypePageButton(modifiedInteraction);
      } else if (actionType === 'reorder') {
        if (suffix.includes('_second_')) {
          const { handleManageReorderSecondPageButton } = await import('./manage.js');
          await handleManageReorderSecondPageButton(modifiedInteraction);
        } else {
          const { handleManageReorderPageButton } = await import('./manage.js');
          await handleManageReorderPageButton(modifiedInteraction);
        }
      } else if (actionType === 'reset') {
        const { handleResetPageButton } = await import('./reset.js');
        await handleResetPageButton(modifiedInteraction);
      } else if (actionType === 'collecting' || actionType === 'crafting') {
        const { handleWorkPageButton } = await import('./work.js');
        await handleWorkPageButton(modifiedInteraction);
      } else if (actionType === 'recipe') {
        // recipe_material, recipe_add, recipe_edit ??
        if (suffix.includes('_material_')) {
          if (suffix.includes('_standalone_')) {
            await handleRecipeMaterialStandalonePageNavigation(modifiedInteraction);
          } else {
            await handleRecipeMaterialPageNavigation(modifiedInteraction);
          }
        } else if (suffix.includes('_add_')) {
          await handleRecipeAddPageNavigation(modifiedInteraction);
        } else if (suffix.includes('_edit_')) {
          const { handleRecipeEditPagination } = await import('./recipe.js');
          await handleRecipeEditPagination(modifiedInteraction);
        }
      }
    }
    
    console.log(`?”¢ ë²”ìš© ?˜ì´ì§€ ?í”„: ${targetPage}?˜ì´ì§€ë¡??´ë™`);
  } catch (error) {
    console.error('??ë²”ìš© ?˜ì´ì§€ ?í”„ ëª¨ë‹¬ ?œì¶œ ?ëŸ¬:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '?˜ì´ì§€ ?´ë™ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.', ephemeral: true }).catch(() => {});
    }
  }
}
