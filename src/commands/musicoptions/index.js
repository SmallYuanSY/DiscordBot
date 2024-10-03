import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { getDistubeInstance } from '@/events/music/distube.js';
import { getVoiceConnection } from '@discordjs/voice';
import { client } from '@/main.js'; 

export const command = new SlashCommandBuilder()
    .setName('musicedit')
    .setDescription('音樂播放控製選項');

export const action = async (ctx) => {
    const distube = getDistubeInstance();
    const guildId = ctx.guild.id;
    const queue = distube.getQueue(guildId);

    if (!queue) {
        await ctx.reply({ content: '目前沒有播放中的音樂', ephemeral: true });
        return;
    }

    const songList = queue.songs;
    const totalSongs = songList.length;
    const pageSize = 10;
    const totalPages = Math.ceil(totalSongs / pageSize);
    let currentPage = 1;

    const generateEmbed = (page) => {
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const pageItems = songList.slice(start, end);

        const description = pageItems.map((song, index) => 
            `${start + index + 1}. ${song.name}`
        ).join('\n');

        return new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`播放列表 (第 ${page}/${totalPages} 頁)`)
            .setDescription(description)
            .setFooter({ text: `共 ${totalSongs} 首歌曲` });
    };

    const generateButtons = (page) => {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('previous')
                    .setLabel('上一頁')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 1),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('下一頁')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === totalPages)
            );
    };

    const controlRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('pause')
                .setLabel('暫停')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('resume')
                .setLabel('繼續')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('skip')
                .setLabel('跳過')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('stop')
                .setLabel('停止')
                .setStyle(ButtonStyle.Danger),
        );

    const selectRow = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select')
                .setPlaceholder('選擇一個選項')
                .addOptions(
                    { label: '循環模式', value: 'loop' },
                    { label: '自動播放', value: 'autoplay' },
                    { label: '音量調整', value: 'volume' },
                )
        );

    const initialEmbed = generateEmbed(currentPage);
    const initialButtons = generateButtons(currentPage);

    await ctx.deferReply();
    const message = await ctx.editReply({ 
        embeds: [initialEmbed], 
        components: [initialButtons, controlRow, selectRow],
    });

    const filter = i => i.user.id === ctx.user.id;
    const collector = message.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async i => {
        const queue = distube.getQueue(guildId);
        if (!queue) {
            await i.reply({ content: '目前沒有播放中的音樂', ephemeral: true });
            return;
        }

        switch (i.customId) {
            case 'previous':
                currentPage = Math.max(1, currentPage - 1);
                break;
            case 'next':
                currentPage = Math.min(totalPages, currentPage + 1);
                break;
            case 'pause':
                if (!queue.paused) {
                    queue.pause();
                    await i.reply({ content: '音樂已暫停', ephemeral: true });
                } else {
                    await i.reply({ content: '音樂已經處於暫停狀態', ephemeral: true });
                }
                return;
            case 'resume':
                if (queue.paused) {
                    queue.resume();
                    await i.reply({ content: '音樂已繼續播放', ephemeral: true });
                } else {
                    await i.reply({ content: '音樂已經在播放中', ephemeral: true });
                }
                return;
            case 'skip':
                if (queue.songs.length > 1) {
                    queue.skip();
                    await i.reply({ content: '已跳過當前歌曲', ephemeral: true });
                } else {
                    await i.reply({ content: '播放列表中沒有下一首歌曲，無法跳過', ephemeral: true });
                }
                return;
            case 'stop':
                queue.stop();
                await i.reply({ content: '音樂已停止播放，播放列表已清空', ephemeral: true });
                // 在停止播放後，我們應該更新消息以反映空的播放列表
                currentPage = 1;
                await i.message.edit({
                    embeds: [new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle('播放列表')
                        .setDescription('播放列表已清空')],
                    components: [controlRow, selectRow] // 移除分頁按鈕
                });
                return;
            case 'select':
                switch (i.values[0]) {
                    case 'loop':
                        queue.setRepeatMode(queue.repeatMode === 0 ? 1 : 0);
                        await i.reply({ content: `循環模式已${queue.repeatMode === 0 ? '關閉' : '開啟'}`, ephemeral: true });
                        return;
                    case 'autoplay':
                        queue.toggleAutoplay();
                        await i.reply({ content: `自動播放已${queue.autoplay ? '開啟' : '關閉'}`, ephemeral: true });
                        return;
                    case 'volume':
                        // 這裡需要額外的邏輯來處理音量調整
                        await i.reply({ content: '音量調整功能尚未實現', ephemeral: true });
                        return;
                }
        }

        await i.update({ 
            embeds: [generateEmbed(currentPage)], 
            components: [generateButtons(currentPage), controlRow, selectRow] 
        });
    });

    collector.on('end', () => {
        message.edit({ components: [] });
    });
};

// ... 其他現有代碼 ...