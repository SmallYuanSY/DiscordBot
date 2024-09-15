import { SlashCommandBuilder } from 'discord.js';

export const command = new SlashCommandBuilder()
    .setName('testevent')
    .setDescription('測試 VoiceStateUpdate 事件是否正確觸發');

export const action = async (ctx) => {
    const client = ctx.client;

    if (!client) {
        console.error('Client is not defined');
        return;
    }

    if (!ctx.member) {
        console.error('Member is not defined');
        return;
    }

    // 模擬 VoiceStateUpdate 事件
    const oldState = { channelId: null };
    const newState = { channelId: '1267722773594374154', member: ctx.member };

    // 手動觸發事件
    client.emit('voiceStateUpdate', oldState, newState);

    await ctx.reply('已手動觸發 VoiceStateUpdate 事件');
    console.log('已手動觸發 VoiceStateUpdate 事件');
};