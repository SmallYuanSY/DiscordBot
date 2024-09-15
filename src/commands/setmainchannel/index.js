import { ChannelType, SlashCommandBuilder } from 'discord.js';
import { loadServerConfig, updateServerConfig } from '@/core/config.js';

export const command = new SlashCommandBuilder()
    .setName('setmainchannel')
    .setDescription('Set the main voice channel ID for creating temporary channels')
    .addChannelOption(option => 
        option.setName('channel')
            .setDescription('The main voice channel to be set')
            .setRequired(true));  // 要求用戶選擇頻道

// 命令的執行邏輯
export const action = async (interaction) => {
    const guildId = String(interaction.guild.id);  // 确保 guildId 是字符串
    const channel = interaction.options.getChannel('channel');

    // 檢查是否選擇的是語音頻道
    if (channel.type !== ChannelType.GuildVoice) {
        return interaction.reply({ content: '請選擇一個語音頻道。', ephemeral: true });
    }

    try {
        // 加載伺服器配置
        let config = loadServerConfig(guildId, 'tempVoice.json');
        if (!config) config = {};  // 如果沒有配置文件，初始化一個新的

        // 設定主語音頻道 ID
        config.targetChannelId = channel.id;

        // 保存更新後的配置，传递文件名和配置对象
        updateServerConfig(guildId, 'tempVoice.json', config);

        await interaction.reply(`成功設定主語音頻道: ${channel.name} (ID: ${channel.id})`);
    } catch (error) {
        console.error('Error setting main channel:', error);
        await interaction.reply('設定主頻道時發生錯誤。');
    }
};