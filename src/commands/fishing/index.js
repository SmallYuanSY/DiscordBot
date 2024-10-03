import { SlashCommandBuilder, ButtonBuilder, ActionRowBuilder } from 'discord.js'; 
import fs from 'fs';
import { client } from '@/main.js';
import { getFishingResult } from './fishingLogic.js';
import * as backpack from './backpack.js';

export const command = new SlashCommandBuilder()
    .setName('fishing')
    .setDescription('釣魚');

// 新增函數：生成主選單
function generateMainMenu(playerConfig, userId, hexTime, weather, generatePlayerInfo) {
    const fishingButton = new ButtonBuilder()
        .setCustomId(`fishing-${userId}-${hexTime}`)
        .setLabel('釣魚')
        .setEmoji('🎣')
        .setStyle('Primary');
    const backpackButton = new ButtonBuilder()
        .setCustomId(`backpack-${userId}-${hexTime}`)
        .setLabel('背包')
        .setEmoji('<:Backpack:1287142986903326813>')
        .setStyle('Primary');
    const dailyRewardButton = new ButtonBuilder()
        .setCustomId(`daily-${userId}-${hexTime}`)
        .setLabel('每日獎勵')
        .setEmoji('🎁')
        .setStyle('Primary');
    const shopButton = new ButtonBuilder()
        .setCustomId(`FishingShop-${userId}-${hexTime}-shop`)
        .setLabel('商店')
        .setEmoji('🏪')
        .setStyle('Primary');
    const sellButton = new ButtonBuilder()
        .setCustomId(`FishingShop-${userId}-${hexTime}-sell`)
        .setLabel('魚販')
        .setEmoji('💰')
        .setStyle('Primary');

    let allComponents = [];
    const row1 = new ActionRowBuilder().addComponents(fishingButton, backpackButton, dailyRewardButton);
    const row2 = new ActionRowBuilder().addComponents(shopButton, sellButton);
    allComponents.push(row1, row2);

    // 檢查是否有船隻
    if (playerConfig.backpack.find(item => item.name === '木筏 <:Boat:1287270950618005536>')) {
        const shipButton = new ButtonBuilder()
            .setCustomId(`ship-${userId}-${hexTime}`)
            .setLabel('船隻')
            .setEmoji('<:Boat:1287270950618005536>')
            .setStyle('Primary');
        const row3 = new ActionRowBuilder().addComponents(shipButton);
        allComponents.push(row3);
    }

    let embed = {
        title: '<:fishing_hook:1286423885260263518> 釣魚 <:fishing_hook:1286423885260263518>',
        description: generatePlayerInfo(playerConfig, weather),
        fields: [
            {
                name: '背包概覽',
                value: `魚類: ${countItems(playerConfig.backpack, ['common', 'uncommon', 'rare', 'legendary', 'mythical'])}\n` +
                       `道具: ${countItems(playerConfig.backpack, ['unique'])}\n` +
                       `魚餌: ${countItems(playerConfig.backpack, [], 'bait')}\n` +
                       `特殊: ${countItems(playerConfig.backpack, ['special'])}`,
                inline: true
            }
        ]
    };

    return { embed, components: allComponents };
}

// 輔助函數：計算物品數量（從 backpack.js 複製過來）
function countItems(backpack, rarities, type = null) {
    let count = 0;
    backpack.forEach(item => {
        if ((rarities.length === 0 || rarities.includes(item.rarity)) && 
            (type === null || item.type === type)) {
            count += item.quantity || 1;
        }
    });
    return count.toString();
}

