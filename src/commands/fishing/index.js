import { SlashCommandBuilder, ButtonBuilder, ActionRowBuilder } from 'discord.js'; 
import fs from 'fs';
import { client } from '@/main.js';
import { getFishingResult, checkPetFishing, processPetFishingResult, autoPetFishing } from './fishingLogic.js';
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
    const petButton = new ButtonBuilder()
        .setCustomId(`pet-${userId}-${hexTime}`)
        .setLabel('寵物')
        .setEmoji('🐾')
        .setStyle('Primary');

    let allComponents = [];
    const row1 = new ActionRowBuilder().addComponents(fishingButton, backpackButton, dailyRewardButton);
    const row2 = new ActionRowBuilder().addComponents(shopButton, sellButton, petButton);
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

// 在文件頂部添加這個函數
async function safeReply(interaction, content) {
    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply(content);
        } else {
            await interaction.reply(content);
        }
    } catch (error) {
        console.error("回覆訊息時發生錯誤：", error);
        // 如果回覆失敗，我們不再嘗試其他操作
    }
}

// 在文件頂部添加這個變量
let isFishing = false;

// 在文件的頂部，其他函數定義的地方添加這個函數
function generateSellButtons(sellableFish, userId, hexTime) {
    let allComponents = [];
    let buttonCount = 0;

    for (let i = 0; i < sellableFish.length; i++) {
        const fish = sellableFish[i];
        if (buttonCount % 5 === 0) {
            allComponents.push(new ActionRowBuilder());
        }

        // 添加魚的按鈕
        const button = new ButtonBuilder()
            .setCustomId(`FishingShop-${userId}-${hexTime}-sell-${i}`) // 使用索引作為唯一標識符
            .setLabel(removeEmoji(fish.name))
            .setStyle('Secondary');

        const emoji = getEmoji(fish.name);
        if (emoji) {
            button.setEmoji(emoji); // 如果有emoji就添加
        }

        allComponents[Math.floor(buttonCount / 5)].addComponents(button);
        buttonCount++;
    }

    // 添加返回按鈕
    const backButton = new ButtonBuilder()
        .setCustomId(`FishingShop-${userId}-${hexTime}-back`)
        .setLabel('返回')
        .setStyle('Secondary');

    if (buttonCount % 5 === 0) {
        allComponents.push(new ActionRowBuilder());
    }
    allComponents[Math.floor(buttonCount / 5)].addComponents(backButton);

    return allComponents;
}

