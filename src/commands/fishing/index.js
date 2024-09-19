import { SlashCommandBuilder, ButtonBuilder, ActionRowBuilder } from 'discord.js'; 
import fs from 'fs';
import path from 'path';

export const command = new SlashCommandBuilder()
    .setName('fishing')
    .setDescription('釣魚');

export const action = async (ctx) => {
    const member = ctx.member;
    const userId = ctx.user.id;
    const userName = ctx.user.displayName;
    const guildId = ctx.guild.id;
    const dirPath = `src/config/${guildId}/fishing/${userId}.json`;

    // 檢查玩家是否在語音頻道
    if (!member.voice.channel) {
        await ctx.reply({
            content: '請先加入語音頻道再進行釣魚操作',
            ephemeral: true // 只有使用者可以看到這個訊息
        });
        return;
    }

    // 確保資料夾存在
    if (!fs.existsSync(`src/config/${guildId}/fishing`)) {
        fs.mkdirSync(`src/config/${guildId}/fishing`, { recursive: true });
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
            currentRod: '初級魚竿',
            currentBiome: '淡水河',
            backpack: [],
            biome: 'River',
            canGoBiome: ["River"],
            timer: 0,
        };
        // 初始背包內容
        playerConfig.backpack.push({
            name: '初級魚竿',
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
    await ctx.reply({ embeds: [loadingEmbed] });

    // 生成初始 embed 資訊
    let embed = {
        title: '🎣 釣魚 🎣',
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
        .setCustomId(`fishing-${userId}`) // 保證每個玩家的按鈕互動是唯一的
        .setLabel('釣魚')
        .setStyle('Primary');

    const backpackButton = new ButtonBuilder()
        .setCustomId(`backpack-${userId}`)
        .setLabel('背包')
        .setStyle('Primary');

    const dailyRewardButton = new ButtonBuilder()
        .setCustomId(`daily-${userId}`)
        .setLabel('每日獎勵')
        .setStyle('Primary');

    const row = new ActionRowBuilder().addComponents(fishingButton, backpackButton, dailyRewardButton);

    // 處理按鈕互動邏輯
    ctx.client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;

        // 確認互動是針對當前玩家的
        if (interaction.customId !== `fishing-${userId}` && interaction.customId !== `backpack-${userId}` && interaction.customId !== `daily-${userId}`) return;
        if (interaction.user.id !== userId){
            await interaction.reply({
                content: '這不是你的釣魚互動',
                ephemeral: true
            });
            return;
        }
        // 檢查玩家是否在語音頻道
        const member = interaction.member;
        if (!member.voice.channel) {
            // 檢查是否已經回應
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '請先加入語音頻道再進行操作',
                    ephemeral: true
                });
            } else {
                console.log('Already replied or deferred');
            }
            return;
        }

        await interaction.deferUpdate();

        // 釣魚按鈕邏輯
        if (interaction.customId === `fishing-${userId}`) {
            const currentTime = Date.now();
            const lastFishTime = playerConfig.timer || 0;
            const cooldown = 0.5 * 60 * 1000; // 0.5 分鐘

            if (currentTime - lastFishingTime < cooldown) {
                const remainingTime = cooldown - (currentTime - lastFishingTime);
                const minutes = Math.floor(remainingTime / 60000);
                const seconds = Math.floor((remainingTime % 60000) / 1000);

                await interaction.reply({
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
            
            // 增加魚到背包
            let existFish = playerConfig.backpack.find((item) => item.name === fishData.name);
            if (existFish) {
                existFish.quantity += 1;
            } else {
                playerConfig.backpack.push({
                    name: fishData.name,
                    rarity: fishData.rarity,
                    experience: fishData.experience,
                    quantity: 1
                });
            }

            // 更新玩家資料
            playerConfig.experience += fishData.experience;
            fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2));

            // 更新 embed
            embed.title = '🎣 釣魚 🎣';
            embed.description = `
                玩家： <@${playerConfig.userId}>
                金錢： $${playerConfig.money}
                等級： Level ${playerConfig.level}
                經驗： ${playerConfig.experience} xp
                目前裝備： ${playerConfig.currentRod}
                目前生態域： ${playerConfig.currentBiome}
                🎣<@${playerConfig.userId}> 釣到了 ${fishData.name}！
`;

            await interaction.editReply({ embeds: [embed], components: [row] });
        }

        // 背包按鈕邏輯
        else if (interaction.customId === `backpack-${userId}`) {
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

            await interaction.editReply({ embeds: [embed], components: [row] });
        }

        // 每日獎勵按鈕邏輯
        else if (interaction.customId === `daily-${userId}`) {
            await interaction.editReply({ content: '每日獎勵已領取' });
        }
    });

    await ctx.editReply({ embeds: [embed], components: [row] });
};