// 권한 설정 모달 핸들러

import { getSettings, updateSettings } from '../../database.js';
import { isServerOwner, replyNoPermission } from '../../utils.js';

function normalizeUserId(input) {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\d{17,20}/);
  return match ? match[0] : trimmed;
}

export async function handlePermissionAdminAddModal(interaction) {
  if (!(await isServerOwner(interaction))) {
    return await replyNoPermission(interaction, '서버장만 관리자 승급이 가능합니다');
  }

  const userIdInput = interaction.fields.getTextInputValue('perm_admin_add_input');
  const userId = normalizeUserId(userIdInput);

  if (!userId) {
    return await interaction.reply({ content: '❌ 유효한 유저 ID를 입력하세요.', ephemeral: true });
  }

  const setting = await getSettings();
  const adminUserIds = new Set(setting?.adminUserIds || []);
  adminUserIds.add(userId);

  await updateSettings({ adminUserIds: Array.from(adminUserIds) });
  await interaction.reply({ content: `✅ <@${userId}> 사용자를 관리자로 승급했습니다.`, ephemeral: true });
}

export async function handlePermissionAdminRemoveModal(interaction) {
  if (!(await isServerOwner(interaction))) {
    return await replyNoPermission(interaction, '서버장만 관리자 강등이 가능합니다');
  }

  const userIdInput = interaction.fields.getTextInputValue('perm_admin_remove_input');
  const userId = normalizeUserId(userIdInput);

  if (!userId) {
    return await interaction.reply({ content: '❌ 유효한 유저 ID를 입력하세요.', ephemeral: true });
  }

  const setting = await getSettings();
  const adminUserIds = new Set(setting?.adminUserIds || []);
  adminUserIds.delete(userId);

  await updateSettings({ adminUserIds: Array.from(adminUserIds) });
  await interaction.reply({ content: `✅ <@${userId}> 사용자를 관리자에서 강등했습니다.`, ephemeral: true });
}
