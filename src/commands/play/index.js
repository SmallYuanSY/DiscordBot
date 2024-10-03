import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { getDistubeInstance } from '@/events/music/distube.js';
import fs from 'fs/promises';
import path from 'path';

export const command = new SlashCommandBuilder()
    .setName('play')
    .setDescription('播放音樂')
    .addStringOption(option =>
        option.setName('query')
        .setDescription('音樂名稱或連結')
        .setRequired(true)
    )
    .addChannelOption(option => 
        option.setName('textchannel')
        .setDescription('指定的文字頻道')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText)
    )
    .addChannelOption(option => 
        option.setName('voicechannel')
        .setDescription('指定的語音頻道')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildVoice)
    );

const getSongConfig = async (guildId) => {
    const filePath = path.resolve(__dirname, `../../config/${guildId}/song.json`);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
};

const handlePlaylist = async (distube, voiceChannel, query, textChannel) => {
    try {
        const result = await distube.play(voiceChannel, query, {
            textChannel,
            member: voiceChannel.guild.members.me,
        });

        if (Array.isArray(result)) {
            // 如果返回的是數組，說明是播放列表
            const totalSongs = result.length;
            return { totalSongs, isPlaylist: true };
        } else {
            // 如果不是數組，說明是單曲
            return { totalSongs: 1, isPlaylist: false };
        }
    } catch (error) {
        console.error('播放音樂時發生錯誤:', error);
        throw error;
    }
};

export const action = async (ctx) => {
    const { options, channel, member, guild } = ctx;
    const query = options.getString('query');
    const textChannel = options.getChannel('textchannel') || channel;
    const voiceChannel = options.getChannel('voicechannel') || member.voice.channel;

    if (!voiceChannel) {
        await ctx.reply({ content: '你必須指定一個語音頻道！', ephemeral: true });
        return;
    }

    const songConfig = await getSongConfig(guild.id);
    if (songConfig && textChannel.id !== songConfig.allowedChannelId) {
        await ctx.reply({ content: '你只能在指定的頻道中播放音樂！', ephemeral: true });
        return;
    }

    const distube = getDistubeInstance();

    try {
        await ctx.deferReply();

        const { totalSongs, isPlaylist } = await handlePlaylist(distube, voiceChannel, query, textChannel);

        if (isPlaylist) {
            await ctx.editReply(`已添加播放列表：共 ${totalSongs} 首歌曲。`);
        } else {
            await ctx.editReply(`已添加歌曲到播放隊列。`);
        }
    } catch (error) {
        console.error('播放音樂時發生錯誤:', error);
        await ctx.editReply('抱歉，播放音樂時出現了問題。請稍後再試。');
    }
};