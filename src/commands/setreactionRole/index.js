import { SlashCommandBuilder } from "discord.js";
import { loadServerConfig, updateServerConfig } from "@/core/config.js";

export const command = new SlashCommandBuilder()
    .setName('setreactionrole')
    .setDescription('設置反應身份組')
    .addStringOption(option =>
        option.setName('messageid')
            .setDescription('訊息 ID')
            .setRequired(true))
    .addRoleOption(option =>
        option.setName('roleid')
            .setDescription('身份組 ID')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('emoji')
            .setDescription('表情符號')
            .setRequired(true))
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('要添加表情符號的頻道')
            .setRequired(false));  // 可選頻道參數

export const action = async (interaction) => {
    const messageId = interaction.options.getString('messageid');
    const role = interaction.options.getRole('roleid');
    const emoji = interaction.options.getString('emoji');
    const channelOption = interaction.options.getChannel('channel');
    const guildId = interaction.guild.id;

    // 使用者是否指定頻道，沒有則使用當前頻道
    const channel = channelOption || interaction.channel;

    // 載入伺服器設定，初始化 reactions 若無存在
    let config = loadServerConfig(guildId, 'reactionRole.json');

    // 如果 config 不存在或未定義 reactions，則初始化
    if (!config) {
        config = { reactions: [] };
    } else if (!Array.isArray(config.reactions)) {
        config.reactions = [];
    }

    // 將新的反應身份組設置添加進 config
    config.reactions.push({
        messageId: messageId,
        roleId: role.id,
        emoji: emoji,
        channelId: channel.id // 保存頻道ID
    });

    // 更新伺服器設定
    updateServerConfig(guildId, 'reactionRole.json', config);

    try {
        // 嘗試在指定訊息上添加表情符號
        const message = await channel.messages.fetch(messageId);
        await message.react(emoji);  // 在訊息上添加表情符號

        // 回應訊息
        await interaction.reply(`已成功設定反應身份組，當訊息 \`${messageId}\` 上的 ${emoji} 表情符號被點擊時，將賦予身份組 \`${role.name}\` 給使用者`);
    } catch (error) {
        console.error('無法添加表情符號:', error);
        await interaction.reply('無法在該訊息上添加表情符號，請確認訊息 ID 或頻道是否正確。');
    }
};