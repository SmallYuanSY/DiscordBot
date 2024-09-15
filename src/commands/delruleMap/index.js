import { SlashCommandBuilder } from 'discord.js';
import { loadServerConfig, updateServerConfig } from '@/core/config.js';

export const command = new SlashCommandBuilder()
    .setName('deleterolemap')
    .setDescription('Delete the emoji-to-role mapping for the current server')
    .addStringOption(option => 
        option.setName('emoji')
            .setDescription('The emoji to remove from the mapping')
            .setRequired(true));  // 讓用戶選擇要刪除的表情符號

// 命令的執行邏輯
export const action = async (interaction) => {
    const guildId = interaction.guild.id;
    const emoji = interaction.options.getString('emoji');

    try {
        // 加載伺服器的 roleMap 配置
        let roleMap = loadServerConfig(guildId, 'roleMap.json');

        // 如果 roleMap 是空的，則回覆錯誤
        if (!roleMap || !roleMap[emoji]) {
            return interaction.reply(`No mapping found for emoji: ${emoji}`);
        }

        // 刪除指定的表情符號映射
        delete roleMap[emoji];

        // 保存更新後的 roleMap
        updateServerConfig(guildId, 'roleMap.json', roleMap);

        // 回覆用戶操作成功
        await interaction.reply(`Successfully removed the mapping for emoji: ${emoji}`);
    } catch (error) {
        console.error('Error removing roleMap:', error);
        await interaction.reply('An error occurred while removing the role map.');
    }
};