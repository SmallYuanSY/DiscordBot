import { Events } from "discord.js";
import fs from 'fs';
import path from 'path';

export const event = {
    name: Events.ClientReady,
    once: true
}

export const action = async(readyClient) => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
	//console.log('教學來自Proladon https://www.youtube.com/playlist?list=PLSCgthA1AnidGdmSea6V6N24O8mXESrf3');

    // 取得伺服器 ID 列表
    const guilds = readyClient.guilds.cache;

    // 針對每個伺服器載入並初始化反應身份組
    guilds.forEach(async guild => {
        const guildId = guild.id;
        const configPath = path.resolve(`./src/config/${guildId}/reactionRole.json`);

        if (!fs.existsSync(configPath)) {
            console.error(`找不到 reactionRole.json 檔案，位於伺服器: ${guildId}`);
            return;
        }

        const config = JSON.parse(fs.readFileSync(configPath));

        // 確保 reactions 是一個陣列
        if (!Array.isArray(config.reactions)) {
            console.error(`reactionRole.json 中的 reactions 不是陣列，位於伺服器: ${guildId}`);
            return;
        }

        // 自動將表情符號加回訊息
        for (const { messageId, emoji, roleId, channelId } of config.reactions) {
            const channel = guild.channels.cache.get(channelId);  // 根據 channelId 直接找到頻道
            if (channel) {
                try {
                    // 嘗試從 API 獲取訊息，確保訊息存在
                    const message = await channel.messages.fetch(messageId);
                    if (message) {
                        await message.react(emoji);  // 將表情符號加回訊息
                        console.log(`已成功將表情符號 ${emoji} 加到訊息 ${messageId}`);
                    }
                } catch (error) {
                    console.error(`無法獲取或加回表情符號到訊息 ${messageId}:`, error);
                }
            } else {
                console.error(`找不到指定的頻道 ID: ${channelId}`);
            }
        }
        
        console.log(`已初始化伺服器 ${guildId} 的反應身份組`);
    });

    console.log('已初始化所有反應身份組');
}