import { SlashCommandBuilder, ButtonBuilder, ActionRowBuilder } from 'discord.js'; 
import fs from 'fs';
import { client } from '@/main.js';
import path from 'path';

export const command = new SlashCommandBuilder()
    .setName('fishing')
    .setDescription('釣魚');

export const action = async (ctx) => {

    try {
        // 延遲回覆，確保不會因為超時導致互動過期
        await ctx.deferReply({ ephemeral: true });
    } catch (error) {
        console.error('Failed to defer reply:', error);
        return; // 如果無法延遲回覆，直接結束函數，防止後續崩潰
    }

    const member = ctx.member;
    const userId = ctx.user.id;
    const userName = ctx.user.displayName;
    const guildId = ctx.guild.id;
    const traggerTime = Math.floor(Date.now() / 1000);
    const hexTime = traggerTime.toString(16);
    const dirPath = `src/config/${guildId}/fishing/playerdata/${userId}.json`;

    // 確保資料夾存在
    if (!fs.existsSync(`src/config/${guildId}/fishing/playerdata`)) {
        fs.mkdirSync(`src/config/${guildId}/fishing/playerdata`, { recursive: true });
    }

    let playerConfig;

    // 如果玩家檔案不存在，初始化資料
    if (!fs.existsSync(dirPath)) {
        playerConfig = {
            userId: userId,
            userName: userName,
            level: 1,
            money: 0,
            experience: 0,
            currentRod: '初級魚竿 <:fishing_rod:1286423711385129041>',
            currentBiome: '淡水河',
            backpack: [],
            biome: 'River',
            canGoBiome: ["River"],
            timer: 0,
            lastDailyReward: -1
        };
        // 初始背包內容
        playerConfig.backpack.push({
            name: '初級魚竿 <:fishing_rod:1286423711385129041>',
            rarity: 'unique',
            experience: 0,
            quantity: 1
        });
        fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2));
    } else {
        playerConfig = JSON.parse(fs.readFileSync(dirPath));
        // 對玩家身上設定時間戳
        playerConfig.hexTime = hexTime;
        fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2));
    }

    // 回覆 Loading 的 embed
    let loadingEmbed = {
        title: '釣魚中...',
        description: '請稍後，正在進行操作...'
    };
    
    await ctx.editReply({ embeds: [loadingEmbed] , ephemeral: true });

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
        // 檢查玩家是否已經回覆或延遲回覆
        if (interaction.replied || interaction.deferred) {
            console.log("Interaction already replied or deferred.");
            return;
        }
        
        
        // 確認互動是針對當前玩家的
        if (interaction.customId !== `fishing-${userId}-${hexTime}` && interaction.customId !== `backpack-${userId}-${hexTime}` && interaction.customId !== `daily-${userId}-${hexTime}` && !interaction.customId.startsWith(`FishingShop-${userId}-${hexTime}`)) return;
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
                    ephemeral: true,
                });
                return;
            }

            // 設置計時器
            playerConfig.timer = currentTime;
            fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2));
            
            const currentBiome = playerConfig.biome;
            const biomeData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/biomes/${currentBiome}.json`));
            const fishData = biomeData.fish[Math.floor(Math.random() * biomeData.fish.length)];
            // 如果背包沒有魚餌，則回覆訊息
            if (!playerConfig.backpack.find(item => item.name === '魚餌 <:worm:1286420915772719237>')) {
                await interaction.editReply({
                    content: '你沒有魚餌！, 請到商店購買',
                    ephemeral: true
                });
                return;
            }
            //如果玩家背包魚餌數量小於 0，則回覆訊息
            if (playerConfig.backpack.find(item => item.name === '魚餌 <:worm:1286420915772719237>').quantity <= 0) {
                await interaction.editReply({
                    content: '你沒有魚餌！',
                    ephemeral: true
                });
                return;
            }
            else {
                // 扣除魚餌
                playerConfig.backpack.find(item => item.name === '魚餌 <:worm:1286420915772719237>').quantity -= 1;
                // 增加魚到背包
                let existFish = playerConfig.backpack.find((item) => item.name === fishData.name);
                if (existFish) {
                    existFish.quantity += 1;
                } else {
                    playerConfig.backpack.push({
                        name: fishData.name,
                        rarity: fishData.rarity,
                        experience: fishData.experience,
                        price: fishData.price,
                        quantity: 1
                    });
                }

                // 更新玩家資料
                playerConfig.experience += fishData.experience;
                fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2));

                // 更新 embed
                embed.title = '<:fishing_hook:1286423885260263518> 釣魚 <:fishing_hook:1286423885260263518>';
                embed.description = `
                    玩家： <@${playerConfig.userId}>
                    金錢： $${playerConfig.money}
                    等級： Level ${playerConfig.level}
                    經驗： ${playerConfig.experience} xp
                    目前裝備： ${playerConfig.currentRod}
                    目前生態域： ${playerConfig.currentBiome}
                    🎣<@${playerConfig.userId}> 釣到了 ${fishData.name}！
                    `;

                await interaction.editReply({ embeds: [embed], components: [row], content: '' , ephemeral: true});
                }
        }
        // 背包按鈕邏輯
        else if (interaction.customId === `backpack-${userId}-${hexTime}`) {
            playerConfig = JSON.parse(fs.readFileSync(dirPath));
            let backpackContent = playerConfig.backpack
                .map(item => `${item.name} x${item.quantity}, 稀有度: ${item.rarity}, 經驗: ${item.experience} xp`)
                .join('\n');

            embed.title = '🎒 背包 🎒';
            embed.description = `
                玩家： <@${playerConfig.userId}>
                金錢： $${playerConfig.money}
                等級： Level ${playerConfig.level}
                經驗： ${playerConfig.experience} xp
                背包：\n${backpackContent}
            `;

            await interaction.editReply({ embeds: [embed], components: [row], content: '' , ephemeral: true});
        }
        // 每日獎勵按鈕邏輯
        else if (interaction.customId === `daily-${userId}-${hexTime}`) {
            // 讀取每日獎勵的 json 文件
            const dailyRewards = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/dailyreward.json`));
        
            // 獲取當前伺服器日期
            const currentDate = new Date();
            const currentDay = currentDate.getDay(); // 0 是星期日，1 是星期一，依此類推
            // 獲取玩家最後獎勵日期 轉換為星期
            const playerDailyTime = new Date(playerConfig.lastDailyReward);
            const playerDay = playerDailyTime.getDay();
            // 檢查玩家是否已經領取過獎勵
            if (playerDay === currentDay) {
                await interaction.editReply({ content: '你今天已經領取過獎勵了！', ephemeral: true });
                return;
            }
            else {
                // 更新玩家的最後獎勵日期
                playerConfig.lastDailyReward = currentDate;
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
        // 商店按鈕邏輯
        else if (interaction.customId === `FishingShop-${userId}-${hexTime}-shop`) {
            // 讀取商店的 JSON 文件
            const shopData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/shop/shop.json`));
        
            // 生成商店的 embed 信息
            let shopEmbed = {
                title: '🎣 商店 🎣',
                description: '購買道具來幫助你釣魚！',
                fields: []
            };
        
            // 生成商品按鈕
            const shopButtons = new ActionRowBuilder();
            shopData.items.forEach(item => {
                shopEmbed.fields.push({
                    name: `${item.name} - $${item.sellPrice}`,
                    value: item.description,
                    inline: true
                });
                // 用正則表達式去除魚名中的 emoji 文字
                function removeEmoji(text) {
                    return text.replace(/<:[a-zA-Z0-9_]+:[0-9]+>/g, '').trim();
                }
                function getEmoji(text) {
                    return text.match(/<:[a-zA-Z0-9_]+:[0-9]+>/g)[0];
                }

                shopButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`FishingShop-${userId}-${hexTime}-buy-${removeEmoji(item.name)}`)
                        .setLabel(`購買 ${removeEmoji(item.name)}`)
                        .setEmoji(getEmoji(item.name))
                        .setStyle('Primary')
                );
            });

            shopButtons.addComponents(
                new ButtonBuilder()
                    .setCustomId(`FishingShop-${userId}-${hexTime}-back`)
                    .setLabel('返回')
                    .setStyle('Secondary')
            );
        
            await interaction.editReply({
                embeds: [shopEmbed],
                components: [shopButtons],
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
        // 賣魚按鈕邏輯
        else if (interaction.customId === `FishingShop-${userId}-${hexTime}-sell`) {
            // 從玩家的背包中獲取魚
            const playerData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/playerdata/${userId}.json`));
            let sellableFish = playerData.backpack.filter(item => item.rarity !== 'unique'); // 過濾掉稀有度為 unique 的魚

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

                function removeEmoji(text) {
                    return text.replace(/<:[a-zA-Z0-9_]+:[0-9]+>/g, '').trim();
                }

                function getEmoji(text) {
                    const match = text.match(/<:[a-zA-Z0-9_]+:[0-9]+>/);
                    return match ? match[0] : null; // 保護機制：避免沒有emoji的情況報錯
                }

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
        // 賣出魚的邏輯
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