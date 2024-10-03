import { loadServerConfig } from '@/core/config.js';  // 假設你有這個函式來載入伺服器設定

export const event = {
  name: 'messageReactionAdd',
  once: false,
};

export const action = async (reaction, user) => {
  const guild = reaction.message.guild;
  const config = loadServerConfig(guild.id, 'reactionRole.json');

  // 確保這個反應是來自於指定的訊息 ID 的反應之一
  const reactionConfig = config.reactions.find(r => r.messageId === reaction.message.id);

  if (!reactionConfig) {
    console.error(`無法找到指定的訊息 ID: ${reaction.message.id}`);
    return;
  }

  // 設定頻道 ID，若未設置則使用當前反應訊息的頻道
  const channelId = reactionConfig.channelId || reaction.message.channel.id;

  // 找到與反應表情符號對應的角色 ID
  const roleId = reactionConfig.roleId;
  const emoji = reactionConfig.emoji;

  if (reaction.emoji.toString() !== emoji) {
    console.error(`表情符號不匹配: ${reaction.emoji.toString()} 與設定中的 ${emoji}`);
    return;
  }

  const role = guild.roles.cache.get(roleId);

  if (!role) {
    console.error(`無法找到身份組 ID: ${roleId}`);
    return;
  }

  // 獲取按下表情符號的成員
  const member = guild.members.cache.get(user.id);

  if (!member) {
    console.error(`無法找到使用者 ID: ${user.id}`);
    return;
  }

  // 賦予成員身份組
  try {
    // 如果按下表情符號的是機器人，則不移除反應
    if (!user.bot) {
      await member.roles.add(role);
      //console.log(`成功為 ${user.username} 賦予身份組: ${role.name}`);
      await reaction.users.remove(user);  // 移除成員的反應
    }
  } catch (error) {
    console.error(`無法賦予身份組: ${error}`);
  }
};