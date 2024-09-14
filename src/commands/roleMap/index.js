import { SlashCommandBuilder } from 'discord.js';
import { loadServerConfig, updateServerConfig } from '@/core/config.js';

export const command = new SlashCommandBuilder()
    .setName('editrolemap')
    .setDescription('Edit the emoji-to-role mapping for the current server')
    .addStringOption(option => 
        option.setName('emoji')
            .setDescription('The emoji to be mapped')
            .setRequired(true))
    .addRoleOption(option => 
        option.setName('role')
            .setDescription('The role to be assigned for this emoji')
            .setRequired(true));  // 使用 addRoleOption 讓用戶直接選擇角色

// 命令的執行邏輯
export const action = async (interaction) => {
    const guildId = interaction.guild.id;
    const emoji = interaction.options.getString('emoji');
    const role = interaction.options.getRole('role');  // 使用 getRole 獲取角色對象
    const roleId = role.id;  // 獲取角色的 ID

    try {
        // 加載伺服器的 roleMap 配置
        let roleMap = loadServerConfig(guildId, 'roleMap.json');

        // 如果 roleMap 是空的，初始化它
        if (!roleMap) {
            roleMap = {};
        }

        // 更新 roleMap
        roleMap[emoji] = roleId;

        // 保存更新後的 roleMap
        updateServerConfig(guildId, 'roleMap.json', roleMap);

        // 回覆用戶操作成功
        await interaction.reply(`Successfully updated: ${emoji} -> Role: ${role.name} (ID: ${roleId})`);
    } catch (error) {
        console.error('Error updating roleMap:', error);
        await interaction.reply('An error occurred while updating the role map.');
    }
};