// 在文件頂部添加這個函數
function generateBuyButtons(userId, hexTime, itemId, currentQuantity, maxQuantity) {
    const quantities = [1, 5, 10, 20, 50];
    let rows = [];

    // 增加按鈕
    let increaseRow = new ActionRowBuilder();
    quantities.forEach(q => {
        if (currentQuantity + q <= maxQuantity) {
            increaseRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`FishingShop-${userId}-${hexTime}-increase-${itemId}-${q}`)
                    .setLabel(`+${q}`)
                    .setStyle('Primary')
            );
        }
    });
    if (increaseRow.components.length > 0) rows.push(increaseRow);

    // 減少按鈕
    let decreaseRow = new ActionRowBuilder();
    quantities.forEach(q => {
        if (currentQuantity - q >= 1) {
            decreaseRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`FishingShop-${userId}-${hexTime}-decrease-${itemId}-${q}`)
                    .setLabel(`-${q}`)
                    .setStyle('Danger')
            );
        }
    });
    if (decreaseRow.components.length > 0) rows.push(decreaseRow);

    // 購買和取消按鈕
    let actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`FishingShop-${userId}-${hexTime}-confirm-${itemId}`)
                .setLabel('購買')
                .setStyle('Success'),
            new ButtonBuilder()
                .setCustomId(`FishingShop-${userId}-${hexTime}-cancel`)
                .setLabel('取消')
                .setStyle('Secondary')
        );
    rows.push(actionRow);

    return rows;
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
        
        // 每次互動時重新讀取玩家資料
        let playerConfig = JSON.parse(fs.readFileSync(dirPath));
        const currentTime = Math.floor(Date.now() / 1000);
        const playerTime = parseInt(playerConfig.hexTime, 16);

        const timeDiff = currentTime - playerTime;
        const formattedMoney = playerConfig.money.toLocaleString('en-US');

            // 確認互動是針對前玩家
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
            // 處理延遲互動失效
            catch (error) {
                if (error.status === 503){
                    console.error('誰告訴小元我的AI出問題了？');
                }
                else if (error.code === 10062)
                {
                    console.error('Unknown interaction: The interaction has expired or is invalid.');
                }
                else if (error.code === 50027)
                {
                    console.error('誰告訴小元我AI出問題了？');
                }
                else{
                    console.error('Failed to defer update:', error);
                }
                return;
            }

            // 14分鐘後清除動
            if (timeDiff > 840) {
                await interaction.editReply({
                    content: '互動已過期，請重使用指令。',
                    embeds: [],
                    components: [],
                    ephemeral: false
                });
                return;
            }

            // 檢查並執行自動釣魚
            if (playerConfig.hasPet) {
                const autoPetResult = autoPetFishing(playerConfig, guildId);
                if (autoPetResult) {
                    // 更新玩家數據
                    fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2));
                    console.log('寵物自動釣魚完成');
                }
            }

            // 釣魚按鈕邏輯
            if (interaction.customId === `fishing-${userId}-${hexTime}`) {
                if (isFishing) {
                    await safeReply(interaction, {
                        content: `釣魚操作正在進行中，請稍後再試！`,
                        ephemeral: true,
                    });
                    return;
                }

                const currentTime = Date.now();
                const lastFishTime = playerConfig.timer || 0;
                const cooldown = 5 * 1000; // 5 秒冷卻時間

                if (currentTime - lastFishTime < cooldown) {
                    const remainingTime = cooldown - (currentTime - lastFishTime);
                    const seconds = Math.ceil(remainingTime / 1000);
                    await safeReply(interaction, {
                        content: `還有 ${seconds} 秒才能再次釣魚！`,
                        ephemeral: true,
                    });
                    return;
                }

                isFishing = true;

                try {
                    const result = await getFishingResult(playerConfig, guildId);

                    if (result.isPet) {
                        // 處理釣到寵物的情況
                        let existPet = playerConfig.backpack.find(item => item.id === result.petData.id && item.type === 'pet');
                        if (existPet) {
                            existPet.quantity += 1;
                        } else {
                            playerConfig.backpack.push({
                                id: result.petData.id,
                                name: result.petData.name,
                                type: 'pet',
                                rarity: result.petData.rarity,
                                time: result.petData.time,
                                quantity: 1
                            });
                        }

                        embed.title = '🎉 釣到寵物了！ 🎉';
                        embed.description = generatePlayerInfo(playerConfig, weather, 
                            `🎣<@${playerConfig.userId}> 釣到了寵物 ${result.petData.emoji} ${result.petData.name}！`
                        );
                    } else {
                        // 原有的釣魚邏輯
                        const { fishData, fishQuantity } = result;

                        // 增加魚到背包
                        let existFish = playerConfig.backpack.find(item => item.name === fishData.name);
                        if (existFish) {
                            existFish.quantity += fishQuantity;
                        } else {
                            playerConfig.backpack.push({
                                name: fishData.name,
                                rarity: fishData.rarity,
                                experience: fishData.experience,
                                price: fishData.price,
                                quantity: fishQuantity
                            });
                        }

                        // 更新玩家經驗
                        playerConfig.experience += fishData.experience * fishQuantity;
                        
                        // 檢查是否級
                        const leveledUp = playerLevelUp(playerConfig);

                        // 更新 embed
                        embed.title = leveledUp ? '⬆️ 等級提升 ⬆️' : '<:fishing_hook:1286423885260263518> 釣魚 <:fishing_hook:1286423885260263518>';
                        embed.description = generatePlayerInfo(playerConfig, weather, 
                            `🎣<@${playerConfig.userId}> 釣到了 ${fishData.name}！數量：${fishQuantity}` +
                            (leveledUp ? '\n恭喜你升級了！' : '')
                        );
                    }

                    // 更新計時器
                    playerConfig.timer = Date.now();
                    
                    // 更新玩家數據並保存
                    fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2));

                    // 更新主選單
                    const { components: updatedComponents } = generateMainMenu(playerConfig, userId, hexTime, weather, generatePlayerInfo);

                    await interaction.editReply({ 
                        embeds: [embed], 
                        components: updatedComponents, 
                        content: '', 
                        ephemeral: false 
                    });

                } catch (error) {
                    await safeReply(interaction, {
                        content: error.message,
                        ephemeral: true
                    });
                } finally {
                    isFishing = false;
                }
            }



            // 背包按鈕邏輯
            else if (interaction.customId === `backpack-${userId}-${hexTime}`) {
                const { embed, components } = backpack.handleBackpack(interaction, playerConfig, userId, hexTime, weather, generatePlayerInfo);
                await interaction.editReply({ embeds: [embed], components: components, content: '', ephemeral: false });
            }
            // 包魚類按鈕邏輯
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
                
                // 使用 generateMainMenu 函數重新生成主選單
                const { components: updatedComponents } = generateMainMenu(playerConfig, userId, hexTime, weather, generatePlayerInfo);
                
                await interaction.editReply({ 
                    embeds: [embed], 
                    components: updatedComponents, 
                    content: '', 
                    ephemeral: false 
                });
            }
            // 背包特殊品按鈕邏輯
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
                    await safeReply(interaction, { content: '你今天已經領取過獎勵了！', ephemeral: false });
                    return;
                }
                else {
                    // 更新玩家的最後獎勵日期
                    playerConfig.lastDailyReward = formattedDate;
                    // 根據當前星期獲取獎勵
                    const todayReward = dailyRewards[currentDay];
                
                    // 獎金額
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
                    await safeReply(interaction, { content: rewardMessage, ephemeral: false });
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
                    embed.description = generatePlayerInfo(playerConfig, weather, `<@${playerConfig.userId}> 你已經切換到 ${playerConfig.currentBiome}！`);
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


            // 修改購買商店按鈕邏輯
            else if (interaction.customId === `FishingShop-${userId}-${hexTime}-shop`) {
                let shopEmbed = {
                    title: '<:fishing_hook:1286423885260263518> 商店 <:fishing_hook:1286423885260263518>',
                    description: '選擇你想購買的類別：',
                    fields: []
                };

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

                allComponents.push(backButtonRow);

                await interaction.editReply({
                    embeds: [shopEmbed],
                    components: allComponents,
                    content: '',
                    ephemeral: false
                });
            }

            // 添加新的商店類別處理邏輯
            else if (interaction.customId.startsWith(`FishingShop-${userId}-${hexTime}-`) && 
                     ['rods', 'bait', 'boat'].includes(interaction.customId.split('-').pop())) {
                const category = interaction.customId.split('-').pop();
                let items;
                let shopEmbed = {
                    title: '',
                    description: '選擇你想購買的物品：',
                    fields: []
                };

                switch (category) {
                    case 'rods':
                        items = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/rods.json`)).rods;
                        shopEmbed.title = '🎣 釣竿商店';
                        break;
                    case 'bait':
                        items = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/bait.json`)).baits;
                        shopEmbed.title = '🪱 魚餌商店';
                        break;
                    case 'boat':
                        items = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/boat.json`)).boat;
                        shopEmbed.title = '🚤 船隻商店';
                        break;
                }

                const availableItems = items.filter(item => playerConfig.level >= (item.requiredLevel || 0));
                
                if (availableItems.length === 0) {
                    shopEmbed.description = '你的等級還不足以購買任何物品。請繼續提升等級！';
                } else {
                    const itemButtons = availableItems.map(item => 
                        new ButtonBuilder()
                            .setCustomId(`FishingShop-${userId}-${hexTime}-buy-${item.id || item.name}`)
                            .setLabel(`購買 ${item.name.split(' ')[0]} x ${item.quantity} ($${item.sellPrice * item.quantity || item.price * item.quantity})`)
                            .setStyle('Primary')
                    );
                    
                    const rows = [];
                    for (let i = 0; i < itemButtons.length; i += 5) {
                        rows.push(new ActionRowBuilder().addComponents(itemButtons.slice(i, i + 5)));
                    }

                    const backButton = new ButtonBuilder()
                        .setCustomId(`FishingShop-${userId}-${hexTime}-shop`)
                        .setLabel('返回')
                        .setStyle('Secondary');
                    rows.push(new ActionRowBuilder().addComponents(backButton));

                    await interaction.editReply({
                        embeds: [shopEmbed],
                        components: rows,
                        content: '',
                        ephemeral: false
                    });
                }
            }

            // 修改購買物品邏輯
            else if (interaction.customId.startsWith(`FishingShop-${userId}-${hexTime}-buy-`)) {
                const itemId = interaction.customId.split('-').pop();
                let item;
                let itemType;

                // 根據物品ID查找對應的物品
                const rodData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/rods.json`));
                const baitData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/bait.json`));
                const boatData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/boat.json`));

                if (item = rodData.rods.find(r => r.id === itemId || r.name === itemId)) {
                    itemType = 'rod';
                } else if (item = baitData.baits.find(b => b.id === itemId || b.name === itemId)) {
                    itemType = 'bait';
                } else if (item = boatData.boat.find(b => b.id === itemId || b.name === itemId)) {
                    itemType = 'boat';
                }

                if (item && playerConfig.level >= (item.requiredLevel || 0)) {
                    const price = itemType === 'bait' ? item.sellPrice : (item.sellPrice || item.price);
                    const maxQuantity = Math.floor(playerConfig.money / price);
                    const initialQuantity = Math.min(1, maxQuantity);

                    let buyEmbed = {
                        title: `購買 ${item.name}`,
                        description: `選擇你想購買的數量：`,
                        fields: [
                            { name: '單價', value: `$${price}`, inline: true },
                            { name: '數量', value: `${initialQuantity}`, inline: true },
                            { name: '總價', value: `$${price * initialQuantity}`, inline: true },
                            { name: '你的金錢', value: `$${playerConfig.money}`, inline: true },
                            { name: '最大可購買數量', value: `${maxQuantity}`, inline: true }
                        ],
                        color: 0x0099FF
                    };

                    const components = generateBuyButtons(userId, hexTime, itemId, initialQuantity, maxQuantity);

                    await interaction.editReply({
                        embeds: [buyEmbed],
                        components: components,
                        ephemeral: false
                    });
                } else {
                    await safeReply(interaction, {
                        content: `你無法購買這個物品。可能是等級不足或該物品不存在。`,
                        ephemeral: false
                    });
                }
            }

            // 處理增加數量的邏輯
            else if (interaction.customId.startsWith(`FishingShop-${userId}-${hexTime}-increase-`)) {
                const [, , , , itemId, quantityToAdd] = interaction.customId.split('-');
                await handleQuantityChange(interaction, playerConfig, guildId, itemId, parseInt(quantityToAdd), true);
            }

            // 處理減少數量的邏輯
            else if (interaction.customId.startsWith(`FishingShop-${userId}-${hexTime}-decrease-`)) {
                const [, , , , itemId, quantityToSubtract] = interaction.customId.split('-');
                await handleQuantityChange(interaction, playerConfig, guildId, itemId, parseInt(quantityToSubtract), false);
            }

            // 理確認購買的邏輯
            else if (interaction.customId.startsWith(`FishingShop-${userId}-${hexTime}-confirm-`)) {
                const itemId = interaction.customId.split('-').pop();
                await handlePurchaseConfirmation(interaction, playerConfig, guildId, itemId, dirPath);
            }

            // 處理取消購買的邏輯
            else if (interaction.customId === `FishingShop-${userId}-${hexTime}-cancel`) {
                // 返回商店主頁
                let shopEmbed = {
                    title: '<:fishing_hook:1286423885260263518> 商店 <:fishing_hook:1286423885260263518>',
                    description: '選擇你想購買的類別：',
                    fields: []
                };

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

                allComponents.push(backButtonRow);

                await interaction.editReply({
                    embeds: [shopEmbed],
                    components: allComponents,
                    ephemeral: false
                });
            }

            // 修改販賣魚類按鈕邏輯
            else if (interaction.customId === `FishingShop-${userId}-${hexTime}-sell`) {
                // 從玩家的背包中獲取魚，排除傳說魚和神話魚
                const playerData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/playerdata/${userId}.json`));
                let sellableFish = playerData.backpack.filter(item => 
                    item.type === 'fish' && item.rarity !== 'mythical'
                );

                if (sellableFish.length === 0) {
                    await safeReply(interaction, { content: '你沒有可以賣的魚！', ephemeral: false });
                    return;
                }

                // 生成賣魚的 embed
                let sellFishEmbed = {
                    title: '<:fishing_hook:1286423885260263518> 賣魚 <:fishing_hook:1286423885260263518>',
                    description: '選擇你想賣的魚！（不包括傳說和神話魚類）',
                    fields: [],
                    color: 0x0099FF // 設置一個好看的顏色
                };

                // 將魚的資訊添加到 embed 的 fields 中
                sellableFish.forEach((fish, index) => {
                    sellFishEmbed.fields.push({
                        name: `${index + 1}. ${fish.name}`,
                        value: `數量: ${fish.quantity}\n單價: $${fish.price}\n總價: $${fish.quantity * fish.price}`,
                        inline: true
                    });
                });

                let components = generateSellButtons(sellableFish, userId, hexTime);

                // 回覆結果
                await interaction.editReply({
                    embeds: [sellFishEmbed],
                    components: components,
                    content: '',
                    ephemeral: false
                });
            }

            // 修改販賣出魚的邏輯
            else if (interaction.customId.startsWith(`FishingShop-${userId}-${hexTime}-sell-`)) {
                const fishIndex = parseInt(interaction.customId.split('-').pop()); // 獲取魚的索引
                const playerData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/playerdata/${userId}.json`));
                let sellableFish = playerData.backpack.filter(item => 
                    item.type === 'fish' && item.rarity !== 'mythical'
                );
                const fishItem = sellableFish[fishIndex];

                if (fishItem) {
                    // 賣魚並賺取金錢
                    const fishPrice = fishItem.quantity * fishItem.price;
                    playerData.money += fishPrice;

                    // 從背包中移除魚
                    playerData.backpack = playerData.backpack.filter(item => item.name !== fishItem.name);
                    fs.writeFileSync(`src/config/${guildId}/fishing/playerdata/${userId}.json`, JSON.stringify(playerData, null, 2));
                    playerConfig = JSON.parse(fs.readFileSync(dirPath));
                    
                    // 創建一個新的 embed 來顯示賣魚結果
                    let sellResultEmbed = {
                        title: '🐟 賣魚成功！ 💰',
                        description: `你賣出了 ${fishItem.quantity} 條 ${fishItem.name}，並獲得 $${fishPrice}！`,
                        color: 0x00FF00, // 綠色，表示成功
                        fields: [
                            {
                                name: '賣出的魚',
                                value: fishItem.name,
                                inline: true
                            },
                            {
                                name: '數量',
                                value: fishItem.quantity.toString(),
                                inline: true
                            },
                            {
                                name: '獲得金錢',
                                value: `$${fishPrice}`,
                                inline: true
                            },
                            {
                                name: '當前金錢',
                                value: `$${playerData.money}`,
                                inline: true
                            }
                        ]
                    };

                    await interaction.editReply({
                        embeds: [sellResultEmbed],
                        components: [], // 暫時移除按鈕
                        content: '',
                        ephemeral: false
                    });

                    // 延遲一段時間後重新顯示賣魚介面
                    setTimeout(async () => {
                        // 重新生成賣魚的按鈕
                        sellableFish = playerData.backpack.filter(item => 
                            item.type === 'fish' && item.rarity !== 'mythical'
                        );
                        let sellFishEmbed = {
                            title: '<:fishing_hook:1286423885260263518> 賣魚 <:fishing_hook:1286423885260263518>',
                            description: '選擇你想賣的魚！（不包括神話魚類）',
                            fields: [],
                            color: 0x0099FF
                        };

                        if (sellableFish.length === 0) {
                            sellFishEmbed.description = '你沒有可以賣的魚了！';
                        } else {
                            // 將魚的資訊添加到 embed 的 fields 中
                            sellableFish.forEach((fish, index) => {
                                sellFishEmbed.fields.push({
                                    name: `${index + 1}. ${fish.name}`,
                                    value: `數量: ${fish.quantity}\n單價: $${fish.price}\n總價: $${fish.quantity * fish.price}`,
                                    inline: true
                                });
                            });
                        }

                        const components = generateSellButtons(sellableFish, userId, hexTime);

                        await interaction.editReply({
                            embeds: [sellFishEmbed],
                            components: components,
                            content: '',
                            ephemeral: false
                        });
                    }, 3000); // 3秒後重新顯示賣魚介面
                } else {
                    await safeReply(interaction, {
                        content: `無法找到該魚。`,
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

            // 修改寵物按鈕邏輯
            else if (interaction.customId === `pet-${userId}-${hexTime}`) {
                const petData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/pat.json`));
                let petEmbed = {
                    title: '🐾 寵物系統 🐾',
                    description: '',
                    fields: []
                };

                if (!playerConfig.currentPet) {
                    petEmbed.description = '你還沒有選擇寵物。請先購買或選擇一個寵物。';
                } else {
                    const currentPet = petData.pat.find(p => p.id === playerConfig.currentPet);
                    petEmbed.description = `當前寵物：${currentPet.emoji} ${currentPet.name}\n每小時釣魚次數：${currentPet.time}`;

                    const lastFishingTime = playerConfig.lastPetFishingTime ? new Date(playerConfig.lastPetFishingTime) : null;
                    const nextFishingTime = lastFishingTime ? new Date(lastFishingTime.getTime() + 3600000) : null;

                    if (lastFishingTime) {
                        petEmbed.fields.push({
                            name: '上次釣魚時間',
                            value: lastFishingTime.toLocaleString(),
                            inline: true
                        });
                    }

                    if (nextFishingTime) {
                        petEmbed.fields.push({
                            name: '下次釣魚時間',
                            value: nextFishingTime.toLocaleString(),
                            inline: true
                        });
                    }
                }

                const petShopButton = new ButtonBuilder()
                    .setCustomId(`pet-${userId}-${hexTime}-shop`)
                    .setLabel('寵物商店')
                    .setEmoji('🏪')
                    .setStyle('Primary');

                const changePetButton = new ButtonBuilder()
                    .setCustomId(`pet-${userId}-${hexTime}-change`)
                    .setLabel('更換寵物')
                    .setEmoji('🔄')
                    .setStyle('Primary');

                const petFishingResultButton = new ButtonBuilder()
                    .setCustomId(`pet-${userId}-${hexTime}-fishing-result`)
                    .setLabel('寵物釣魚結果')
                    .setEmoji('🎣')
                    .setStyle('Primary');

                const backButton = new ButtonBuilder()
                    .setCustomId(`pet-${userId}-${hexTime}-back`)
                    .setLabel('返回')
                    .setStyle('Secondary');

                const row1 = new ActionRowBuilder().addComponents(petShopButton, changePetButton);
                const row2 = new ActionRowBuilder().addComponents(petFishingResultButton, backButton);

                // 使用原本的主界面功能
                const { embed: mainEmbed, components: mainComponents } = generateMainMenu(playerConfig, userId, hexTime, weather, generatePlayerInfo);

                // 合併寵物介面和主界面
                const combinedEmbed = {
                    ...mainEmbed,
                    title: petEmbed.title,
                    description: `${mainEmbed.description}\n\n${petEmbed.description}`,
                    fields: [...mainEmbed.fields, ...petEmbed.fields]
                };

                await interaction.editReply({
                    embeds: [combinedEmbed],
                    components: [row1, row2],
                    content: '',
                    ephemeral: false
                });
            }

            // 寵物商店邏輯
            else if (interaction.customId === `pet-${userId}-${hexTime}-shop`) {
                const petData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/pat.json`));
                let petShopEmbed = {
                    title: '🏪 寵物商店 🏪',
                    description: '選擇你想購買的寵物：',
                    fields: []
                };

                const availablePets = petData.pat.filter(pet => playerConfig.level >= pet.requiredLevel);
                
                if (availablePets.length === 0) {
                    petShopEmbed.description = '你的等級還不足以購買任何寵物。請繼續提升等級！';
                } else {
                    const petButtons = availablePets.map(pet => 
                        new ButtonBuilder()
                            .setCustomId(`pet-${userId}-${hexTime}-buy-${pet.id}`)
                            .setLabel(`購買 ${pet.name.split(' ')[0]} ($${pet.price})`)
                            .setEmoji(pet.emoji)
                            .setStyle('Primary')
                    );
                    
                    const rows = [];
                    for (let i = 0; i < petButtons.length; i += 5) {
                        rows.push(new ActionRowBuilder().addComponents(petButtons.slice(i, i + 5)));
                    }

                    const backButton = new ButtonBuilder()
                        .setCustomId(`pet-${userId}-${hexTime}-back`)
                        .setLabel('返回')
                        .setStyle('Secondary');
                    rows.push(new ActionRowBuilder().addComponents(backButton));

                    await interaction.editReply({
                        embeds: [petShopEmbed],
                        components: rows,
                        content: '',
                        ephemeral: false
                    });
                }
            }

            // 更換寵物邏輯
            else if (interaction.customId === `pet-${userId}-${hexTime}-change`) {
                const petData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/pat.json`));
                let changePetEmbed = {
                    title: '🔄 更換寵物 🔄',
                    description: '選擇你想使用的寵物：',
                    fields: []
                };

                const playerPets = playerConfig.backpack.filter(item => item.type === 'pet');
                
                if (playerPets.length === 0) {
                    changePetEmbed.description = '你還沒有任何寵物。請先購買寵物！';
                } else {
                    const petButtons = playerPets.map(pet => {
                        const petInfo = petData.pat.find(p => p.id === pet.id);
                        return new ButtonBuilder()
                            .setCustomId(`pet-${userId}-${hexTime}-select-${pet.id}`)
                            .setLabel(`選擇 ${petInfo.name.split(' ')[0]}`)
                            .setEmoji(petInfo.emoji)
                            .setStyle('Primary');
                    });
                    
                    const rows = [];
                    for (let i = 0; i < petButtons.length; i += 5) {
                        rows.push(new ActionRowBuilder().addComponents(petButtons.slice(i, i + 5)));
                    }

                    const backButton = new ButtonBuilder()
                        .setCustomId(`pet-${userId}-${hexTime}-back`)
                        .setLabel('返回')
                        .setStyle('Secondary');
                    rows.push(new ActionRowBuilder().addComponents(backButton));

                    await interaction.editReply({
                        embeds: [changePetEmbed],
                        components: rows,
                        content: '',
                        ephemeral: false
                    });
                }
            }

            // 購買寵物邏輯
            else if (interaction.customId.startsWith(`pet-${userId}-${hexTime}-buy-`)) {
                const petId = interaction.customId.split('-').pop();
                const petData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/pat.json`));
                const pet = petData.pat.find(p => p.id === petId);

                if (pet && playerConfig.level >= pet.requiredLevel) {
                    if (playerConfig.money >= pet.price) {
                        playerConfig.money -= pet.price;
                        
                        // 將寵物添加到背包
                        const petItem = {
                            id: pet.id,
                            name: pet.name,
                            type: 'pet',
                            rarity: pet.rarity,
                            quantity: 1
                        };
                        
                        let existingPet = playerConfig.backpack.find(item => item.id === pet.id && item.type === 'pet');
                        if (existingPet) {
                            existingPet.quantity += 1;
                        } else {
                            playerConfig.backpack.push(petItem);
                        }

                        fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2));

                        await safeReply(interaction, {
                            content: `恭喜！你花費 $${pet.price} 購買了 ${pet.emoji} ${pet.name}！`,
                            ephemeral: false
                        });
                    } else {
                        await safeReply(interaction, {
                            content: `你的金錢不足以購買 ${pet.emoji} ${pet.name}。需要 $${pet.price}。`,
                            ephemeral: false
                        });
                    }
                } else {
                    await safeReply(interaction, {
                        content: `你無法購買這個寵物。可能是等級不足或該寵物不存在。`,
                        ephemeral: false
                    });
                }
            }

            // 選擇寵物邏輯
            else if (interaction.customId.startsWith(`pet-${userId}-${hexTime}-select-`)) {
                const petId = interaction.customId.split('-').pop();
                const petData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/pat.json`));
                const pet = petData.pat.find(p => p.id === petId);

                if (pet) {
                    playerConfig.currentPet = pet.id;
                    fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2));

                    await safeReply(interaction, {
                        content: `你已選擇 ${pet.emoji} ${pet.name} 作為當前寵物！`,
                        ephemeral: false
                    });
                } else {
                    await safeReply(interaction, {
                        content: `無法找到該寵物。`,
                        ephemeral: false
                    });
                }
            }

            // 寵物返回按鈕邏輯
            else if (interaction.customId === `pet-${userId}-${hexTime}-back`) {
                // 返回主選單
                const { embed, components } = generateMainMenu(playerConfig, userId, hexTime, weather, generatePlayerInfo);
                await interaction.editReply({ embeds: [embed], components: components, content: '', ephemeral: false });
            }

            // 修改購買商店按鈕邏輯
            else if (interaction.customId === `FishingShop-${userId}-${hexTime}-shop`) {
                let shopEmbed = {
                    title: '<:fishing_hook:1286423885260263518> 商店 <:fishing_hook:1286423885260263518>',
                    description: '選擇你想購買的類別：',
                    fields: []
                };

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

                allComponents.push(backButtonRow);

                await interaction.editReply({
                    embeds: [shopEmbed],
                    components: allComponents,
                    content: '',
                    ephemeral: false
                });
            }

            // 修改販賣魚類按鈕邏輯
            else if (interaction.customId === `FishingShop-${userId}-${hexTime}-sell`) {
                // 從玩家的背包中獲取魚，排除傳說魚和神話魚
                const playerData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/playerdata/${userId}.json`));
                let sellableFish = playerData.backpack.filter(item => 
                    item.type === 'fish' && item.rarity !== 'legendary' && item.rarity !== 'mythical'
                );

                if (sellableFish.length === 0) {
                    await safeReply(interaction, { content: '你沒有可以賣的魚！', ephemeral: false });
                    return;
                }

                // 生成賣魚的 embed
                let sellFishEmbed = {
                    title: '<:fishing_hook:1286423885260263518> 賣魚 <:fishing_hook:1286423885260263518>',
                    description: '選擇你想賣的魚！（不包括傳說和神話魚類）',
                    fields: [],
                    color: 0x0099FF // 設置一個好看的顏色
                };

                // 將魚的資訊添加到 embed 的 fields 中
                sellableFish.forEach((fish, index) => {
                    sellFishEmbed.fields.push({
                        name: `${index + 1}. ${fish.name}`,
                        value: `數量: ${fish.quantity}\n單價: $${fish.price}\n總價: $${fish.quantity * fish.price}`,
                        inline: true
                    });
                });

                let components = generateSellButtons(sellableFish, userId, hexTime);

                // 回覆結果
                await interaction.editReply({
                    embeds: [sellFishEmbed],
                    components: components,
                    content: '',
                    ephemeral: false
                });
            }

            // 修改販賣出魚的邏輯
            else if (interaction.customId.startsWith(`FishingShop-${userId}-${hexTime}-sell-`)) {
                const fishIndex = parseInt(interaction.customId.split('-').pop()); // 獲取魚的索引
                const playerData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/playerdata/${userId}.json`));
                let sellableFish = playerData.backpack.filter(item => 
                    item.type === 'fish' && item.rarity !== 'legendary' && item.rarity !== 'mythical'
                );
                const fishItem = sellableFish[fishIndex];

                if (fishItem) {
                    // 賣魚並賺取金錢
                    const fishPrice = fishItem.quantity * fishItem.price;
                    playerData.money += fishPrice;

                    // 從背包中移除魚
                    playerData.backpack = playerData.backpack.filter(item => item.name !== fishItem.name);
                    fs.writeFileSync(`src/config/${guildId}/fishing/playerdata/${userId}.json`, JSON.stringify(playerData, null, 2));
                    playerConfig = JSON.parse(fs.readFileSync(dirPath));
                    
                    // 創建一個新的 embed 來顯示賣魚結果
                    let sellResultEmbed = {
                        title: '🐟 賣魚成功！ 💰',
                        description: `你賣出了 ${fishItem.quantity} 條 ${fishItem.name}，並獲得 $${fishPrice}！`,
                        color: 0x00FF00, // 綠色，表示成功
                        fields: [
                            {
                                name: '賣出的魚',
                                value: fishItem.name,
                                inline: true
                            },
                            {
                                name: '數量',
                                value: fishItem.quantity.toString(),
                                inline: true
                            },
                            {
                                name: '獲得金錢',
                                value: `$${fishPrice}`,
                                inline: true
                            },
                            {
                                name: '當前金錢',
                                value: `$${playerData.money}`,
                                inline: true
                            }
                        ]
                    };

                    await interaction.editReply({
                        embeds: [sellResultEmbed],
                        components: [], // 暫時移除按鈕
                        content: '',
                        ephemeral: false
                    });

                    // 延遲一段時間後重新顯示賣魚介面
                    setTimeout(async () => {
                        // 重新生成賣魚的按鈕
                        sellableFish = playerData.backpack.filter(item => 
                            item.type === 'fish' && item.rarity !== 'legendary' && item.rarity !== 'mythical'
                        );
                        let sellFishEmbed = {
                            title: '<:fishing_hook:1286423885260263518> 賣魚 <:fishing_hook:1286423885260263518>',
                            description: '選擇你想賣的魚！（不包括傳說和神話魚類）',
                            fields: [],
                            color: 0x0099FF
                        };

                        if (sellableFish.length === 0) {
                            sellFishEmbed.description = '你沒有可以賣的魚了！';
                        } else {
                            // 將魚的資訊添加到 embed 的 fields 中
                            sellableFish.forEach((fish, index) => {
                                sellFishEmbed.fields.push({
                                    name: `${index + 1}. ${fish.name}`,
                                    value: `數量: ${fish.quantity}\n單價: $${fish.price}\n總價: $${fish.quantity * fish.price}`,
                                    inline: true
                                });
                            });
                        }

                        const components = generateSellButtons(sellableFish, userId, hexTime);

                        await interaction.editReply({
                            embeds: [sellFishEmbed],
                            components: components,
                            content: '',
                            ephemeral: false
                        });
                    }, 3000); // 3秒後重新顯示賣魚介面
                } else {
                    await safeReply(interaction, {
                        content: `無法找到該魚。`,
                        ephemeral: false
                    });
                }
            }

            // 返回按鈕邏輯
            else if (interaction.customId.startsWith(`FishingShop-${userId}-${hexTime}-back`)) {
                // 返回主頁
                let mainEmbed = {
                    title: '<:fishing_hook:1286423885260263518> 釣魚 <:fishing_hook:1286423885260263518>',
                    description: '選擇你想做的事情：',
                    fields: []
                };

                let allComponents = [];
                let currentRow = new ActionRowBuilder();

                // 添加按鈕
                currentRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`FishingShop-${userId}-${hexTime}-shop`)
                        .setLabel('商店')
                        .setEmoji('<:shop:1286423885260263518>')
                        .setStyle('Primary'),
                    new ButtonBuilder()
                        .setCustomId(`FishingShop-${userId}-${hexTime}-sell`)
                        .setLabel('賣魚')
                        .setEmoji('<:sell:1286423885260263518>')
                        .setStyle('Primary'),
                    new ButtonBuilder()
                        .setCustomId(`FishingShop-${userId}-${hexTime}-back`)
                        .setLabel('返回')
                        .setStyle('Secondary')
                );
                
                allComponents.push(currentRow);

                await interaction.editReply({
                    embeds: [mainEmbed],
                    components: allComponents,
                    content: '',
                    ephemeral: false
                });
            }

            // 修改寵物釣魚結果邏輯
            else if (interaction.customId === `pet-${userId}-${hexTime}-fishing-result`) {
                const petData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/pat.json`));
                const currentPet = petData.pat.find(p => p.id === playerConfig.currentPet);

                let petFishingEmbed = {
                    title: '🎣 寵物釣魚結果 🎣',
                    description: '',
                    fields: []
                };

                if (!currentPet) {
                    petFishingEmbed.description = '你還沒有選擇寵物！請先選擇一個寵物。';
                } else if (!playerConfig.lastPetFishingResult) {
                    petFishingEmbed.description = `你的寵物 ${currentPet.emoji} ${currentPet.name} 還沒有進行過釣魚。`;
                } else {
                    const lastFishingTime = new Date(playerConfig.lastPetFishingTime).toLocaleString();
                    petFishingEmbed.description = `你的寵物 ${currentPet.emoji} ${currentPet.name} 上次釣魚時間：${lastFishingTime}`;

                    let totalFish = 0;
                    let totalExperience = 0;
                    let fishSummary = {};

                    playerConfig.lastPetFishingResult.forEach(result => {
                        totalFish += result.fishQuantity;
                        totalExperience += result.petExperience;
                        if (fishSummary[result.fishData.name]) {
                            fishSummary[result.fishData.name] += result.fishQuantity;
                        } else {
                            fishSummary[result.fishData.name] = result.fishQuantity;
                        }
                    });

                    petFishingEmbed.fields.push({
                        name: '總計',
                        value: `總共釣到 ${totalFish} 條魚，獲得 ${totalExperience} 經驗`,
                        inline: false
                    });

                    petFishingEmbed.fields.push({
                        name: '魚類統計',
                        value: Object.entries(fishSummary).map(([name, quantity]) => `${name}: ${quantity}`).join('\n'),
                        inline: false
                    });

                    // 顯示下次釣魚時間
                    const nextFishingTime = new Date(playerConfig.lastPetFishingTime + 3600000).toLocaleString();
                    petFishingEmbed.fields.push({
                        name: '下次釣魚時間',
                        value: nextFishingTime,
                        inline: false
                    });
                }

                const backButton = new ButtonBuilder()
                    .setCustomId(`pet-${userId}-${hexTime}-back`)
                    .setLabel('返回')
                    .setStyle('Secondary');

                const row = new ActionRowBuilder().addComponents(backButton);

                // 使用原本的主界面功能
                const { embed: mainEmbed, components: mainComponents } = generateMainMenu(playerConfig, userId, hexTime, weather, generatePlayerInfo);

                // 合併寵物釣魚結果和主界面
                const combinedEmbed = {
                    ...mainEmbed,
                    title: petFishingEmbed.title,
                    description: `${mainEmbed.description}\n\n${petFishingEmbed.description}`,
                    fields: [...mainEmbed.fields, ...petFishingEmbed.fields]
                };

                await interaction.editReply({
                    embeds: [combinedEmbed],
                    components: [...mainComponents],
                    content: '',
                    ephemeral: false
                });
            }

            // 觸發互動後重置計時器
            if (timeout) {
                clearTimeout(timeout); // 清除之前的計時器
            }

            // 修改計時器部分
            timeout = setTimeout(async () => {
                const reply = await ctx.fetchReply();
                client.off('interactionCreate', handleInteraction);

                try {
                    // 嘗試編輯原始消息
                    await reply.edit({
                        embeds: [],
                        components: [],
                        content: '釣魚事件已失效，請重新輸入 /fishing',
                    });
                    
                    // 3秒後刪除消息
                    setTimeout(async () => {
                        try {
                            await reply.delete();
                        } catch (deleteError) {
                            console.error("刪除消息時發生錯誤：", deleteError);
                        }
                    }, 3000);
                } catch (error) {
                    console.error("處理超時時發生錯誤：", error);
                    // 如果無法編輯原消息，我們不再嘗試發送新消息
                }
            }, 120000); // 2分鐘
    };

    client.on('interactionCreate', handleInteraction);

    try {
        // 初次設置計時器
        timeout = setTimeout(async () => {
            const reply = await ctx.fetchReply();
            client.off('interactionCreate', handleInteraction);
            try {
                await reply.edit({
                    embeds: [], 
                    components: [], 
                    content: '你這次的魚塘已經過期，請重新輸入/fishing', 
                    ephemeral: false
                });
            } catch (error) {
                console.error("編輯初始回覆時發生錯誤：", error);
                // 如果編輯失敗，嘗試發送一條新消息
                try {
                    await reply.followUp({
                        content: '你這次的魚塘已經過期，請重新輸入/fishing',
                        ephemeral: true
                    });
                } catch (followUpError) {
                    console.error("發送後續消息時發生錯誤：", followUpError);
                }
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
    // 果經驗足夠升級
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

// 修改這個函數來處理數量變化
async function handleQuantityChange(interaction, playerConfig, guildId, itemId, quantityChange, isIncrease) {
    try {
        const message = await interaction.message.fetch();
        const currentEmbed = message.embeds[0];
        const currentQuantity = parseInt(currentEmbed.fields.find(f => f.name === '數量').value);
        const price = parseInt(currentEmbed.fields.find(f => f.name === '單價').value.replace('$', ''));
        const maxQuantity = parseInt(currentEmbed.fields.find(f => f.name === '最大可購買數量').value);

        let newQuantity;
        if (isIncrease) {
            newQuantity = Math.min(currentQuantity + quantityChange, maxQuantity);
        } else {
            newQuantity = Math.max(currentQuantity - quantityChange, 1);
        }

        const totalPrice = price * newQuantity;

        currentEmbed.fields.find(f => f.name === '數量').value = `${newQuantity}`;
        currentEmbed.fields.find(f => f.name === '總價').value = `$${totalPrice}`;

        const components = generateBuyButtons(interaction.user.id, interaction.customId.split('-')[2], itemId, newQuantity, maxQuantity);

        // 使用 editReply 而不是 update
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({
                embeds: [currentEmbed],
                components: components
            });
        } else {
            await interaction.update({
                embeds: [currentEmbed],
                components: components
            });
        }
    } catch (error) {
        console.error('處理數量變化時發生錯誤:', error);
        // 如果出錯，嘗試發送一個新的回覆
        try {
            await interaction.followUp({
                content: '處理您的請求時發生錯誤，請重試。',
                ephemeral: true
            });
        } catch (followUpError) {
            console.error('發送錯誤訊息時失敗:', followUpError);
        }
    }
}

// 修改這個函數來處理購買確認
async function handlePurchaseConfirmation(interaction, playerConfig, guildId, itemId, dirPath) {
    try {
        const message = await interaction.message.fetch();
        const currentEmbed = message.embeds[0];
        const quantity = parseInt(currentEmbed.fields.find(f => f.name === '數量').value);
        const totalPrice = parseInt(currentEmbed.fields.find(f => f.name === '總價').value.replace('$', ''));

        if (playerConfig.money >= totalPrice) {
            playerConfig.money -= totalPrice;
            
            // 將物品添加到背包
            let item;
            let itemType;

            const rodData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/rods.json`));
            const baitData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/bait.json`));
            const boatData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/boat.json`));

            if (item = rodData.rods.find(r => r.id === itemId || r.name === itemId)) {
                itemType = 'rod';
            } else if (item = baitData.baits.find(b => b.id === itemId || b.name === itemId)) {
                itemType = 'bait';
            } else if (item = boatData.boat.find(b => b.id === itemId || b.name === itemId)) {
                itemType = 'boat';
            }

            if (!item) {
                throw new Error('找不到該物品');
            }

            const newItem = {
                id: item.id,
                name: item.name,
                type: itemType,
                rarity: item.rarity || 'common',
                experience: item.experience || 0,
                price: item.price || item.sellPrice || 0,
                quantity: quantity
            };
            
            let existingItem = playerConfig.backpack.find(i => i.id === newItem.id && i.type === itemType);
            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                playerConfig.backpack.push(newItem);
            }

            fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2));

            // 更新現有的 embed 來顯示購買結果
            const purchaseResultEmbed = {
                title: '🛒 購買成功！',
                description: `恭喜！你花費 $${totalPrice} 購買了 ${quantity} 個 ${item.name}！`,
                color: 0x00FF00, // 綠色表示成功
                fields: [
                    { name: '購買物品', value: item.name, inline: true },
                    { name: '數量', value: quantity.toString(), inline: true },
                    { name: '總價', value: `$${totalPrice}`, inline: true },
                    { name: '剩餘金錢', value: `$${playerConfig.money}`, inline: true }
                ]
            };

            await interaction.editReply({
                embeds: [purchaseResultEmbed],
                components: []
            });

            // 延遲後返回商店主頁
            setTimeout(async () => {
                const shopEmbed = createShopEmbed();
                const shopComponents = createShopComponents(interaction.user.id, interaction.customId.split('-')[2]);
                await interaction.editReply({
                    embeds: [shopEmbed],
                    components: shopComponents
                });
            }, 3000);
        } else {
            // 如果金錢不足，更新現有的 embed 來顯示錯誤信息
            const errorEmbed = {
                title: '❌ 購買失敗',
                description: `你的金錢不足以購買 ${quantity} 個 ${item.name}。需要 $${totalPrice}。`,
                color: 0xFF0000, // 紅色表示錯誤
                fields: [
                    { name: '你的金錢', value: `$${playerConfig.money}`, inline: true },
                    { name: '需要金錢', value: `$${totalPrice}`, inline: true }
                ]
            };

            await interaction.editReply({
                embeds: [errorEmbed],
                components: []
            });

            // 延遲後返回購買介面
            setTimeout(async () => {
                await interaction.editReply({
                    embeds: [currentEmbed],
                    components: message.components
                });
            }, 3000);
        }
    } catch (error) {
        console.error('處理購買確認時發生錯誤:', error);
        // 更新現有的 embed 來顯示錯誤信息
        const errorEmbed = {
            title: '❌ 錯誤',
            description: '處理您的購買請求時發生錯誤，請重試。',
            color: 0xFF0000 // 紅色表示錯誤
        };
        await interaction.editReply({
            embeds: [errorEmbed],
            components: []
        });
    }
}

// 新增這些輔助函數
function createShopEmbed() {
    return {
        title: '<:fishing_hook:1286423885260263518> 商店 <:fishing_hook:1286423885260263518>',
        description: '選擇你想購買的類別：',
        fields: []
    };
}

function createShopComponents(userId, hexTime) {
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

    allComponents.push(backButtonRow);

    return allComponents;
}