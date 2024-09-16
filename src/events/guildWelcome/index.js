import { EmbedBuilder } from 'discord.js';
import { loadServerConfig } from '@/core/config.js';  // 假設你有這個函式來載入伺服器設定

export const event = {
  name: 'guildMemberAdd',
  once: false,
};

export const action = async (member) => {
  const welcomeConfig = loadServerConfig(member.guild.id, 'welcome.json');

  if (!welcomeConfig) {
    console.error('找不到 welcome.json 設定檔');
    return;
  }

  const channel = member.guild.channels.cache.get(welcomeConfig.channelId);
  if (!channel) {
    console.error(`找不到指定的頻道 ID: ${welcomeConfig.channelId}`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(welcomeConfig.title || '歡迎!')
    .setDescription(welcomeConfig.description.replace('{userId}', member.user.id))
    .setColor(0x00AE86);

  channel.send({ embeds: [embed] })
    .then(() => console.log('已成功發送歡迎訊息'))
    .catch(console.error);
};