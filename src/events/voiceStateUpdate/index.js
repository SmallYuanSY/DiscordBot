
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
    const guildId = newState.guild.id;
    const tempVoiceConfig = loadServerConfig(guildId, 'tempVoice.json');  // 加载 tempVoice.json 配置
    const targetChannelId = tempVoiceConfig ? tempVoiceConfig.targetChannelId : null;

    if (!newState.member || !newState.channel) return;

    if (newState.channelId === targetChannelId && oldState.channelId !== targetChannelId) {
        try {
            const guild = newState.guild;
            const member = newState.member;
            const newChannelName = `${member.displayName}的臨時頻道`;

            // Clear any existing interval
            if (intervalId) {
                clearInterval(intervalId);
                //console.log('Cleared existing interval');
            }

            // 创建语音频道
            let userVoiceChannel = await guild.channels.create({
                name: newChannelName,
                type: ChannelType.GuildVoice,
                parent: newState.channel.parent,  // 使用相同的类目
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

            // 创建对应的文字频道
            let userTextChannel = await guild.channels.create({
                name: `${member.displayName}-文字頻道`,
                type: ChannelType.GuildText,
                parent: newState.channel.parent,
                permissionOverwrites: [
                    {
                        id: member.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
                    },
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    }
                ],
            });

            // 如果没有 tempVoiceChannels 列表，则初始化
            if (!tempVoiceConfig.tempVoiceChannels) tempVoiceConfig.tempVoiceChannels = [];

            // 将新创建的语音频道和文字频道信息存储到 tempVoice.json
            tempVoiceConfig.tempVoiceChannels.push({
                voiceChannelId: userVoiceChannel.id,
                textChannelId: userTextChannel.id,
            });

            // 保存更新到 JSON 文件
            updateServerConfig(guildId, 'tempVoice.json', tempVoiceConfig);

            //console.log(`為 ${member.displayName} 創建了語音頻道: ${userVoiceChannel.name} 和文字頻道: ${userTextChannel.name}`);
            // Add a short delay to ensure the channel is created
            await new Promise(resolve => setTimeout(resolve, 100));

            // Move the user to their channel
            await newState.member.voice.setChannel(userVoiceChannel);

            // Create a button to hide and show the channel
            const hideButton = new ButtonBuilder()
                .setCustomId('tempvoice_hide_channel')
                .setLabel('隱藏頻道')
                .setStyle(ButtonStyle.Danger);
            const unlockButton = new ButtonBuilder()
                .setCustomId('tempvoice_unlock_channel')
                .setLabel('顯示頻道')
                .setStyle(ButtonStyle.Success);
            const userLimitButton = new ButtonBuilder()
                .setCustomId('tempvoice_set_user_limit')
                .setLabel('設置人數限製')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder()
                .addComponents(hideButton, unlockButton, userLimitButton);
            
            await userTextChannel.send({ content: '歡迎來到你的臨時頻道!', components: [row] });

            // Restart the interval to check for empty channels
            intervalId = setInterval(() => checkAndDeleteEmptyChannels(newState.guild), 3000);
        } catch (error) {
            console.error('創建語音或文字頻道失敗:', error);
        }
    }
};

export const checkAndDeleteEmptyChannels = async (guild) => {
    const config = loadServerConfig(guild.id, 'tempVoice.json');
    
    for (const channelInfo of config.tempVoiceChannels) {
        const voiceChannel = guild.channels.cache.get(channelInfo.voiceChannelId);
        const textChannel = guild.channels.cache.get(channelInfo.textChannelId);

        if (voiceChannel && voiceChannel.members.size === 0) {
            try {
                await voiceChannel.delete();
                await textChannel.delete();

                // 刪除後從 config 中移除該頻道
                config.tempVoiceChannels = config.tempVoiceChannels.filter(
                    channel => channel.voiceChannelId !== channelInfo.voiceChannelId
                );

                // 更新配置文件
                updateServerConfig(guild.id, 'tempVoice.json', config);

                //console.log(`已刪除語音和文字頻道: ${voiceChannel.name}`);
            } catch (error) {
                console.error('刪除臨時頻道失敗:', error);
            }
        }
    }
};

// Interaction (Button and Select Menu) handling

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
    if (interaction.customId.startsWith('tempvoice') || interaction.customId.startsWith('select_user_limit')) {
        if (!interaction.replied && !interaction.deferred) {
            if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

            const member = interaction.member;
            const voiceChannel = member.voice.channel;

            try {
                if (interaction.customId === 'tempvoice_hide_channel') {
                    // 隱藏語音頻道
                    if (!voiceChannel) {
                        await interaction.reply({ content: '請先加入語音頻道再進行操作', ephemeral: true });
                        return;
                    }
                    await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false });
                    await interaction.reply({ content: '隱藏語音頻道了喔!', ephemeral: true });
                } else if (interaction.customId === 'tempvoice_unlock_channel') {
                    // 顯示語音頻道
                    if (!voiceChannel) {
                        await interaction.reply({ content: '請先加入語音頻道再進行操作', ephemeral: true });
                        return;
                    }
                    await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: true });
                    await interaction.reply({ content: '顯示語音頻道了喔!', ephemeral: true });
                } else if (interaction.customId === 'tempvoice_set_user_limit') {
                    // 創建選單設置人數限製
                    if (!voiceChannel) {
                        await interaction.reply({ content: '請先加入語音頻道再進行操作', ephemeral: true });
                        return;
                    }
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
        }
    }
    
});
