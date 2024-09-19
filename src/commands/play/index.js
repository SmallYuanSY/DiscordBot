import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { getDistubeInstance } from '@/events/music/distube.js';
import fs from 'fs';
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

const getSongConfig = (guildId) => {
    const filePath = path.resolve(__dirname, `../../config/${guildId}/song.json`);
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return null;
};

export const action = async (ctx) => {
    const client = ctx.client;
    const query = ctx.options.getString('query');
    const textChannel = ctx.options.getChannel('textchannel') || ctx.channel;
    const voiceChannel = ctx.options.getChannel('voicechannel') || ctx.member.voice.channel;

    if (!voiceChannel) {
        await ctx.reply({ content: '你必須指定一個語音頻道！', ephemeral: true });
        return;
    }

    const songConfig = getSongConfig(ctx.guild.id);
    if (songConfig && textChannel.id !== songConfig.allowedChannelId) {
        await ctx.reply({ content: '你只能在指定的頻道中播放音樂！', ephemeral: true });
        return;
    }

    const distube = getDistubeInstance();

    try {
        await ctx.deferReply();  // Defers the reply to prevent interaction timeout

        await distube.play(voiceChannel, query, { textChannel });

        await ctx.editReply(`正在播放: ${query}`);
    } catch (error) {
        console.error(error);
        await ctx.editReply('誰告訴小元我的AI壞掉了');
    }
};