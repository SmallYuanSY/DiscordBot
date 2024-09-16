import { Events } from 'discord.js';
import { initServerConfig } from '@/core/config.js'; // 引入配置文件管理模塊

export const event = {
    name: Events.ClientReady,
    once: true, // 只在啟動時觸發一次
};

export const action = async (client) => {
    console.log('Bot is ready!');

    // 為每個已加入的伺服器初始化配置文件
    client.guilds.cache.forEach(guild => {
        // 初始化伺服器的配置文件，例如 roleMap.json 和 tempVoice.json
        initServerConfig(guild.id, 'roleMap.json');
        initServerConfig(guild.id, 'tempVoice.json');
        initServerConfig(guild.id, 'welcome.json');
    });
};