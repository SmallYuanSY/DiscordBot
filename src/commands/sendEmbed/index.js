import { SlashCommandBuilder } from 'discord.js';
import { EmbedBuilder } from 'discord.js';

export const command = new SlashCommandBuilder()
    .setName('sendembed')
    .setDescription('發送一個自定義的嵌入訊息')
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('要發送嵌入訊息的頻道')
            .setRequired(true))  // 用戶必須提供頻道
    .addStringOption(option => 
        option.setName('title')
            .setDescription('嵌入訊息的標題')
            .setRequired(true))  // 用戶必須提供標題
    .addStringOption(option => 
        option.setName('description')
            .setDescription('嵌入訊息的描述')
            .setRequired(true))  // 用戶必須提供描述
    .addStringOption(option => 
        option.setName('image')
            .setDescription('嵌入訊息的圖片 URL')  // 新增圖片選項
            .setRequired(false))  // 圖片是可選的
    .addStringOption(option => 
        option.setName('footertext')
            .setDescription('嵌入訊息的 Footer 文字')  // 新增 Footer 文字選項
            .setRequired(false))  // Footer 文字是可選的
    .addStringOption(option => 
        option.setName('footerimage')
            .setDescription('嵌入訊息的 Footer 圖片 URL')  // 新增 Footer 圖片選項
            .setRequired(false));  // Footer 圖片是可選的

export const action = async (ctx) => {
    const client = ctx.client;

    if (!client) {
        console.error('Client is not defined');
        return;
    }

    // 從指令選項中獲取標題、描述、圖片 URL、Footer 文字與圖片
    const channel = ctx.options.getChannel('channel');
    const title = ctx.options.getString('title');
    let description = ctx.options.getString('description');
    const imageUrl = ctx.options.getString('image');
    const footerText = ctx.options.getString('footertext');
    const footerImage = ctx.options.getString('footerimage');

    // 自動轉換描述中的 <@userID> 格式為 Discord 可識別的 mention
    description = description.replace(/<@(\d+)>/g, (match, userId) => {
        return `<@${userId}>`;
    });

    // 自動轉換描述中的 #channelID 格式為頻道 mention
    description = description.replace(/<#(\d+)>/g, (match, channelId) => {
        return `<#${channelId}>`;
    });

    // 創建嵌入訊息
    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(title)  // 使用指令中的標題
        .setDescription(description)  // 使用指令中的描述
        .setTimestamp();

    // 如果使用者提供了圖片 URL，設置圖片
    if (imageUrl) {
        embed.setImage(imageUrl);  // 設置圖片
    }

    // 如果使用者提供了 Footer 文字或圖片，設置 Footer
    if (footerText || footerImage) {
        embed.setFooter({
            text: footerText || '',  // 如果沒有提供 Footer 文字則設置為空字串
            iconURL: footerImage || undefined  // 如果沒有提供 Footer 圖片則設置為 undefined
        });
    }

    if (channel) {
        // 發送嵌入訊息到指定的頻道
        await channel.send({ embeds: [embed] });
        console.log(`已發送嵌入訊息: ${title} - ${description}`);
        
        // 回覆給使用者已成功發送
        await ctx.reply({ content: `已成功發送嵌入訊息到 ${channel.name}`, ephemeral: true });
    }
}