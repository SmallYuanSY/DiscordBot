import { SlashCommandBuilder, ChannelType, PermissionsBitField } from 'discord.js';
import { game } from './game.js';  // 從 game.js 導入 game 實例

// 定義一個類來管理遊戲的初始化邏輯
class WerewolfGame {
    constructor(guild) {
        this.guild = guild;
        this.aliveVoiceChannel = null;
        this.deadVoiceChannel = null;
        this.policeTextChannel = null;
        this.killerTextChannel = null;
        this.aliveTextChannel = null;
        this.deadTextChannel = null;
        this.parentCategoryId = null;
    }

    // 創建類別（頻道分類）
    async createCategory() {
        const category = await this.guild.channels.create({
            name: '狼人殺遊戲區',  // 可以自定義這個類別名稱
            type: ChannelType.GuildCategory,  // 類別類型
        });

        this.parentCategoryId = category.id;
    }

    // 創建頻道的函數
    async createChannels() {
        if (!this.parentCategoryId) {
            await this.createCategory();
        }

        // 創建活人語音頻道
        this.aliveVoiceChannel = await this.guild.channels.create({
            name: '活人語音',
            type: ChannelType.GuildVoice,
            parent: this.parentCategoryId,
            permissionOverwrites: [
                {
                    id: this.guild.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect],
                },
            ],
        });

        // 創建死人語音頻道
        this.deadVoiceChannel = await this.guild.channels.create({
            name: '死人語音',
            type: ChannelType.GuildVoice,
            parent: this.parentCategoryId,
            permissionOverwrites: [
                {
                    id: this.guild.id,
                    deny: [PermissionsBitField.Flags.Connect],
                },
            ],
        });

        // 創建其他文字頻道
        this.policeTextChannel = await this.guild.channels.create({
            name: '警察頻道',
            type: ChannelType.GuildText,
            parent: this.parentCategoryId,
            permissionOverwrites: [
                {
                    id: this.guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
            ],
        });

        this.killerTextChannel = await this.guild.channels.create({
            name: '殺手頻道',
            type: ChannelType.GuildText,
            parent: this.parentCategoryId,
            permissionOverwrites: [
                {
                    id: this.guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
            ],
        });

        this.aliveTextChannel = await this.guild.channels.create({
            name: '活人頻道',
            type: ChannelType.GuildText,
            parent: this.parentCategoryId,
            permissionOverwrites: [
                {
                    id: this.guild.id,
                    allow: [PermissionsBitField.Flags.ViewChannel],
                },
            ],
        });

        this.deadTextChannel = await this.guild.channels.create({
            name: '死人頻道',
            type: ChannelType.GuildText,
            parent: this.parentCategoryId,
            permissionOverwrites: [
                {
                    id: this.guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
            ],
        });
    }

    // 統計玩家並將他們移動到語音頻道
    async gatherPlayersAndMove(voiceChannelId) {
        const voiceChannel = await this.guild.channels.fetch(voiceChannelId);
        if (voiceChannel && voiceChannel.type === ChannelType.GuildVoice) {
            const players = voiceChannel.members.map(member => member);
            game.setPlayers(players);  // 將玩家存儲到共享的 game 實例中

            console.log('參加遊戲的玩家:', game.getPlayers().map(p => p.user.username));

            setTimeout(() => {
                game.getPlayers().forEach(async (player) => {
                    try {
                        await player.voice.setChannel(this.aliveVoiceChannel);
                        console.log(`${player.user.username} 已移動到活人語音頻道`);
                    } catch (error) {
                        console.error(`無法移動 ${player.user.username}:`, error);
                    }
                });
            }, 10000);  // 延遲 10 秒
        } else {
            console.log('未找到語音頻道或頻道無效');
        }
    }
}

// 定義指令行為
export const command = new SlashCommandBuilder()
    .setName('startgame')
    .setDescription('開始狼人殺遊戲，並創建所需頻道與拉玩家進入遊戲');

export const action = async (ctx) => {
    const { guild } = ctx;

    // 立即回應，以避免 "Unknown interaction" 錯誤
    await ctx.reply('正在創建狼人殺遊戲頻道，請稍候...');

    // 創建遊戲實例並初始化
    const gameInstance = new WerewolfGame(guild);

    // 創建語音和文字頻道
    await gameInstance.createChannels();

    // 統計玩家並延遲移動到活人頻道
    const voiceChannelId = '1212050294783873064'; // 替換為你要統計的語音頻道 ID
    await gameInstance.gatherPlayersAndMove(voiceChannelId);
 
    // 當操作完成後更新回應
    await ctx.editReply('狼人殺遊戲已開始，頻道創建完成，玩家已移動。');
};