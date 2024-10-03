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
  try {
    await member.guild.members.fetch(member.user.id);  // 確保該成員已載入

    setTimeout(async () => {
      const embed = new EmbedBuilder()
        .setTitle(welcomeConfig.title || '歡迎!')
        .setDescription(`<@${member.id}> 歡迎來到 ${member.guild.name}！\n` + welcomeConfig.description)  // 直接使用 `<@userId>` 提及
        .setColor(0x00AE86);

      channel.send({ embeds: [embed] })
        //.then(() => console.log(`已成功發送歡迎訊息給 ${member.user.tag}`))
        .catch(console.error);
    }, 1000);  // 延遲 1 秒再發送
  } catch (error) {
    console.error('成員資料加載失敗', error);
  }
  
};