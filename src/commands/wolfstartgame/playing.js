import { game } from './game.js';  // 導入共享的 game 實例

// 定義角色和陣營
const roleDistributions = {
    6: 
    {
        killers: 1, civilians: 2, police: 1, medium: 0, doctor: 0, agent: 0, hunter: 1, cowboy: 0, spy: 1, sniper: 0, terrorist: 0, vineDemon: 0, pope: 0, wraith: 0
    },
    7: 
    {
        killers: 2, civilians: 3, police: 1, medium: 0, doctor: 1, agent: 0, hunter: 0, cowboy: 0, spy: 0, sniper: 1, terrorist: 0, vineDemon: 0, pope: 0, wraith: 0
    },
    8: 
    {
        killers: 2, civilians: 2, police: 1, medium: 0, doctor: 1, agent: 0, hunter: 0, cowboy: 0, spy: 0, sniper: 1, terrorist: 0, vineDemon: 0, pope: 1, wraith: 1
    },
    9: 
    {
        killers: 2, civilians: 2, police: 1, medium: 1, doctor: 1, agent: 0, hunter: 0, cowboy: 0, spy: 0, sniper: 1, terrorist: 0, vineDemon: 0, pope: 0, wraith: 1
    },
    10:
    {
        killers: 2, civilians: 3, police: 1, medium: 1, doctor: 1, agent: 0, hunter: 0, cowboy: 0, spy: 0, sniper: 1, terrorist: 1, vineDemon: 0, pope: 0, wraith: 0
    },
    11:
    {
        killers: 2, civilians: 3, police: 1, medium: 1, doctor: 1, agent: 0, hunter: 0, cowboy: 0, spy: 0, sniper: 1, terrorist: 1, vineDemon: 0, pope: 1, wraith: 0
    }
};

// 分配角色
const assignRolesByPlayerCount = (playerCount) => {
    const roleConfig = roleDistributions[playerCount];
    if (!roleConfig) {
        throw new Error(`不支持的玩家數量: ${playerCount}`);
    }

    const allRoles = [
        ...Array(roleConfig.killers).fill('殺手'),
        ...Array(roleConfig.civilians).fill('平民'),
        ...Array(roleConfig.police).fill('警察'),
        ...Array(roleConfig.medium).fill('靈媒'),
        ...Array(roleConfig.doctor).fill('醫生'),
        ...Array(roleConfig.agent).fill('特工'),
        ...Array(roleConfig.hunter).fill('獵人'),
        ...Array(roleConfig.cowboy).fill('牛仔'),
        ...Array(roleConfig.spy).fill('間諜'),
        ...Array(roleConfig.sniper).fill('狙擊手'),
        ...Array(roleConfig.terrorist).fill('恐怖分子'),
        ...Array(roleConfig.vineDemon).fill('藤魔'),
        ...Array(roleConfig.pope).fill('教皇'),
        ...Array(roleConfig.wraith).fill('怨靈')
    ];

    // 隨機打亂角色順序
    const shuffledRoles = allRoles.sort(() => 0.5 - Math.random());

    // 將玩家與角色匹配，並初始化 alive 狀態
    const players = game.getPlayers();
    players.forEach((player, index) => {
        player.role = shuffledRoles[index];
        player.alive = true;  // 初始時所有玩家都是活著的
        console.log(`${player.user.username} 被分配到了角色: ${player.role}, 初始狀態: 存活`);
    });

    game.setPlayers(players);
};

// 設置勝利條件
const checkWinConditions = () => {
    const players = game.getPlayers();

    const killers = players.filter(player => player.role === '殺手' && player.alive);
    const policeAlive = players.some(player => player.role === '警察' && player.alive);
    const goodPlayers = players.filter(player => ['平民', '靈媒', '醫生', '特工', '獵人', '牛仔'].includes(player.role) && player.alive);
    const civilians = players.filter(player => player.role === '平民' && player.alive);

    // 勝利條件判斷
    if (killers.length === 0) {
        return '好人陣營勝利！所有殺手已被擊敗。';
    }

    if (policeAlive) {
        return null;  // 遊戲繼續，因為警察還活著
    }

    if (killers.length >= Math.ceil(goodPlayers.length / 2)) {
        return '殺手陣營勝利！好人陣營被消滅。';
    }

    // 第三方勝利條件檢查
    const neutralWin = players.some(player => {
        if (player.role === '怨靈' && !player.alive) {
            return true;  // 怨靈勝利條件：死亡且勝利
        }
        if (player.role === '教皇' && player.convertedPlayers.length >= 3) {
            return true;  // 教皇勝利條件：轉化三名玩家
        }
        return false;
    });

    if (neutralWin) {
        return '第三方陣營勝利！';
    }

    return null;  // 遊戲繼續
};