export const action = async (ctx) => {

    const member = ctx.member;
    const userId = ctx.user.id;
    const hexTime = Math.floor(Date.now() / 1000).toString(16);
    const userName = ctx.user.displayName;
    const guildId = ctx.guild.id;
    const dirPath = `src/config/${guildId}/fishing/playerdata/${userId}.json`;
    const weather = JSON.parse(fs.readFileSync('src/config/weatherStatus.json'));

    // 確保資料夾存在
    if (!fs.existsSync(`src/config/${guildId}/fishing/playerdata`)) {
        fs.mkdirSync(`src/config/${guildId}/fishing/playerdata`, { recursive: true });
    }

    let playerConfig;
    let replyMessage;

    // 如果玩家檔案不存在，初始化資料
    if (!fs.existsSync(dirPath)) {
        playerConfig = {
            userId: userId,
            userName: userName,
            level: 1,
            money: 0,
            experience: 0,
            currentRod: '初級釣竿 <:fishing_rod:1286423711385129041>',
            currentBiome: '淡水河',
            backpack: [],
            biome: 'River',
            canGoBiome: ["River"],
            timer: 0,
            lastDailyReward: -1
        };
        // 初始背包內容
        playerConfig.backpack.push({
            name: '初級釣竿 <:fishing_rod:1286423711385129041>',
            rarity: 'unique',
            experience: 0,
            quantity: 1
        });
        fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2));
    } else {
        playerConfig = JSON.parse(fs.readFileSync(dirPath));

    }

    // 回覆 Loading 的 embed
    let loadingEmbed = {
        title: '釣魚中...',
        description: '請稍後，正在進行操作...'
    };
    
    replyMessage = await ctx.reply({ embeds: [loadingEmbed] , ephemeral: false });
    setPlayerTime(userId, guildId);

    // 使用新函數生成初始 embed 和按鈕
    const { embed, components: allComponents } = generateMainMenu(playerConfig, userId, hexTime, weather, generatePlayerInfo);

    let timeout; // 定義 timeout 變量

    // 處理按鈕互動邏輯
    const handleInteraction = async (interaction) => {
        if (!interaction.isButton()) return;
        let playerConfig = JSON.parse(fs.readFileSync(dirPath));
        const currentTime = Math.floor(Date.now() / 1000);
        const playerTime = parseInt(playerConfig.hexTime, 16);

        const timeDiff = currentTime - playerTime;
        const formattedMoney = playerConfig.money.toLocaleString('en-US');

            // 確認互動是針對當前玩家的
            if (!interaction.customId.includes(`${userId}-${hexTime}`)) return;  // 更精簡的判斷
            if (interaction.user.id !== userId){
                await interaction.reply({
                    content: '這不是你的釣魚互動',
                    ephemeral: true
                });
                return;
            }
            // 延遲互動
            try {
                if (!interaction.deferred && !interaction.replied)
                {
                    await interaction.deferUpdate();
                } else {
                    console.log('Interaction already deferred or replied.');
                }
            }
            // 處理延遲互動失��
            catch (error) {
                if (error.status === 503){
                    console.error('誰告訴小元我的AI出問題了？');
                }
                else if (error.code === 10062)
                {
                    console.error('Unknown interaction: The interaction has expired or is invalid.');
                }
                else{
                    console.error('Failed to defer update:', error);
                }
                return;
            }

            // 14分鐘後清除互動
            if (timeDiff > 840) {
                await interaction.editReply({
                    content: '互動已過期，請重新使用指令。',
                    embeds: [],
                    components: [],
                    ephemeral: false
                });
                return;
            }

            // 釣魚按鈕邏輯
            if (interaction.customId === `fishing-${userId}-${hexTime}`) {
                const currentTime = Date.now();
                const lastFishTime = playerConfig.timer || 0;
                const cooldown = 5 * 1000; // 5 秒冷卻時間

                if (currentTime - lastFishTime < cooldown) {
                    const remainingTime = cooldown - (currentTime - lastFishTime);
                    const minutes = Math.floor(remainingTime / 60000);
                    const seconds = Math.floor((remainingTime % 60000) / 1000);

                    await interaction.editReply({
                        content: `還有 ${minutes > 0 ? `${minutes} 分 ` : ''}${seconds} 秒才能再次釣魚！`,
                        ephemeral: false,
                    });
                    return;
                }

                // 設置計時器
                playerConfig.timer = currentTime;

                try {
                    // 調用外部的釣魚邏輯，處理魚餌消耗
                    const { fishData, fishQuantity } = getFishingResult(playerConfig, guildId);

                    // 增加魚到背包
                    let existFish = playerConfig.backpack.find(item => item.name === fishData.name);
                    if (existFish) {
                        existFish.quantity += fishQuantity; // 增加數量
                    } else {
                        playerConfig.backpack.push({
                            name: fishData.name,
                            rarity: fishData.rarity,
                            experience: fishData.experience,
                            price: fishData.price,
                            quantity: fishQuantity // 新增數量
                        });
                    }

                    // 更新玩家經驗
                    playerConfig.experience += fishData.experience * fishQuantity;
                    
                    // 檢查是否升級
                    if (playerLevelUp(playerConfig)) {
                        embed.title = '⬆️ 等級提升 ⬆️';
                        embed.description = generatePlayerInfo(playerConfig, weather, `🎣<@${playerConfig.userId}> 釣了 ${fishData.name}！數量：${fishQuantity}`);
                    } else {
                        // 更新 embed 並回覆
                        embed.title = '<:fishing_hook:1286423885260263518> 釣魚 <:fishing_hook:1286423885260263518>';
                        embed.description = generatePlayerInfo(playerConfig, weather, `🎣<@${playerConfig.userId}> 釣到了 ${fishData.name}！數量：${fishQuantity}`);
                    }

                    // 更新玩家數據並保存
                    fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2));
                    await interaction.editReply({ embeds: [embed], components: allComponents, content: '', ephemeral: false });

                } catch (error) {
                    // 捕捉錯誤並返回給玩家
                    await interaction.editReply({
                        content: error.message,
                        ephemeral: true
                    });
                }
            }



            // 背包按鈕邏輯
            else if (interaction.customId === `backpack-${userId}-${hexTime}`) {
                const { embed, components } = backpack.handleBackpack(interaction, playerConfig, userId, hexTime, weather, generatePlayerInfo);
                await interaction.editReply({ embeds: [embed], components: components, content: '', ephemeral: false });
            }
            // 背包魚類按鈕邏輯
            else if (interaction.customId === `backpack-${userId}-${hexTime}-fish`) {
                const { embed, components } = backpack.handleFishItems(interaction, playerConfig, userId, hexTime);
                await interaction.editReply({ embeds: [embed], components: components, content: '', ephemeral: false });
            }
            // 背包道具按鈕邏輯
            else if (interaction.customId === `backpack-${userId}-${hexTime}-tools`) {
                const { embed, components } = backpack.handleToolItems(interaction, playerConfig, userId, hexTime);
                await interaction.editReply({ embeds: [embed], components: components, content: '', ephemeral: false });
            }
            // 背包魚餌按鈕邏輯
            else if (interaction.customId === `backpack-${userId}-${hexTime}-bait`) {
                const { embed, components } = backpack.handleBaitItems(interaction, playerConfig, userId, hexTime);
                await interaction.editReply({ embeds: [embed], components: components, content: '', ephemeral: false });
            }
            // 背包處理釣竿切換邏輯
            else if (interaction.customId.startsWith(`backpack-${userId}-${hexTime}-select-rod`)) {
                const { embed } = backpack.handleRodSelection(interaction, playerConfig, userId, hexTime, dirPath, generatePlayerInfo, weather);
                await interaction.editReply({ embeds: [embed], components: allComponents, content: '', ephemeral: false });
            }
            // 背包魚餌切換邏輯
            else if (interaction.customId.startsWith(`backpack-${userId}-${hexTime}-select-bait`)) {
                const { embed } = backpack.handleBaitSelection(interaction, playerConfig, userId, hexTime, dirPath, generatePlayerInfo, weather);
                await interaction.editReply({ embeds: [embed], components: allComponents, content: '', ephemeral: false });
            }
            // 背包特殊物品按鈕邏輯
            else if (interaction.customId === `backpack-${userId}-${hexTime}-special`) {
                const { embed } = backpack.handleSpecialItems(interaction, playerConfig, userId, hexTime);
                await interaction.editReply({ embeds: [embed], components: allComponents, content: '', ephemeral: false });
            }
            // 背包返回按鈕邏輯
            else if (interaction.customId === `backpack-${userId}-${hexTime}-return`) {
                // 使用 generateMainMenu 函數返回主選單
                const { embed, components } = generateMainMenu(playerConfig, userId, hexTime, weather, generatePlayerInfo);
                await interaction.editReply({ embeds: [embed], components: components, content: '', ephemeral: false });
            }



            // 每日獎勵按鈕邏輯
            else if (interaction.customId === `daily-${userId}-${hexTime}`) {
                // 讀取每日獎勵的 json 文件
                const dailyRewards = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/dailyreward.json`));
            
                // 獲取當前伺服器日期
                const currentDate = new Date();
                const currentDay = currentDate.getDay(); // 0 是星期日，1 是星期一，依此類推
                const formattedDate = currentDate.toISOString().slice(0, 10);
                // 獲取玩家最後獎勵日期
                const playerDailyTime = playerConfig.lastDailyReward;
                
                // 檢查玩家是否已經領取過獎勵
                if (formattedDate === playerDailyTime) {
                    await interaction.editReply({ content: '你今天已經領取過獎勵了！', ephemeral: false });
                    return;
                }
                else {
                    // 更新玩家的最後獎勵日期
                    playerConfig.lastDailyReward = formattedDate;
                    // 根據當前星期獲取獎勵
                    const todayReward = dailyRewards[currentDay];
                
                    // 獎勵金額
                    const rewardAmount = todayReward.money;
                    playerConfig.money += rewardAmount;
                
                    // 發放道具
                    todayReward.items.forEach(item => {
                        let existItem = playerConfig.backpack.find((backpackItem) => backpackItem.name === item.name);
                        if (existItem) {
                            existItem.quantity += item.quantity;
                        } else {
                            playerConfig.backpack.push({
                                name: item.name,
                                rarity: item.rarity,
                                experience: item.experience,
                                price: item.price,
                                quantity: item.quantity
                                
                            });
                        }
                    });
                
                    // 更新玩家的數據
                    fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2));
                
                    // 組織獎勵的訊息
                    let rewardMessage = `每日獎勵已領取，您獲得了 ${rewardAmount} 元！`;
                
                    if (todayReward.items.length > 0) {
                        let itemsMessage = todayReward.items.map(item => `${item.name} x${item.quantity}`).join(', ');
                        rewardMessage += ` 並且獲得了道具：${itemsMessage}`;
                    }
                    // 回應玩家
                    await interaction.editReply({ content: rewardMessage, ephemeral: false });
                    }
                
            }

            // 船隻按鈕邏輯
            else if (interaction.customId === `ship-${userId}-${hexTime}`) {
                // 生成船隻的嵌入信息
                let shipEmbed = {
                    title: '<:Boat:1287270950618005536> 船隻 <:Boat:1287270950618005536>',
                    description: '選擇你想到的地區：',
                    fields: []
                };
                let allComponents = [];
                let currentRow = new ActionRowBuilder();

                // 添加船隻按鈕
                if (playerConfig.backpack.find(item => item.name === '木筏 <:Boat:1287270950618005536>')) {
                    currentRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`ship-${userId}-${hexTime}-淡水河`)
                            .setLabel('淡水河')
                            .setEmoji('<:river:1287304740840931348>')
                            .setStyle('Primary'),
                        new ButtonBuilder()
                            .setCustomId(`ship-${userId}-${hexTime}-寶貝湖`)
                            .setLabel('寶貝湖')
                            .setEmoji('<:Poke:1287305517965770823>')
                            .setStyle('Primary')
                    );
                }
                if (playerConfig.backpack.find(item => item.name === '小船 <:boat_adv:1287831014785421393>')) {
                    currentRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`ship-${userId}-${hexTime}-海洋`)
                            .setLabel('海洋')
                            .setEmoji('<:ocean:1287832034479181854>')
                            .setStyle('Primary')
                    );
                }

                // 添加返回按鈕
                const backButtonRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ship-${userId}-${hexTime}-back`)
                        .setLabel('返回')
                        .setStyle('Secondary')
                );
                allComponents.push(currentRow);

                // 發送船隻選擇
                await interaction.editReply({
                    embeds: [shipEmbed],
                    components: [...allComponents, backButtonRow],
                    content: '',
                    ephemeral: false
                });
            }
            // 船隻處理地區切換邏輯
            else if (interaction.customId.startsWith(`ship-${userId}-${hexTime}-`)) {
                if (interaction.customId !== `ship-${userId}-${hexTime}-back`) {
                    playerConfig.currentBiome = interaction.customId.split(`ship-${userId}-${hexTime}-`)[1];
                    if (playerConfig.currentBiome === '淡水河') {
                        playerConfig.biome = 'river';
                    }
                    else if (playerConfig.currentBiome === '寶貝湖') {
                        playerConfig.biome = 'Pokemon';
                    }
                    else if (playerConfig.currentBiome === '海洋') {
                        playerConfig.biome = 'ocean';
                    }
                    fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2)); // 保存配置
                    embed.title = '<:Boat:1287270950618005536> 船隻切換成功 <:Boat:1287270950618005536>';
                    embed.description = generatePlayerInfo(playerConfig, weather, `🎣<@${playerConfig.userId}> 你已經切換到 ${playerConfig.currentBiome}！`);
                }
                await interaction.editReply({ embeds: [embed], components: allComponents, content: '', ephemeral: false });
            }
            // 船隻返回按鈕邏輯
            else if (interaction.customId === `ship-${userId}-${hexTime}-back`) {
                // 返回主選單
                embed.title = '<:fishing_hook:1286423885260263518> 釣魚 <:fishing_hook:1286423885260263518>';
                embed.description = generatePlayerInfo(playerConfig, weather);
                await interaction.editReply({ embeds: [embed], components: allComponents, content: '', ephemeral: false });
            }


            // 購買商店按鈕邏輯
            else if (interaction.customId === `FishingShop-${userId}-${hexTime}-shop`) {
            
                // 生成釣和魚餌的嵌入信息
                let shopEmbed = {
                    title: '<:fishing_hook:1286423885260263518> 商店 <:fishing_hook:1286423885260263518>',
                    description: '選擇你想購買的類別：',
                    fields: []
                };
            
                // ��始化按鈕行表
                let allComponents = [];
                let currentRow = new ActionRowBuilder();
            
                // 添加分類按鈕
                currentRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`FishingShop-${userId}-${hexTime}-rods`)
                        .setLabel('釣竿')
                        .setEmoji('<:fishing_rod:1286423711385129041>')
                        .setStyle('Primary'),
                    new ButtonBuilder()
                        .setCustomId(`FishingShop-${userId}-${hexTime}-bait`)
                        .setLabel('魚餌')
                        .setEmoji('<:worm:1286420915772719237>')
                        .setStyle('Primary'),
                    new ButtonBuilder()
                        .setCustomId(`FishingShop-${userId}-${hexTime}-boat`)
                        .setLabel('船隻')
                        .setEmoji('<:Boat:1287270950618005536>')
                        .setStyle('Primary')
                );
                
                allComponents.push(currentRow);
            
                // 添加返回按鈕
                const backButtonRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`FishingShop-${userId}-${hexTime}-back`)
                        .setLabel('返回')
                        .setStyle('Secondary')
                );
            
                // 發送分類選擇
                await interaction.editReply({
                    embeds: [shopEmbed],
                    components: [...allComponents, backButtonRow],
                    content: '',
                    ephemeral: false
                });
            }
            // 購買商店處理釣竿類別
            else if (interaction.customId === `FishingShop-${userId}-${hexTime}-rods`) {
                const rodsData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/rods.json`));
                const playerlevel = playerConfig.level;
                // 過濾玩家等級合適的釣竿
                const rodItems = rodsData.rods.filter(item => item.requiredLevel <= playerlevel);
            
                let rodEmbed = {
                    title: '<:fishing_rod:1286423711385129041> 釣竿 <:fishing_rod:1286423711385129041>',
                    description: '購買你需要的釣竿來釣魚！',
                    fields: []
                };
            
                let allComponents = [];
                let currentRow = new ActionRowBuilder();
                let buttonCount = 0;
            
                rodItems.forEach(item => {
                    rodEmbed.fields.push({
                        name: `${item.name} - $${item.sellPrice}`,
                        value: item.description,
                        inline: true
                    });
            
                    // 添加商品的按鈕
                    const button = new ButtonBuilder()
                        .setCustomId(`FishingShop-${userId}-${hexTime}-buy-${removeEmoji(item.id)}`)
                        .setLabel(`購買 ${removeEmoji(item.name)}`)
                        .setStyle('Primary');
            
                    const emoji = getEmoji(item.name);
                    if (emoji) {
                        button.setEmoji(emoji); // 如果有 emoji 就添加
                    }
            
                    currentRow.addComponents(button);
                    buttonCount++;
            
                    // 每 5 個按鈕換一行
                    if (buttonCount === 5) {
                        allComponents.push(currentRow);
                        currentRow = new ActionRowBuilder();
                        buttonCount = 0;
                    }
                });
            
                // 添加最後一行按鈕
                if (buttonCount > 0) {
                    allComponents.push(currentRow);
                }
            
                // 添加返回按鈕
                const backButtonRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`FishingShop-${userId}-${hexTime}-shop`)
                        .setLabel('返回')
                        .setStyle('Secondary')
                );
            
                // 發送釣竿信息與按鈕
                await interaction.editReply({
                    embeds: [rodEmbed],
                    components: [...allComponents, backButtonRow],
                    content: '',
                    ephemeral: false
                });
            }
            // 購買商店處理魚餌類別
            else if (interaction.customId === `FishingShop-${userId}-${hexTime}-bait`) {
                const baitData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/bait.json`));
                const playerlevel = playerConfig.level;
                // 過濾玩家等級合適的魚餌
                const baitItems = baitData.baits.filter(item => item.requiredLevel <= playerlevel);
            
                let baitEmbed = {
                    title: '<:worm:1286420915772719237> 魚餌 <:worm:1286420915772719237>',
                    description: '購買魚餌來進行釣魚！',
                    fields: []
                };
            
                let allComponents = [];
                let currentRow = new ActionRowBuilder();
                let buttonCount = 0;
            
                baitItems.forEach(item => {
                    baitEmbed.fields.push({
                        name: `${item.name} - $${item.sellPrice}`,
                        value: item.description,
                        inline: true
                    });
            
                    // 添加商品的按鈕
                    const button = new ButtonBuilder()
                        .setCustomId(`FishingShop-${userId}-${hexTime}-buy-${removeEmoji(item.id)}`)
                        .setLabel(`購買 ${removeEmoji(item.name)}`)
                        .setStyle('Primary');
            
                    const emoji = getEmoji(item.name);
                    if (emoji) {
                        button.setEmoji(emoji); // 如果有 emoji 就添加
                    }
            
                    currentRow.addComponents(button);
                    buttonCount++;
            
                    // 每 5 個按鈕換一行
                    if (buttonCount === 5) {
                        allComponents.push(currentRow);
                        currentRow = new ActionRowBuilder();
                        buttonCount = 0;
                    }
                });
            
                // 添加最後一行按鈕
                if (buttonCount > 0) {
                    allComponents.push(currentRow);
                }
            
                // 添加返回按鈕
                const backButtonRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`FishingShop-${userId}-${hexTime}-shop`)
                        .setLabel('返回')
                        .setStyle('Secondary')
                );
            
                // 發送魚餌信息與按鈕
                await interaction.editReply({
                    embeds: [baitEmbed],
                    components: [...allComponents, backButtonRow],
                    content: '',
                    ephemeral: false
                });
            }
            // 購買商店處理魚船類別
            else if (interaction.customId === `FishingShop-${userId}-${hexTime}-boat`) {
                const boatData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/boat.json`));
                const playerlevel = playerConfig.level;
                // 用物品type來過濾船隻
                const boatItems = boatData.boat.filter(item => item.requiredLevel <= playerlevel);
            
                let boatEmbed = {
                    title: '<:Boat:1287270950618005536> 船隻 <:Boat:1287270950618005536>',
                    description: '購買船隻來進行釣魚！',
                    fields: []
                };
            
                let allComponents = [];
                let currentRow = new ActionRowBuilder();
                let buttonCount = 0;
            
                boatItems.forEach(item => {
                    boatEmbed.fields.push({
                        name: `${item.name} - $${item.sellPrice}`,
                        value: item.description,
                        inline: true
                    });
            
                    // 添加商品的按鈕
                    const button = new ButtonBuilder()
                        .setCustomId(`FishingShop-${userId}-${hexTime}-buy-${removeEmoji(item.id)}`)
                        .setLabel(`購買 ${removeEmoji(item.name)}`)
                        .setStyle('Primary');
            
                    const emoji = getEmoji(item.name);
                    if (emoji) {
                        button.setEmoji(emoji); // 如果有 emoji 就添加
                    }
            
                    currentRow.addComponents(button);
                    buttonCount++;
            
                    // 每 5 個按鈕換一行
                    if (buttonCount === 5) {
                        allComponents.push(currentRow);
                        currentRow = new ActionRowBuilder();
                        buttonCount = 0;
                    }
                });
            
                // 添加最後一行按鈕
                if (buttonCount > 0) {
                    allComponents.push(currentRow);
                }
            
                // 添加返回按鈕
                const backButtonRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`FishingShop-${userId}-${hexTime}-shop`)
                        .setLabel('返回')
                        .setStyle('Secondary')
                );
            
                // 發送魚信息與按鈕
                await interaction.editReply({
                    embeds: [boatEmbed],
                    components: [...allComponents, backButtonRow],
                    content: '',
                    ephemeral: false
                });
            }
            // 購買商品按鈕邏輯
            else if (interaction.customId.startsWith(`FishingShop-${userId}-${hexTime}-buy`)) {
                const itemIdInCustomId = interaction.customId.split('-').slice(4).join('-'); // 提取 item 的 ID
                let item = null;
            
                // 檢查是否是釣竿購買
                if (interaction.customId.includes('rod')) {
                    const rodsData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/rods.json`));
                    item = rodsData.rods.find(i => i.id === itemIdInCustomId);
                }
                // 檢查是否是魚餌購買
                else if (interaction.customId.includes('bait')) {
                    const baitData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/bait.json`));
                    item = baitData.baits.find(i => i.id === itemIdInCustomId);
                }
                // 檢查是否是船隻購買
                else if (interaction.customId.includes('boat')) {
                    const boatData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/boat.json`));
                    item = boatData.boat.find(i => i.id === itemIdInCustomId);
                }
            
                // 如果沒有找到商品，返回錯誤訊息
                if (!item) {
                    await interaction.editReply({ content: '找不到該物品！', ephemeral: false });
                    return;
                }
            
                // 檢查玩家是否有足夠的金錢
                if (playerConfig.money >= item.sellPrice) {
                    playerConfig.money -= item.sellPrice;
                    
                    // 將商品添加到玩家背包
                    let existItem = playerConfig.backpack.find(i => i.name === item.name);
                    if (existItem) {
                        existItem.quantity += item.quantity;
                    } else {
                        playerConfig.backpack.push({
                            name: item.name,
                            type: item.type,
                            rarity: item.rarity,
                            experience: item.experience || 0,  // 魚餌可能沒有經驗屬性，預設為 0
                            price: item.price,
                            quantity: item.quantity || 1  // 如果商品沒有設置數量，預設為 1
                        });
                    }
            
                    // 更新玩家資料
                    fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2));
                    playerConfig = JSON.parse(fs.readFileSync(dirPath));
            
                    await interaction.editReply({
                        content: `你購買了 ${item.name}！`,
                        ephemeral: false
                    });
                } else {
                    await interaction.editReply({
                        content: `你的金錢不足以購買 ${item.name}！`,
                        ephemeral: false
                    });
                }
            }


            // 販賣魚類按鈕邏輯
            else if (interaction.customId === `FishingShop-${userId}-${hexTime}-sell`) {
                // 從玩家的背包中獲取魚
                const playerData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/playerdata/${userId}.json`));
                let sellableFish = playerData.backpack.filter(item => item.rarity !== 'unique' && item.rarity !== 'mythical') // 過濾掉稀有度為 unique跟 mythical 的魚

                if (sellableFish.length === 0) {
                    await interaction.editReply({ content: '你沒有可以賣的魚！', ephemeral: false });
                    return;
                }

                // 生成賣魚的按鈕
                let sellFishEmbed = {
                    title: '<:fishing_hook:1286423885260263518> 賣魚 <:fishing_hook:1286423885260263518>',
                    description: '選擇你想賣的魚！',
                    fields: []
                };

                let currentRow = new ActionRowBuilder();
                let allComponents = [];
                let buttonCount = 0;

                sellableFish.forEach(fish => {
                    sellFishEmbed.fields.push({
                        name: `${fish.name} x${fish.quantity}`,
                        value: `價格: ${fish.price} x ${fish.quantity} = $${fish.price * fish.quantity}`,
                        inline: true
                    });

                    

                    // 添加魚的按鈕
                    const button = new ButtonBuilder()
                        .setCustomId(`FishingShop-${userId}-${hexTime}-sell-${fish.name}`)
                        .setLabel(removeEmoji(fish.name))
                        .setStyle('Secondary');

                    const emoji = getEmoji(fish.name);
                    if (emoji) {
                        button.setEmoji(emoji); // 如果有emoji就添加
                    }

                    currentRow.addComponents(button);
                    buttonCount++;

                    // 每5個按鈕，創建新的ActionRow
                    if (buttonCount === 5) {
                        allComponents.push(currentRow);
                        currentRow = new ActionRowBuilder(); // 創建新的行
                        buttonCount = 0;
                    }
                });

                // 如果還有剩餘的按鈕，將剩下的行添加到allComponents
                if (buttonCount > 0) {
                    allComponents.push(currentRow);
                }

                // 最後添加返回按鈕，不會重複
                const backButton = new ButtonBuilder()
                    .setCustomId(`FishingShop-${userId}-${hexTime}-back`)
                    .setLabel('返回')
                    .setStyle('Secondary');

                let backButtonRow = new ActionRowBuilder().addComponents(backButton);
                allComponents.push(backButtonRow);

                // 回覆結果
                await interaction.editReply({
                    embeds: [sellFishEmbed],
                    components: allComponents,
                    content: '',
                    ephemeral: false
                });
            }
            // 販賣出魚的邏輯
            else if (interaction.customId.startsWith(`FishingShop-${userId}-${hexTime}-sell`)) {
                const playerData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/playerdata/${userId}.json`));
                const fishName = interaction.customId.split('-')[4]; // 提取魚的名稱
                let fishItem = playerData.backpack.find(item => item.name === fishName);

                if (fishItem) {
                    // 賣魚並賺取金錢
                    const fishPrice = fishItem.quantity * fishItem.price;
                    playerData.money += fishPrice;

                    // 從背包中移除魚
                    playerData.backpack = playerData.backpack.filter(item => item.name !== fishName);
                    fs.writeFileSync(`src/config/${guildId}/fishing/playerdata/${userId}.json`, JSON.stringify(playerData, null, 2));
                    playerConfig = JSON.parse(fs.readFileSync(dirPath));
                    
                    await interaction.editReply({
                        content: `你賣出了 ${fishItem.quantity} 條 ${fishName}，並獲得 $${fishPrice}！`,
                        ephemeral: false
                    });
                }
            }
            // 返回按鈕邏輯
            else if (interaction.customId.startsWith(`FishingShop-${userId}-${hexTime}-back`)) {
                // 返回主頁
                let mainEmbed = {
                    title: '<:fishing_hook:1286423885260263518> 釣魚 <:fishing_hook:1286423885260263518>',
                    description: generatePlayerInfo(playerConfig, weather),
                };
                await interaction.editReply({ embeds: [mainEmbed], components: allComponents, content: '', ephemeral: false });
            }

            // 觸發互動後重置計時器
            if (timeout) {
                clearTimeout(timeout); // 清除之前的計時器
            }

            // 設定新的計時器
            timeout = setTimeout(async () => {
                // 關閉互動監聽
                client.off('interactionCreate', handleInteraction);
        
                try {
                    // 使用 await 確保正確獲取回應
                    const replyMessage = await ctx.fetchReply();
                    console.log(replyMessage.id);
            
                    // 修改回應訊息，使用 ctx.editReply 來處理互動回應
                    await ctx.editReply({
                        embeds: [],
                        components: [],
                        content: '釣魚事件失效，請重新輸入',
                        ephemeral: false
                    });
                    
                    // 設定另一個計時器，在3秒後刪除訊息
                    setTimeout(async () => {
                        try {
                            // 確保正確獲取回應訊息並刪除
                            const deleteMessage = await ctx.fetchReply();
                            await deleteMessage.delete();
                        } catch (deleteError) {
                            console.error("刪除訊息時發生錯誤：", deleteError);
                        }
                    }, 3000); // 3秒後刪除訊息
                } catch (error) {
                    console.error("處理超時時發生錯誤：", error);
                }
            }, 840000); // 14分鐘（840000毫秒）的計時器
    };

    client.on('interactionCreate', handleInteraction);

    try {
        // 初次設置計時器
        timeout = setTimeout(() => {
            client.off('interactionCreate', handleInteraction);
            if (!ctx.replied && !ctx.deferred) {
                ctx.editReply({
                    embeds: [], 
                    components: [], 
                    content: '你這次的魚塘已經過期，請重新輸入/fishing', 
                    ephemeral: false
                });
            }
        }, 6000); // 6秒的計時器
    } catch (error) {
        console.error("設置初始計時器時發生錯誤：", error);
    }

    await ctx.editReply({ embeds: [embed], components: allComponents, ephemeral: false });
};

