// 권한 설정 커맨드 핸들러

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getSettings } from '../../database.js';
import { PERMISSION_FEATURE_KEYS } from '../../constants.js';
import { isAdmin, isServerOwner, replyNoPermission, sendTemporaryReply, getTimeoutSettingsAsync } from '../../utils.js';

function formatFeatureKeys(keys = []) {
  if (!keys || keys.length === 0) return '없음';
  if (keys.includes('*')) return '전체 허용';
  const labels = keys
    .map((key) => PERMISSION_FEATURE_KEYS.find((k) => k.key === key)?.label || key)
    .filter(Boolean);
  return labels.join(', ');
}

function createPermissionButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('perm_admin_add')
      .setLabel('관리자 승급')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('perm_admin_remove')
      .setLabel('관리자 강등')
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('perm_admin_features')
      .setLabel('관리자 권한 범위 설정')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('perm_member_edit')
      .setLabel('멤버 권한 범위 설정')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('perm_refresh')
      .setLabel('새로고침')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

async function buildPermissionEmbed() {
  const setting = await getSettings();
  const adminUserIds = setting?.adminUserIds || [];
  const adminAllowedFeatureKeys = setting?.adminAllowedFeatureKeys || ['*'];
  const memberAllowedFeatureKeys = setting?.memberAllowedFeatureKeys || ['*'];

  const adminMentions = adminUserIds.length
    ? adminUserIds.map((id) => `<@${id}>`).join(', ')
    : '없음';

  const embed = new EmbedBuilder()
    .setTitle('🔐 권한 설정')
    .setColor(0x5865F2)
    .addFields(
      { name: '관리자', value: adminMentions, inline: false },
      { name: '관리자 권한 범위', value: formatFeatureKeys(adminAllowedFeatureKeys), inline: false },
      { name: '마을원 권한 범위', value: formatFeatureKeys(memberAllowedFeatureKeys), inline: false }
    )
    .setFooter({ text: '권한 설정은 서버장/관리자만 가능합니다.' })
    .setTimestamp();

  return embed;
}

/**
 * /권한설정 커맨드 처리
 */
export async function handlePermissionsCommand(interaction) {
  try {
    // 서버장만 권한 설정 가능
    if (!(await isServerOwner(interaction))) {
      return await replyNoPermission(interaction, '서버장만 권한 설정이 가능합니다');
    }

    const embed = await buildPermissionEmbed();
    const buttons = createPermissionButtons();

    await interaction.reply({ embeds: [embed], components: buttons, ephemeral: true });
  } catch (error) {
    console.error('❌ 권한설정 처리 실패:', error);
    await interaction.reply({ content: '❌ 권한 설정 중 오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

export async function refreshPermissionMessage(interaction) {
  const embed = await buildPermissionEmbed();
  const buttons = createPermissionButtons();
  if (interaction.replied || interaction.deferred) {
    await interaction.editReply({ embeds: [embed], components: buttons });
  } else {
    await interaction.reply({ embeds: [embed], components: buttons, ephemeral: true });
  }
}

/**
 * /권한조회 커맨드 처리
 */
export async function handlePermissionStatusCommand(interaction) {
  try {
    if (!interaction.guild) {
      return await interaction.reply({ content: '서버에서만 사용할 수 있는 명령어입니다.', ephemeral: true });
    }

    const setting = await getSettings();
    const adminUserIds = setting?.adminUserIds || [];
    const adminAllowedFeatureKeys = setting?.adminAllowedFeatureKeys || ['*'];
    const memberAllowedFeatureKeys = setting?.memberAllowedFeatureKeys || ['*'];

    let ownerId = interaction.guild.ownerId;
    if (!ownerId) {
      try {
        const owner = await interaction.guild.fetchOwner();
        ownerId = owner?.id;
      } catch (error) {
        ownerId = null;
      }
    }

    const ownerText = ownerId ? `<@${ownerId}>` : '알 수 없음';
    const adminMentions = adminUserIds.length
      ? adminUserIds.map((id) => `<@${id}>`).join(', ')
      : '없음';

    let memberListText = '가져오는 중...';
    try {
      const members = await interaction.guild.members.fetch();
      const excludedIds = new Set([ownerId, ...adminUserIds].filter(Boolean));
      const memberIds = members
        .filter((m) => !m.user?.bot)
        .filter((m) => !excludedIds.has(m.id))
        .map((m) => m.id);

      if (memberIds.length === 0) {
        memberListText = '없음';
      } else {
        const mentions = memberIds.map((id) => `<@${id}>`);
        let display = '';
        let shown = 0;
        for (const mention of mentions) {
          const next = display ? `${display}, ${mention}` : mention;
          if (next.length > 900) break; // embed field length safety
          display = next;
          shown += 1;
        }
        const remaining = memberIds.length - shown;
        memberListText = remaining > 0 ? `${display} 외 ${remaining}명` : display;
      }
    } catch (error) {
      memberListText = '멤버 목록을 가져올 수 없습니다. (멤버 인텐트 필요)';
    }

    const embed = new EmbedBuilder()
      .setTitle('🔐 권한 현황')
      .setColor(0x5865F2)
      .addFields(
        { name: '서버장', value: ownerText, inline: false },
        { name: '관리자', value: adminMentions, inline: false },
        { name: '멤버', value: memberListText, inline: false },
        { name: '관리자 권한 범위', value: formatFeatureKeys(adminAllowedFeatureKeys), inline: false },
        { name: '마을원 권한 범위', value: formatFeatureKeys(memberAllowedFeatureKeys), inline: false }
      )
      .setTimestamp();

    const { infoTimeout } = await getTimeoutSettingsAsync();
    await sendTemporaryReply(interaction, { embeds: [embed] }, infoTimeout);
  } catch (error) {
    console.error('❌ 권한조회 처리 실패:', error);
    await interaction.reply({ content: '❌ 권한 조회 중 오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}