// 更新頻道權限
const updateChannelPermissions = async (guild) => {
    const players = game.getPlayers();

    players.forEach(async (player) => {
        // 給警察權限
        if (player.role === '警察' && player.alive) {
            await guild.channels.cache.find(c => c.name === '警察頻道').permissionOverwrites.edit(player.id, {
                VIEW_CHANNEL: true,
                SEND_MESSAGES: true
            });
        }
        else if (player.role === '警察' && !player.alive) {
            await guild.channels.cache.find(c => c.name === '警察頻道').permissionOverwrites.edit(player.id, {
                VIEW_CHANNEL: true,
                SEND_MESSAGES: false
            });
        }

        // 給殺手權限
        if (player.role === '殺手' && player.alive) {
            await guild.channels.cache.find(c => c.name === '殺手頻道').permissionOverwrites.edit(player.id, {
                VIEW_CHANNEL: true,
                SEND_MESSAGES: true
            });
        }
        else if (player.role === '殺手' && !player.alive) {
            await guild.channels.cache.find(c => c.name === '殺手頻道').permissionOverwrites.edit(player.id, {
                VIEW_CHANNEL: true,
                SEND_MESSAGES: false
            });
        }

        // 間諜初始不能訪問殺手頻道
        if (player.role === '間諜' && player.alive && player.hasDiscoveredKillers) {
            // 如果間諜查驗到了殺手，才給予訪問權限
            await guild.channels.cache.find(c => c.name === '殺手頻道').permissionOverwrites.edit(player.id, {
                VIEW_CHANNEL: true,
                SEND_MESSAGES: true
            });
        }

        // 給靈媒和怨靈權限，如果他們死了進入死人頻道
        if ((player.role === '靈媒' || player.role === '怨靈') && player.alive) {
            await guild.channels.cache.find(c => c.name === '死人頻道').permissionOverwrites.edit(player.id, {
                VIEW_CHANNEL: true,
                SEND_MESSAGES: false  // 不允許發言
            });
        }

        // 清理死去玩家的其他頻道權限
        if (!player.alive) {
            // 移除對所有活人頻道的權限，例如活人語音和活人頻道
            await guild.channels.cache.find(c => c.name === '活人頻道').permissionOverwrites.edit(player.id, {
                VIEW_CHANNEL: false,
                SEND_MESSAGES: false
            });

            await guild.channels.cache.find(c => c.name === '活人語音').permissionOverwrites.edit(player.id, {
                VIEW_CHANNEL: false,
                CONNECT: false
            });
            // 將死去玩家移動到死人頻道
            await guild.channels.cache.find(c => c.name === '死人頻道').permissionOverwrites.edit(player.id, {
                VIEW_CHANNEL: true,
                SEND_MESSAGES: false
            });
            await guild.channels.cache.find(c => c.name === '死人語音').permissionOverwrites.edit(player.id, {
                VIEW_CHANNEL: true,
                CONNECT: false
            });
            await player.voice.setChannel(guild.channels.cache.find(c => c.name === '死人語音'));
        }
    });
};

const spyDiscoversKiller = (spy, killer) => {
    // 間諜查驗到殺手後，更新間諜的狀態
    spy.hasDiscoveredKillers = true;

    // 更新間諜的頻道權限，讓他能進入殺手頻道
    updateChannelPermissions(spy.guild);

    console.log(`${spy.user.username} 已查驗到殺手 ${killer.user.username}，並加入了殺手頻道`);
};

const nightActions = (player, targetPlayer) => {
    if (player.role === '間諜' && targetPlayer.role === '殺手') {
        spyDiscoversKiller(player, targetPlayer);
    }
};
// 指令行為 - 初始化遊戲並分配角色
export const action = async (ctx) => {
    const { guild } = ctx;
    const playerCount = game.getPlayers().length;

    if (playerCount < 6 || playerCount > 9) {
        await ctx.reply('遊戲需要 6 到 9 名玩家。');
        return;
    }

    await ctx.reply('正在分配角色，請稍候...');

    // 初始化角色
    assignRolesByPlayerCount(playerCount);

    // 更新頻道權限
    await updateChannelPermissions(guild);

    await ctx.editReply('角色分配完成！所有玩家已被分配角色並更新頻道權限。');

    // 檢查遊戲勝利條件
    const winMessage = checkWinConditions();
    if (winMessage) {
        await ctx.followUp(winMessage);
    }
};