import { Events,EmbedBuilder } from 'discord.js';
import { loadServerConfig } from '@/core/config.js';

export const event = {
    name: 'guildMemberRemove',
    once: false,
};

export const action = async (member) => {
    const leaveConfig = loadServerConfig(member.guild.id, 'leave.json');

    if (!leaveConfig) {
        console.error('找不到 leave.json 設定檔');
        return;
    }

    const channel = member.guild.channels.cache.get(leaveConfig.channelId);
    if (!channel) {
        console.error(`找不到指定的頻道 ID: ${leaveConfig.channelId}`);
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(leaveConfig.title || '再見!')
        .setDescription(leaveConfig.description.replace('{userId}', member.user.id))
        .setColor(0x00AE86);

    channel.send({ embeds: [embed] })
        .then(() => console.log('已成功發送再見訊息'))
        .catch(console.error);
};