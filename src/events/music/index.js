import { getDistubeInstance } from '@/events/music/distube'; // 修改為實際的路徑

export const event = {
    name: 'ready',  // 當 bot 準備好時
    once: true,     // 這個事件只執行一次
};

export const action = (client) => {
    console.log('Initializing Distube...');
    getDistubeInstance(client);
};