function removeEmoji(text) {
    return text.replace(/<:[a-zA-Z0-9_]+:[0-9]+>/g, '').trim();
}

function getEmoji(text) {
    const match = text.match(/<:[a-zA-Z0-9_]+:[0-9]+>/);
    return match ? match[0] : null; // 保護機製：避免沒有emoji的情況報錯
}

function playerLevelUp(playerConfig) {
    // 每級需要的經驗
    const level_1 = 0;
    const level_2 = 1000;
    const level_3 = 8000;
    const level_4 = 16000;
    const level_5 = 32000;
    const level_6 = 64000;
    const level_7 = 256000;
    const level_8 = 512000;
    const level_9 = 1024000;
    const level_10 = 8192000;
    // 獲取玩家當前等級
    let currentLevel = playerConfig.level;
    let currentExperience = playerConfig.experience;
    
    // 升級條件
    let levelUpConditions = {
        1: level_1,
        2: level_2,
        3: level_3,
        4: level_4,
        5: level_5,
        6: level_6,
        7: level_7,
        8: level_8,
        9: level_9,
        10: level_10
    };
    // 獲取下一級所需經驗
    let nextLevelExperience = levelUpConditions[currentLevel + 1];
    // 如果經驗足夠升級
    if (currentExperience >= nextLevelExperience) {
        playerConfig.level += 1;
        playerConfig.experience = 0;
        return true;
    }
}

