
import { Events, ChannelType, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { useAppStore } from '@/store/app';
import { client } from '../../main';  // 引入 client
import { loadServerConfig, updateServerConfig } from '@/core/config.js';  // 引入配置管理模塊

export const event = {
    name: Events.VoiceStateUpdate,
    once: false
};

let intervalId;

export const action = async (oldState, newState) => {
    const appStore = useAppStore();
    const guildId = newState.guild.id;

    // 加載伺服器的 config 和 tempVoice 配置文件
    const config = loadServerConfig(guildId, 'config.json');
    const tempVoiceConfig = loadServerConfig(guildId, 'tempVoice.json');
    const targetChannelId = config.targetChannelId;  // 從配置文件中獲取 targetChannelId

    if (!newState.member || !newState.channel) {
        console.error('新狀態成員或頻道未定義');
        return;
    }

    console.log(`${newState.member.user.username} 加入了語音頻道 ${newState.channel.name}`);

    // 檢查新狀態的語音頻道是否為目標頻道
    if (newState.channelId === targetChannelId && oldState.channelId !== targetChannelId) {
        try {
            const guild = newState.guild;
            const member = newState.member;
            const newChannelName = `${member.displayName}的語音頻道`;

            // 清除已有的 interval
            if (intervalId) {
                clearInterval(intervalId);
            }

            // 檢查是否已經有一個創建的頻道
            let userChannel = guild.channels.cache.find(channel => channel.name === newChannelName && channel.type === ChannelType.GuildVoice);

            if (!userChannel) {
                // 創建新語音頻道
                userChannel = await guild.channels.create({
                    name: newChannelName,
                    type: ChannelType.GuildVoice,
                    parent: newState.channel.parent, // 使用同樣的類別
                    permissionOverwrites: [
                        {
                            id: member.id,
                            allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ManageChannels],
                        },
                        {
                            id: guild.id,
                            deny: [PermissionFlagsBits.ViewChannel],
                        }
                    ],
                });

                // 更新配置文件中的 tempVoiceChannels
                tempVoiceConfig.tempVoiceChannels.push(userChannel.id);
                updateServerConfig(guildId, tempVoiceConfig, 'tempVoice.json');

                console.log(`為 ${member.displayName} 創建了語音頻道: ${userChannel.name}`);
            }

            // 每隔60秒檢查一次是否有空頻道需要刪除
            intervalId = setInterval(() => {
                checkChannelEmpty(guild);
            }, 60000);

        } catch (error) {
            console.error('創建語音頻道失敗:', error);
        }
    }
};

// 檢查並刪除空的臨時語音頻道
const checkChannelEmpty = async (guild) => {
    const guildId = guild.id;
    const tempVoiceConfig = loadServerConfig(guildId, 'tempVoice.json');

    // 遍歷臨時語音頻道，檢查是否為空
    tempVoiceConfig.tempVoiceChannels.forEach(async (channelId, index) => {
        const voiceChannel = guild.channels.cache.get(channelId);

        if (voiceChannel && voiceChannel.members.size === 0) {
            // 延遲刪除操作，等待可能的重新加入
            setTimeout(async () => {
                // 再次檢查頻道是否仍然無人
                if (voiceChannel.members.size === 0) {
                    await voiceChannel.delete();
                    console.log(`刪除空的臨時語音頻道: ${voiceChannel.name}`);

                    // 從 tempVoiceConfig 中刪除已刪除的頻道
                    tempVoiceConfig.tempVoiceChannels.splice(index, 1);
                    updateServerConfig(guildId, tempVoiceConfig, 'tempVoice.json');
                }
            }, 60000);  // 延遲 60 秒後執行刪除操作
        }
    });
};

// Interaction (Button and Select Menu) handling

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
        await interaction.reply({ content: 'You are not in a voice channel!', ephemeral: true });
        return;
    }

    try {
        if (interaction.customId === 'hide_channel') {
            // 隱藏語音頻道
            await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false });
            await interaction.reply({ content: '隱藏語音頻道了喔!', ephemeral: true });
        } else if (interaction.customId === 'unlock_channel') {
            // 顯示語音頻道
            await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: true });
            await interaction.reply({ content: '顯示語音頻道了喔!', ephemeral: true });
        } else if (interaction.customId === 'set_user_limit') {
            // 創建選單設置人數限制
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_user_limit')
                .setPlaceholder('Select user limit')
                .addOptions([
                    { label: '1', value: '1' },
                    { label: '2', value: '2' },
                    { label: '3', value: '3' },
                    { label: '4', value: '4' },
                    { label: '5', value: '5' },
                    { label: '6', value: '6' },
                    { label: '7', value: '7' },
                    { label: '8', value: '8' },
                    { label: '9', value: '9' },
                    { label: '10', value: '10' },
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.reply({
                content: '請選擇能夠進來的人數為:',
                components: [row],
                ephemeral: true
            });
        } else if (interaction.customId === 'select_user_limit') {
            const userLimit = parseInt(interaction.values[0], 10);
            await voiceChannel.setUserLimit(userLimit);
            await interaction.update({ content: `調整能夠進來的人數為 ${userLimit}`, components: [], ephemeral: true });
        }
    } catch (error) {
        console.error('Failed to update voice channel permissions or user limit:', error);
        await interaction.reply({ content: 'Failed to update voice channel settings.', ephemeral: true });
    }
});
