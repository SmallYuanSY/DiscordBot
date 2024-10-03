// game.js

class WerewolfGame {
    constructor(guild) {
        this.guild = guild;
        this.players = [];
    }

    // 設定玩家資料
    setPlayers(players) {
        this.players = players;
    }

    // 獲取玩家資料
    getPlayers() {
        return this.players;
    }
}

// 將 WerewolfGame 的實例導出
export const game = new WerewolfGame();