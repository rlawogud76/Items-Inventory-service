// 권한 설정 버튼 핸들러

import {
  ActionRowBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { getSettings } from '../../database.js';
import { PERMISSION_FEATURE_KEYS } from '../../constants.js';
import { isAdmin, isServerOwner, replyNoPermission } from '../../utils.js';
import { refreshPermissionMessage } from '../commandHandlers/permissions.js';

function buildMemberFeatureSelect(selectedKeys = []) {
  const options = PERMISSION_FEATURE_KEYS.map((item) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(item.label)
      .setValue(item.key)
      .setDescription(item.description)
      .setDefault(selectedKeys.includes(item.key) || (item.key === '*' && selectedKeys.includes('*')))
  );

  return new StringSelectMenuBuilder()
    .setCustomId('perm_member_features_select')
    .setPlaceholder('마을원 권한 범위를 선택하세요')
    .setMinValues(0)
    .setMaxValues(Math.min(options.length, 25))
    .addOptions(options);
}

export async function handlePermissionRefresh(interaction) {
  await refreshPermissionMessage(interaction);
}

export async function handlePermissionAdminAdd(interaction) {
  if (!(await isServerOwner(interaction))) {
    return await replyNoPermission(interaction, '서버장만 관리자 승급이 가능합니다');
  }

  const modal = new ModalBuilder()
    .setCustomId('perm_admin_add_modal')
    .setTitle('관리자 승급');

  const input = new TextInputBuilder()
    .setCustomId('perm_admin_add_input')
    .setLabel('관리자로 승급할 유저 ID')
    .setPlaceholder('예: 123456789012345678')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const row = new ActionRowBuilder().addComponents(input);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

export async function handlePermissionAdminRemove(interaction) {
  if (!(await isServerOwner(interaction))) {
    return await replyNoPermission(interaction, '서버장만 관리자 강등이 가능합니다');
  }

  const modal = new ModalBuilder()
    .setCustomId('perm_admin_remove_modal')
    .setTitle('관리자 강등');

  const input = new TextInputBuilder()
    .setCustomId('perm_admin_remove_input')
    .setLabel('관리자에서 제외할 유저 ID')
    .setPlaceholder('예: 123456789012345678')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const row = new ActionRowBuilder().addComponents(input);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

export async function handlePermissionMemberEdit(interaction) {
  if (!(await isAdmin(interaction))) {
    return await replyNoPermission(interaction, '서버장 또는 관리자만 멤버 권한을 설정할 수 있습니다');
  }

  const setting = await getSettings();
  const selectedKeys = setting?.memberAllowedFeatureKeys || ['*'];

  const select = buildMemberFeatureSelect(selectedKeys);
  const row = new ActionRowBuilder().addComponents(select);

  await interaction.reply({
    content: '권한 범위를 선택하세요.\n_변경 즉시 저장됩니다._',
    components: [row],
    ephemeral: true
  });
}
