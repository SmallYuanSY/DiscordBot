import { SlashCommandBuilder } from 'discord.js';
import { getDistubeInstance } from '@/events/music/distube.js';

export const command = new SlashCommandBuilder()
    .setName('queue')
    .setDescription('查看當前播放列表');

export const action = async (ctx) => {
    const { guild, channel } = ctx;
    const distube = getDistubeInstance();

    // 取得當前的播放隊列
    const queue = distube.getQueue(guild.id);

    if (!queue) {
        await ctx.reply('當前沒有播放任何音樂！');
        return;
    }

    // 組裝播放列表資訊
    const songsList = queue.songs
        .map((song, index) => `${index + 1}. [${song.name}](${song.url}) - \`${song.formattedDuration}\``)
        .join('\n');

    const embed = {
        color: 0x00AE86,
        title: '🎶 當前播放列表 🎶',
        description: songsList,
    };

    await ctx.reply({ embeds: [embed] });
};