function generatePlayerInfo(playerConfig, weather, extraMessage = '') {

    const currentBaitItem = playerConfig.backpack.find(item => item.name === playerConfig.currentBait);
    let baitQuantity = 0;
    let baitMessage = '玩家目前沒有魚餌';

    if (currentBaitItem) {
        baitQuantity = currentBaitItem ? currentBaitItem.quantity : 0;
        baitMessage = `${playerConfig.currentBait} x${baitQuantity}`;
    }

    return `
        玩家： <@${playerConfig.userId}>
        金錢： $${playerConfig.money.toLocaleString('en-US')}
        等級： Level ${playerConfig.level}
        經驗： ${playerConfig.experience} xp
        目前裝備釣竿： ${playerConfig.currentRod}
        目前裝備魚餌： ${baitMessage}
        目前生態域： ${playerConfig.currentBiome}
        天氣： ${weather.condition} ${weather.temperature}°C
        ${extraMessage}
    `;
}

// 在玩家身上設置時間戳
export const setPlayerTime = (userId, guildId) => {
    const traggerTime = Math.floor(Date.now() / 1000);
    const hexTime = traggerTime.toString(16);
    const dirPath = `src/config/${guildId}/fishing/playerdata/${userId}.json`;
    let playerConfig = JSON.parse(fs.readFileSync(dirPath));
    playerConfig.hexTime = hexTime;
    fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2));
};