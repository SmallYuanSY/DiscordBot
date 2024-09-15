import { checkAndDeleteEmptyChannels } from '@/events/voiceStateUpdate/index.js';
//import { client } from '../../../main';  // 確保已經有 Discord client 對象

//const interval = 60000;  // 每 60 秒檢查一次

export const runTimeEvents = () => {
    // setInterval(() => {
    //         client.guilds.cache.forEach(async guild => {
    //             console.log(`Checking and deleting empty channels for guild: ${guild.name}`);
    //             await checkAndDeleteEmptyChannels(guild);  // 調用 voiceStateUpdate 中的刪除功能
    //         });
    //     }, interval
    // );
};

console.log('Initializing time-based events...');
//runTimeEvents();