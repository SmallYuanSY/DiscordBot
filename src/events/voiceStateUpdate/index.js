import { Events, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { useAppStore } from '@/store/app';
import { client } from '../../main';  // 导入 client

export const event = {
    name: Events.VoiceStateUpdate,
    once: false
};

let intervalId;

export const action = async (oldState, newState) => {
    const appStore = useAppStore();
    const targetChannelId = process.env.Join_ToCreate_VoiceChannel;

    if (!newState.member) {
        console.error('新狀態成員未定義');
        return;
    }

    if (!newState.channel) {
        console.error('新狀態頻道未定義');
        return;
    }

    console.log(`${newState.member.user.username} joined voice channel ${newState.channel.name}`);

    if (newState.channelId === targetChannelId && oldState.channelId !== targetChannelId) {
        try {
            const guild = newState.guild;
            const member = newState.member;
            const newChannelName = `${member.displayName}的語音頻道`;

            // Clear any existing interval
            if (intervalId) {
                clearInterval(intervalId);
                //console.log('Cleared existing interval');
            }

            // Check if the user already has a created channel
            let userChannel = guild.channels.cache.find(channel => channel.name === newChannelName && channel.type === ChannelType.GuildVoice);

            if (!userChannel) {
                // Create a new voice channel if it doesn't exist
                userChannel = await guild.channels.create({
                    name: newChannelName,
                    type: ChannelType.GuildVoice,
                    parent: newState.channel.parent, // Optional: set the same category as the target channel
                    permissionOverwrites: [
                        {
                            id: member.id,
                            allow: [
                                PermissionFlagsBits.ManageChannels,
                                PermissionFlagsBits.MuteMembers,
                                PermissionFlagsBits.DeafenMembers,
                                PermissionFlagsBits.MoveMembers
                            ],
                        }
                    ]
                });

                console.log(`建立一個語音頻道 : ${userChannel.name}`);

                // Create a message with buttons
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('unlock_channel')
                            .setLabel('顯示頻道')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('hide_channel')
                            .setLabel('隱藏頻道')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('set_user_limit')
                            .setLabel('設置人數')
                            .setStyle(ButtonStyle.Primary),
                    );

                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('頻道控制')
                    .setDescription(`控制選項對 ${userChannel.name} 頻道`);

                // Create a text channel associated with the voice channel
                const textChannel = await guild.channels.create({
                    name: `${newChannelName}-text`,
                    type: ChannelType.GuildText,
                    parent: userChannel.parent, // Optional: set the same category as the voice channel
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: [PermissionFlagsBits.ViewChannel],
                        },
                        {
                            id: member.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ManageMessages,
                            ],
                        }
                    ]
                });

                console.log(`建立一個文字頻道 : ${textChannel.name}`);

                // Send an embed message to the new text channel
                if (textChannel && textChannel.isTextBased()) {
                    await textChannel.send({
                        embeds: [embed],
                        components: [row]
                    });
                }

                // Store the created text channel ID in the userChannel object
                userChannel.textChannelId = textChannel.id;
            }

            // Add a short delay to ensure the channel is created
            await new Promise(resolve => setTimeout(resolve, 100));

            // Move the user to their channel
            await newState.member.voice.setChannel(userChannel);
            //console.log(`Moved ${member.displayName} to channel: ${userChannel.name}`);

            // Restart the interval to check for empty channels
            intervalId = setInterval(() => checkChannelEmpty(newState.guild), 3000);
            //console.log('Restarted interval to check for empty channels');
        } catch (error) {
            console.error('Failed to create or manage new channel:', error);
        }
    }

    // Give the user send message permission in the associated text channel
    if (newState.channel && newState.channel.name.endsWith('的語音頻道')) {
        const userChannel = newState.channel;
        const textChannel = userChannel.guild.channels.cache.get(userChannel.textChannelId);

        if (textChannel) {
            try {
                await textChannel.permissionOverwrites.edit(newState.member.id, { ViewChannel: true, SendMessages: true });
                //console.log(`Granted send messages permission to ${newState.member.user.username} in ${textChannel.name}`);
            } catch (error) {
                //console.error('Failed to grant send messages permission:', error);
            }
        }
    }

    // Remove the user's send message permission in the associated text channel when they leave the voice channel
    if (oldState.channel && oldState.channel.name.endsWith('的語音頻道') && oldState.channelId !== newState.channelId) {
        const userChannel = oldState.channel;
        const textChannel = userChannel.guild.channels.cache.get(userChannel.textChannelId);

        if (textChannel) {
            try {
                await textChannel.permissionOverwrites.edit(oldState.member.id, { ViewChannel: false, SendMessages: false });
                //console.log(`Revoked send messages permission from ${oldState.member.user.username} in ${textChannel.name}`);
            } catch (error) {
                console.error('Failed to revoke send messages permission:', error);
            }
        }
    }
};

// Check periodically if the new channel is empty and delete if it is
const checkChannelEmpty = async (guild) => {
    try {
        const userChannels = guild.channels.cache.filter(channel => channel.name.endsWith('的語音頻道') && channel.type === ChannelType.GuildVoice);
        for (const [channelId, userChannel] of userChannels) {
            if (userChannel.members.size === 0) {
                const textChannel = guild.channels.cache.get(userChannel.textChannelId);

                // Check if the channel still exists before attempting to delete
                const channelExists = await guild.channels.fetch(channelId).catch(() => null);
                if (channelExists) {
                    await userChannel.delete();
                    //console.log(`Deleted empty channel: ${userChannel.name}`);
                } else {
                    //console.log(`Channel ${userChannel.name} was already deleted`);
                }

                if (textChannel) {
                    const textChannelExists = await guild.channels.fetch(textChannel.id).catch(() => null);
                    if (textChannelExists) {
                        await textChannel.delete();
                        //console.log(`Deleted associated text channel: ${textChannel.name}`);
                    } else {
                        //console.log(`Text channel ${textChannel.name} was already deleted`);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Failed to check or delete channel:', error);
    }
};

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    //console.log(`Interaction received from ${member.user.username} with customId ${interaction.customId}`);

    if (!voiceChannel) {
        await interaction.reply({ content: 'You are not in a voice channel!', ephemeral: true });
        return;
    }

    try {
        if (interaction.customId === 'hide_channel') {
            // Update the permission overwrites for the voice channel to hide it
            await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false });
            await interaction.reply({ content: '隱藏語音頻道了喔!', ephemeral: true });
            console.log(`Voice channel ${voiceChannel.name} hidden`);
        } else if (interaction.customId === 'unlock_channel') {
            // Update the permission overwrites for the voice channel to unlock it
            await voiceChannel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: true });
            await interaction.reply({ content: '顯示語音頻道了喔!', ephemeral: true });
            console.log(`Voice channel ${voiceChannel.name} unlocked`);
        } else if (interaction.customId === 'set_user_limit') {
            // Create a select menu for user limit
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
            //console.log(`Voice channel ${voiceChannel.name} user limit set to ${userLimit}`);
        }
    } catch (error) {
        console.error('Failed to update voice channel permissions or user limit:', error);
        await interaction.reply({ content: 'Failed to update voice channel settings.', ephemeral: true });
    }
});
