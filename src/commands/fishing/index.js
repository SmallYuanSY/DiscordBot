import { SlashCommandBuilder, ButtonBuilder, ActionRowBuilder } from 'discord.js'; 
import fs from 'fs';
import { client } from '@/main.js';
import path from 'path';

export const command = new SlashCommandBuilder()
    .setName('fishing')
    .setDescription('釣魚');

export const action = async (ctx) => {

    const member = ctx.member;
    const userId = ctx.user.id;
    const hexTime = Math.floor(Date.now() / 1000).toString(16);
    const userName = ctx.user.displayName;
    const guildId = ctx.guild.id;
    const dirPath = `src/config/${guildId}/fishing/playerdata/${userId}.json`;

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
    
    replyMessage = await ctx.reply({ embeds: [loadingEmbed] , ephemeral: true });
    // 對玩家身上設定時間戳
    setPlayerTime(userId, guildId);

    // 生成初始 embed 資訊
    let embed = {
        title: '<:fishing_hook:1286423885260263518> 釣魚 <:fishing_hook:1286423885260263518>',
        description: `
        玩家： <@${playerConfig.userId}>
        金錢： $${playerConfig.money}
        等級： Level ${playerConfig.level}
        經驗： ${playerConfig.experience} xp
        目前裝備： ${playerConfig.currentRod}
        目前生態域： ${playerConfig.currentBiome}
        `,
    };

    // 按鈕設置
    const fishingButton = new ButtonBuilder()
        .setCustomId(`fishing-${userId}-${hexTime}`) // 保證每個玩家的按鈕互動是唯一的
        .setLabel('釣魚')
        .setStyle('Primary');

    const backpackButton = new ButtonBuilder()
        .setCustomId(`backpack-${userId}-${hexTime}`)
        .setLabel('背包')
        .setStyle('Primary');

    const dailyRewardButton = new ButtonBuilder()
        .setCustomId(`daily-${userId}-${hexTime}`)
        .setLabel('每日獎勵')
        .setStyle('Primary');
    const shopButton = new ButtonBuilder()
        .setCustomId(`FishingShop-${userId}-${hexTime}-shop`)
        .setLabel('商店')
        .setStyle('Primary');
    const sellButton = new ButtonBuilder()
        .setCustomId(`FishingShop-${userId}-${hexTime}-sell`)
        .setLabel('魚販')
        .setStyle('Primary');

    const row = new ActionRowBuilder().addComponents(fishingButton, backpackButton, dailyRewardButton, shopButton, sellButton);

    // 處理按鈕互動邏輯
    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;
        let playerConfig = JSON.parse(fs.readFileSync(dirPath));
        const currentTime = Math.floor(Date.now() / 1000);
        const playerTime = parseInt(playerConfig.hexTime, 16);

        const timeDiff = currentTime - playerTime;
        
            // 確認互動是針對當前玩家的
            if (interaction.customId !== `fishing-${userId}-${hexTime}` && !interaction.customId.startsWith(`backpack-${userId}-${hexTime}`) && interaction.customId !== `daily-${userId}-${hexTime}` && !interaction.customId.startsWith(`FishingShop-${userId}-${hexTime}`)) return;
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
            // 處理延遲互動失敗
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
            // 檢查互動是否過期
            if (timeDiff > 60) {
                await interaction.editReply({
                    content: '互動已過期，請重新操作。',
                    embeds: [],
                    components: [],
                    ephemeral: true
                });
                return;
            }else {
                // 在玩家身上設置時間戳
                setPlayerTime(userId, guildId);
            }


            // 釣魚按鈕邏輯
            if (interaction.customId === `fishing-${userId}-${hexTime}`) {
                const currentTime = Date.now();
                const lastFishTime = playerConfig.timer || 0;
                const cooldown = 5 * 1000; // 5 秒冷卻時間

                // 冷卻時間檢查
                if (currentTime - lastFishTime < cooldown) {
                    const remainingTime = cooldown - (currentTime - lastFishTime);
                    const minutes = Math.floor(remainingTime / 60000);
                    const seconds = Math.floor((remainingTime % 60000) / 1000);

                    await interaction.editReply({
                        content: `還有 ${minutes > 0 ? `${minutes} 分 ` : ''}${seconds} 秒才能再次釣魚！`,
                        ephemeral: true,
                    });
                    return;
                }

                // 設置計時器
                playerConfig.timer = currentTime;

                // 生態域與魚資料
                const currentBiome = playerConfig.biome;
                const biomeData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/biomes/${currentBiome}.json`));

                // 魚餌檢查
                let bait = playerConfig.backpack.find(item => item.name === '魚餌 <:worm:1286420915772719237>');
                if (!bait || bait.quantity <= 0) {
                    await interaction.editReply({
                        content: '你沒有魚餌了，請到商店購買！',
                        ephemeral: true
                    });
                    return;
                }

                // 扣除魚餌
                bait.quantity -= 1;

                // 根據玩家當前的釣竿設置機率與魚數量範圍
                let rarityChances;
                let fishQuantityRange;
                // 根據釣竿設定機率
                switch (playerConfig.currentRod) {
                    case '進階銥製釣竿 <:Advanced_Iridium_Rod:1287104442545471649>' : // 進階銥製釣竿
                        rarityChances = {
                            "common": 0.20,
                            "uncommon": 0.20,
                            "rare": 0.35,
                            "legendary": 0.25
                        };
                        fishQuantityRange = [4, 8]; // 進階銥製釣竿魚數量範圍
                    case '銥製釣竿 <:Iridium_Rod:1287104390724849845>' : // 銥製釣竿
                        rarityChances = {
                            "common": 0.25,
                            "uncommon": 0.25,
                            "rare": 0.30,
                            "legendary": 0.20
                        };
                        fishQuantityRange = [4, 6]; // 銥製釣竿魚數量範圍
                    case '鑽石釣竿 <:diamond_rod:1286423662957695086>' : // 鑽石釣竿
                        rarityChances = {
                            "common": 0.25,
                            "uncommon": 0.25,
                            "rare": 0.35,
                            "legendary": 0.15
                        };
                        fishQuantityRange = [3, 6]; // 鑽石釣竿魚數量範圍
                    case '金製釣竿 <:gold_rod:1286423686882132062>': // 金釣竿
                        rarityChances = {
                            "common": 0.35,
                            "uncommon": 0.35,
                            "rare": 0.25,
                            "legendary": 0.05
                        };
                        fishQuantityRange = [2, 5]; // 金釣竿魚數量範圍
                        break;
                    case '玻璃纖維釣竿 <:Fiberglass_Rod:1287104401051488268>': // 玻璃纖維釣竿
                        rarityChances = {
                            "common": 0.35,
                            "uncommon": 0.35,
                            "rare": 0.25,
                            "legendary": 0.05
                        };
                        fishQuantityRange = [2, 4]; // 玻璃纖維釣竿魚數量範圍
                    case '鐵製釣竿 <:iron_rod:1287099753296826519>': // 鐵製釣竿
                        rarityChances = {
                            "common": 0.40,
                            "uncommon": 0.30,
                            "rare": 0.25,
                            "legendary": 0.05
                        };
                        fishQuantityRange = [1, 3]; // 鐵製釣竿魚數量範圍
                    case '竹製釣竿 <:Bamboo_Rod:1287104410996052030>': // 竹製釣竿
                        rarityChances = {
                            "common": 0.40,
                            "uncommon": 0.35,
                            "rare": 0.20,
                            "legendary": 0.05
                        };
                        fishQuantityRange = [1, 3]; // 竹製釣竿魚數量範圍
                    case '初級釣竿 <:fishing_rod:1286423711385129041>':     // 初級釣竿
                        rarityChances = {
                            "common": 0.45,
                            "uncommon": 0.30,
                            "rare": 0.20,
                            "legendary": 0.05
                        };
                        fishQuantityRange = [1, 2]; // 初級釣竿魚數量範圍
                        break;
                }

                const mythicalChanceInLegendary = 0.01; // mythical 魚在 Legendary 中的機率

                // 確保已經存在 mythicalFishCaught 記錄
                if (!playerConfig.mythicalFishCaught) {
                    playerConfig.mythicalFishCaught = [];
                }

                // 隨機選擇魚的稀有度
                let fishRarity;
                const randomNum = Math.random();
                if (randomNum <= rarityChances.common) {
                    fishRarity = "common";
                } else if (randomNum <= rarityChances.common + rarityChances.uncommon) {
                    fishRarity = "uncommon";
                } else if (randomNum <= rarityChances.common + rarityChances.uncommon + rarityChances.rare) {
                    fishRarity = "rare";
                } else {
                    // Legendary 魚種
                    fishRarity = "legendary";

                    // 檢查是否釣到 mythical 魚
                    const mythicalRandom = Math.random();
                    if (mythicalRandom <= mythicalChanceInLegendary) {
                        const availableMythicalFish = biomeData.fish.filter(fish => fish.rarity === 'mythical');
                        const mythicalFishData = availableMythicalFish[Math.floor(Math.random() * availableMythicalFish.length)];

                        // 檢查玩家是否已經釣到該 mythical 魚
                        if (!playerConfig.mythicalFishCaught.includes(mythicalFishData.name)) {
                            fishRarity = "mythical"; // 設定為 mythical 魚
                            playerConfig.mythicalFishCaught.push(mythicalFishData.name); // 更新記錄
                        }
                    }
                }

                // 根據稀有度選擇魚
                const availableFish = biomeData.fish.filter(fish => fish.rarity === fishRarity);
                const fishData = availableFish[Math.floor(Math.random() * availableFish.length)];

                // 隨機確定釣到的魚數量，根據釣竿設定
                const fishQuantity = Math.floor(Math.random() * (fishQuantityRange[1] - fishQuantityRange[0] + 1)) + fishQuantityRange[0];

                // 增加魚到背包
                let existFish = playerConfig.backpack.find(item => item.name === fishData.name);
                if (existFish) {
                    existFish.quantity += fishQuantity; // 增加相應數量
                } else {
                    playerConfig.backpack.push({
                        name: fishData.name,
                        rarity: fishData.rarity,
                        experience: fishData.experience,
                        price: fishData.price,
                        quantity: fishQuantity // 新增相應數量
                    });
                }

                // 更新玩家資料
                playerConfig.experience += fishData.experience * fishQuantity;
                fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2));

                // 更新 embed 並回覆
                embed.title = '<:fishing_hook:1286423885260263518> 釣魚 <:fishing_hook:1286423885260263518>';
                embed.description = `
                    玩家： <@${playerConfig.userId}>
                    金錢： $${playerConfig.money}
                    等級： Level ${playerConfig.level}
                    經驗： ${playerConfig.experience} xp
                    目前裝備： ${playerConfig.currentRod}
                    目前生態域： ${playerConfig.currentBiome}
                    🎣<@${playerConfig.userId}> 釣到了 ${fishData.name}！數量：${fishQuantity}
                `;

                await interaction.editReply({ embeds: [embed], components: [row], content: '', ephemeral: true });
            }



            // 背包按鈕邏輯
            else if (interaction.customId === `backpack-${userId}-${hexTime}`) {
                // 按鈕設置
                const backpackfishButton = new ButtonBuilder()
                    .setCustomId(`backpack-${userId}-${hexTime}-fish`)
                    .setLabel('魚類')
                    .setStyle('Primary');
                const backpacktoolsButton = new ButtonBuilder()
                    .setCustomId(`backpack-${userId}-${hexTime}-tools`)
                    .setLabel('道具')
                    .setStyle('Primary');
                const backpackspecialButton = new ButtonBuilder()
                    .setCustomId(`backpack-${userId}-${hexTime}-special`)
                    .setLabel('特殊')
                    .setStyle('Primary');
                const backpackreturnButton = new ButtonBuilder()
                    .setCustomId(`backpack-${userId}-${hexTime}-return`)
                    .setLabel('返回')
                    .setStyle('Secondary');
                // 創建按鈕行
                const row = new ActionRowBuilder().addComponents(backpackfishButton, backpacktoolsButton, backpackspecialButton, backpackreturnButton);
                embed.title = '🎒 背包選單 🎒';
                embed.description = `
                    玩家： <@${playerConfig.userId}>
                    金錢： $${playerConfig.money}
                    等級： Level ${playerConfig.level}
                    經驗： ${playerConfig.experience} xp
                    請選擇要查看的物品類別：
                `;
            
                await interaction.editReply({ embeds: [embed], components: [row], content: '', ephemeral: true });
            }
            // 背包魚類按鈕邏輯
            else if (interaction.customId === `backpack-${userId}-${hexTime}-fish`) {
                const fishItems = playerConfig.backpack.filter(item => item.rarity === 'common' || item.rarity === 'uncommon' || item.rarity === 'rare' || item.rarity === 'legendary' || item.rarity === 'mythical');
                let fishContent = fishItems
                    .map(item => `${item.name} x${item.quantity}, 稀有度: ${item.rarity}, 經驗: ${item.experience} xp`)
                    .join('\n');
            
                embed.title = '<:bluegill:1286418383947956254> 魚類物品 <:bluegill:1286418383947956254>';
                embed.description = fishContent || '你的背包中沒有魚類物品。';
            
                await interaction.editReply({ embeds: [embed], components: [row], content: '', ephemeral: true });
            }
            // 背包道具按鈕邏輯
            else if (interaction.customId === `backpack-${userId}-${hexTime}-tools`) {
                const toolItems = playerConfig.backpack.filter(item => item.rarity === 'unique');
                
                // 檢查背包中的釣竿並生成按鈕
                const rodItems = toolItems.filter(item => item.name.includes('竿'));
            
                let toolContent = toolItems
                    .map(item => `${item.name} x${item.quantity}, 稀有度: ${item.rarity}, 經驗: ${item.experience} xp`)
                    .join('\n');
            
                embed.title = '<:iron_fillet_knife:1286420476436025419> 道具物品 <:iron_fillet_knife:1286420476436025419>';
                embed.description = toolContent || '你的背包中沒有道具物品。';
            
                let allComponents = [];
                let currentRow = new ActionRowBuilder();
                let buttonCount = 0;
            
                rodItems.forEach(rod => {
            
                    // 添加釣竿的按鈕
                    const button = new ButtonBuilder()
                        .setCustomId(`backpack-${userId}-${hexTime}-select-rod-${rod.name}`)
                        .setLabel(removeEmoji(rod.name))
                        .setStyle('Primary');
            
                    const emoji = getEmoji(rod.name);
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
            
                // 添加最後一行按鈕
                if (buttonCount > 0) {
                    allComponents.push(currentRow);
                }
                await interaction.editReply({ embeds: [embed], components: [...allComponents], content: '', ephemeral: true });
            }
            // 背包處理釣竿切換邏輯
            else if (interaction.customId.startsWith(`backpack-${userId}-${hexTime}-select-rod`)) {
                const selectedRod = interaction.customId.split(`backpack-${userId}-${hexTime}-select-rod-`)[1];
                console.log(selectedRod);
            
                // 更新玩家的當前釣竿
                playerConfig.currentRod = selectedRod;
                fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2)); // 保存配置
            
                embed.title = '🎣 釣竿切換成功 🎣';
                embed.description = `
                    玩家： <@${playerConfig.userId}>
                    金錢： $${playerConfig.money}
                    等級： Level ${playerConfig.level}
                    經驗： ${playerConfig.experience} xp
                    目前裝備： ${playerConfig.currentRod}
                    目前生態域： ${playerConfig.currentBiome}
                    你已經切換到 ${selectedRod}！
                `;
            
                await interaction.editReply({ embeds: [embed], components: [row], content: '', ephemeral: true });
            }
            // 背包特殊物品按鈕邏輯
            else if (interaction.customId === `backpack-${userId}-${hexTime}-special`) {
                const specialItems = playerConfig.backpack.filter(item => item.rarity === 'special');
                let specialContent = specialItems
                    .map(item => `${item.name} x${item.quantity}, 稀有度: ${item.rarity}, 經驗: ${item.experience} xp`)
                    .join('\n');
            
                embed.title = '<:Training_Rod:1287104368243638292> 特殊物品 <:Training_Rod:1287104368243638292>';
                embed.description = specialContent || '你的背包中沒有特殊物品。';
            
                await interaction.editReply({ embeds: [embed], components: [row], content: '', ephemeral: true });
            }
            // 背包返回按鈕邏輯
            else if (interaction.customId === `backpack-${userId}-${hexTime}-return`) {
                // 返回主背包選單
                embed.title = '🎒 背包 🎒';
                embed.description = `
                    玩家： <@${playerConfig.userId}>
                    金錢： $${playerConfig.money}
                    等級： Level ${playerConfig.level}
                    經驗： ${playerConfig.experience} xp
                    背包：
                `;
            
                await interaction.editReply({ embeds: [embed], components: [row], content: '', ephemeral: true });
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
                    await interaction.editReply({ content: '你今天已經領取過獎勵了！', ephemeral: true });
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
                    await interaction.editReply({ content: rewardMessage, ephemeral: true });
                    }
                
            }



            // 購買商店按鈕邏輯
            else if (interaction.customId === `FishingShop-${userId}-${hexTime}-shop`) {
                // 讀取商店的 JSON 文件
                const shopData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/shop/shop.json`));
                
                // 分類商品為釣竿和魚餌
                const rodItems = shopData.items.filter(item => item.name.includes('釣竿'));
                const baitItems = shopData.items.filter(item => item.name.includes('魚餌'));
            
                // 生成釣竿和魚餌的嵌入信息
                let shopEmbed = {
                    title: '🎣 商店 🎣',
                    description: '選擇你想購買的類別：',
                    fields: []
                };
            
                // 初始化按鈕行列表
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
                    ephemeral: true
                });
            }
            // 購買商店處理釣竿類別
            else if (interaction.customId === `FishingShop-${userId}-${hexTime}-rods`) {
                const shopData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/shop/shop.json`));
                const rodItems = shopData.items.filter(item => item.name.includes('釣竿'));
            
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
                        .setCustomId(`FishingShop-${userId}-${hexTime}-buy-${removeEmoji(item.name)}`)
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
                    ephemeral: true
                });
            }
            // 購買商店處理魚餌類別
            else if (interaction.customId === `FishingShop-${userId}-${hexTime}-bait`) {
                const shopData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/shop/shop.json`));
                const baitItems = shopData.items.filter(item => item.name.includes('魚餌'));
            
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
                        .setCustomId(`FishingShop-${userId}-${hexTime}-buy-${removeEmoji(item.name)}`)
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
                    ephemeral: true
                });
            }
            // 購買商品按鈕邏輯
            else if (interaction.customId.startsWith(`FishingShop-${userId}-${hexTime}-buy`)) {
                const shopData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/shop/shop.json`));
                const itemNameInCustomId = interaction.customId.split('-').slice(4).join('-'); // 提取簡化後的 itemName
                // 在 shopData 中查找原始物品
                const item = shopData.items.find(i => i.name.replace(/<:[^>]+>/g, '').trim() === itemNameInCustomId);

                if (!item) {
                    await interaction.reply({ content: '找不到該物品！', ephemeral: true });
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
                            rarity: item.rarity,
                            experience: item.experience,
                            price: item.price,
                            quantity: item.quantity
                        });
                    }
            
                    // 更新玩家資料
                    fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2));
                    playerConfig = JSON.parse(fs.readFileSync(dirPath));
            
                    await interaction.editReply({
                        content: `你購買了 ${item.name}！`,
                        ephemeral: true
                    });
                } else {
                    await interaction.editReply({
                        content: `你的金錢不足以購買 ${item.name}！`,
                        ephemeral: true
                    });
                }
            }



            // 販賣魚類按鈕邏輯
            else if (interaction.customId === `FishingShop-${userId}-${hexTime}-sell`) {
                // 從玩家的背包中獲取魚
                const playerData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/playerdata/${userId}.json`));
                let sellableFish = playerData.backpack.filter(item => item.rarity !== 'unique' && item.rarity !== 'mythical') // 過濾掉稀有度為 unique跟 mythical 的魚

                if (sellableFish.length === 0) {
                    await interaction.editReply({ content: '你沒有可以賣的魚！', ephemeral: true });
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
                    ephemeral: true
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
                        ephemeral: true
                    });
                }
            }
            // 返回按鈕邏輯
            else if (interaction.customId.startsWith(`FishingShop-${userId}-${hexTime}-back`)) {
            // 返回主頁
                let mainEmbed = {
                    title: '<:fishing_hook:1286423885260263518> 釣魚 <:fishing_hook:1286423885260263518>',
                    description: `
                    玩家： <@${playerConfig.userId}>
                    金錢： $${playerConfig.money}
                    等級： Level ${playerConfig.level}
                    經驗： ${playerConfig.experience} xp
                    目前裝備： ${playerConfig.currentRod}
                    目前生態域： ${playerConfig.currentBiome}
                    `,
                };
                await interaction.editReply({ embeds: [mainEmbed], components: [row], content: '', ephemeral: true });
            }
        
    });
        await ctx.editReply({ embeds: [embed], components: [row] , ephemeral: true});
    
};

// 在玩家身上設置時間戳
export const setPlayerTime = (userId, guildId) => {
    const traggerTime = Math.floor(Date.now() / 1000);
    const hexTime = traggerTime.toString(16);
    const dirPath = `src/config/${guildId}/fishing/playerdata/${userId}.json`;
    let playerConfig = JSON.parse(fs.readFileSync(dirPath));
    playerConfig.hexTime = hexTime;
    fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2));
};

function removeEmoji(text) {
    return text.replace(/<:[a-zA-Z0-9_]+:[0-9]+>/g, '').trim();
}

function getEmoji(text) {
    const match = text.match(/<:[a-zA-Z0-9_]+:[0-9]+>/);
    return match ? match[0] : null; // 保護機製：避免沒有emoji的情況報錯
}