import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { getDistubeInstance } from '@/events/music/distube.js';
import { getVoiceConnection } from '@discordjs/voice';
import { client } from '@/main.js'; 

export const command = new SlashCommandBuilder()
    .setName('musicedit')
    .setDescription('音樂播放控制選項');

export const action = async (ctx) => {
    const distube = getDistubeInstance();
    const guildId = ctx.guild.id;
    const queue = distube.getQueue(guildId);

    if (!queue) {
        await ctx.reply({ content: '目前沒有播放中的音樂', ephemeral: true });
        return;
    }

    let songsDescription = queue.songs.map((song, index) => `${index + 1}. ${song.name}`).join('\n');

    const embed = new EmbedBuilder()
        .setColor(0x00AE86)
        .setTitle('🎶播放列表🎶')
        .setDescription(songsDescription);

    const songOptions = queue.songs.map((song, index) => ({
        label: song.name,
        value: String(index),
        description: `第 ${index + 1} 首歌`
    })).slice(0, 25); // 確保選單最多包含25首歌曲

    if (songOptions.length === 0) {
        await ctx.reply({ content: '目前沒有可用的歌曲選項', ephemeral: true });
        return;
    }

    const selectMenuRows = [];
    for (let i = 0; i < songOptions.length; i += 5) {
        const uniqueId = `remove_song_${i}`; // 使用唯一的 custom_id
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(uniqueId)
            .setPlaceholder('選擇要刪除的歌曲')
            .addOptions(songOptions.slice(i, i + 5));

        selectMenuRows.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    await ctx.reply({ embeds: [embed], components: selectMenuRows });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isStringSelectMenu()) return;

        const currentQueue = distube.getQueue(guildId);
        if (!currentQueue) {
            await interaction.reply({ content: '目前沒有播放中的音樂', ephemeral: true });
            return;
        }

        const updateEmbedAndMenu = async () => {
            const updatedQueue = distube.getQueue(guildId);
            if (!updatedQueue || updatedQueue.songs.length === 0) {
                await interaction.editReply({ content: '播放列表是空的，機器人即將離開語音頻道。', components: [] });
                distube.stop(guildId);
                const connection = getVoiceConnection(guildId);
                if (connection) connection.destroy();
                return;
            }

            const songsDescription = updatedQueue.songs.map((song, index) => `${index + 1}. ${song.name}`).join('\n');
            const updatedEmbed = new EmbedBuilder()
                .setColor(0x00AE86)
                .setTitle('🎶更新後的播放列表🎶')
                .setDescription(songsDescription);

            const updatedSongOptions = updatedQueue.songs.map((song, index) => ({
                label: song.name,
                value: String(index),
                description: `第 ${index + 1} 首歌`
            })).slice(0, 25);

            const updatedSelectMenuRows = [];
            for (let i = 0; i < updatedSongOptions.length; i += 5) {
                const updatedUniqueId = `remove_song_${i}`; // 為每個選單分配唯一的 custom_id
                const updatedSelectMenu = new StringSelectMenuBuilder()
                    .setCustomId(updatedUniqueId)
                    .setPlaceholder('選擇要刪除的歌曲')
                    .addOptions(updatedSongOptions.slice(i, i + 5));

                updatedSelectMenuRows.push(new ActionRowBuilder().addComponents(updatedSelectMenu));
            }

            await interaction.editReply({ embeds: [updatedEmbed], components: updatedSelectMenuRows });
        };

        if (interaction.customId.startsWith('remove_song_')) {
            const songIndex = parseInt(interaction.values[0], 10);
            const removedSong = currentQueue.songs[songIndex];

            if (songIndex === 0 && currentQueue.songs.length > 1) {
                await distube.skip(guildId);
            } else {
                currentQueue.songs.splice(songIndex, 1);
            }

            await interaction.update({ content: `已刪除: ${removedSong.name}` });
            await updateEmbedAndMenu();
        }
    });
};