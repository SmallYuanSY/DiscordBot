import { SlashCommandBuilder } from 'discord.js';
import { loadServerConfig, updateServerConfig } from '@/core/config.js';

export const command = new SlashCommandBuilder()
    .setName('deletemainchannel')
    .setDescription('Delete the main voice channel ID for creating temporary channels');

// 命令的執行邏輯
export const action = async (interaction) => {
    const guildId = interaction.guild.id;

    try {
        // 加載伺服器配置
        let config = loadServerConfig(guildId, 'tempVoice.json');
        if (!config || !config.targetChannelId) {
            return interaction.reply({ content: '目前沒有設定任何主語音頻道。', ephemeral: true });
        }

        // 刪除主語音頻道 ID
        delete config.targetChannelId;

        // 保存更新後的配置
        updateServerConfig(guildId, config, 'tempVoice.json');

        await interaction.reply(`成功刪除主語音頻道設置。`);
    } catch (error) {
        console.error('Error deleting main channel:', error);
        await interaction.reply('刪除主頻道時發生錯誤。');
    }
};