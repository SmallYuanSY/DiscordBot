import { ButtonBuilder, ActionRowBuilder } from 'discord.js';
import fs from 'fs';

// 移除表情符號的輔助函數
function removeEmoji(text) {
    return text.replace(/<:[a-zA-Z0-9_]+:[0-9]+>/g, '').trim();
}

// 獲取表情符號的輔助函數
function getEmoji(text) {
    const match = text.match(/<:[a-zA-Z0-9_]+:[0-9]+>/);
    return match ? match[0] : null;
}

// 背包主功能
export function handleBackpack(interaction, playerConfig, userId, hexTime, weather, generatePlayerInfo) {
    const backpackfishButton = new ButtonBuilder()
        .setCustomId(`backpack-${userId}-${hexTime}-fish`)
        .setLabel('魚類')
        .setEmoji('<:bluegill:1286418383947956254>')
        .setStyle('Primary');
    const backpacktoolsButton = new ButtonBuilder()
        .setCustomId(`backpack-${userId}-${hexTime}-tools`)
        .setLabel('道具')
        .setEmoji('<:iron_fillet_knife:1286420476436025419>')
        .setStyle('Primary');
    const backpackbaitButton = new ButtonBuilder()
        .setCustomId(`backpack-${userId}-${hexTime}-bait`)
        .setLabel('魚餌')
        .setEmoji('<:worm:1286420915772719237>')
        .setStyle('Primary');
    const backpackspecialButton = new ButtonBuilder()
        .setCustomId(`backpack-${userId}-${hexTime}-special`)
        .setLabel('特殊')
        .setEmoji('<:Training_Rod:1287104368243638292>')
        .setStyle('Primary');
    const backpackreturnButton = new ButtonBuilder()
        .setCustomId(`backpack-${userId}-${hexTime}-return`)  // 修改這裡
        .setLabel('返回')
        .setStyle('Secondary');

    const row1 = new ActionRowBuilder().addComponents(
        backpackfishButton, 
        backpacktoolsButton
    );
    const row2 = new ActionRowBuilder().addComponents(
        backpackbaitButton, 
        backpackspecialButton
    );
    const row3 = new ActionRowBuilder().addComponents(backpackreturnButton);

    let embed = {
        title: '<:Backpack:1287142986903326813> 背包 <:Backpack:1287142986903326813>',
        description: generatePlayerInfo(playerConfig, weather, `請選擇要查看的物品類別：`),
        fields: [
            {
                name: '魚類物品',
                value: countItems(playerConfig.backpack, ['common', 'uncommon', 'rare', 'legendary', 'mythical']),
                inline: true
            },
            {
                name: '道具物品',
                value: countItems(playerConfig.backpack, ['unique']),
                inline: true
            },
            {
                name: '魚餌物品',
                value: countItems(playerConfig.backpack, [], 'bait'),
                inline: true
            },
            {
                name: '特殊物品',
                value: countItems(playerConfig.backpack, ['special']),
                inline: true
            }
        ]
    };

    return { embed, components: [row1, row2, row3] };
}

// 輔助函數：計算物品數量
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

// 處理魚類物品
export function handleFishItems(interaction, playerConfig, userId, hexTime) {
    const fishItems = playerConfig.backpack.filter(item => 
        ['common', 'uncommon', 'rare', 'legendary', 'mythical'].includes(item.rarity)
    );
    let fishContent = fishItems
        .map(item => `${item.name} x${item.quantity}, 稀有度: ${item.rarity}, 經驗: ${item.experience} xp`)
        .join('\n');

    let embed = {
        title: '<:bluegill:1286418383947956254> 魚類物品 <:bluegill:1286418383947956254>',
        description: fishContent || '你的背包中沒有魚類物品。'
    };

    const backpackreturnButton = new ButtonBuilder()
        .setCustomId(`backpack-${userId}-${hexTime}`)
        .setLabel('返回')
        .setStyle('Secondary');

    const row = new ActionRowBuilder().addComponents(backpackreturnButton);

    return { embed, components: [row] };
}

// 處理道具物品
export function handleToolItems(interaction, playerConfig, userId, hexTime) {
    const toolItems = playerConfig.backpack.filter(item => item.rarity === 'unique');
    const rodItems = toolItems.filter(item => item.type === 'rod');

    let toolContent = toolItems
        .map(item => `${item.name}`)
        .join('\n');

    let embed = {
        title: '<:iron_fillet_knife:1286420476436025419> 道具物品 <:iron_fillet_knife:1286420476436025419>',
        description: toolContent || '你的背包中沒有道具物品。'
    };

    let allComponents = [];
    let currentRow = new ActionRowBuilder();
    let buttonCount = 0;

    rodItems.forEach(rod => {
        const button = new ButtonBuilder()
            .setCustomId(`backpack-${userId}-${hexTime}-select-rod-${rod.name}`)
            .setLabel(removeEmoji(rod.name))
            .setStyle('Primary');

        const emoji = getEmoji(rod.name);
        if (emoji) {
            button.setEmoji(emoji);
        }

        currentRow.addComponents(button);
        buttonCount++;

        if (buttonCount === 5) {
            allComponents.push(currentRow);
            currentRow = new ActionRowBuilder();
            buttonCount = 0;
        }
    });

    if (buttonCount > 0) {
        allComponents.push(currentRow);
    }

    const backpackreturnButton = new ButtonBuilder()
        .setCustomId(`backpack-${userId}-${hexTime}`)
        .setLabel('返回')
        .setStyle('Secondary');

    // 確保每行不超過5個按鈕
    if (allComponents.length > 0 && allComponents[allComponents.length - 1].components.length < 5) {
        allComponents[allComponents.length - 1].addComponents(backpackreturnButton);
    } else {
        allComponents.push(new ActionRowBuilder().addComponents(backpackreturnButton));
    }

    return { embed, components: allComponents };
}

// 處理魚餌物品
export function handleBaitItems(interaction, playerConfig, userId, hexTime) {
    const baitItems = playerConfig.backpack.filter(item => item.type === 'bait');
    let baitContent = baitItems
        .map(item => `${item.name} x${item.quantity}, 稀有度: ${item.rarity}, 經驗: ${item.experience} xp`)
        .join('\n');

    let embed = {
        title: '<:worm:1286420915772719237> 魚餌物品 <:worm:1286420915772719237>',
        description: baitContent || '你的背包中沒有魚餌物品。'
    };

    let allComponents = [];
    let currentRow = new ActionRowBuilder();
    let buttonCount = 0;

    baitItems.forEach(bait => {
        const button = new ButtonBuilder()
            .setCustomId(`backpack-${userId}-${hexTime}-select-bait-${bait.name}`)
            .setLabel(removeEmoji(bait.name))
            .setStyle('Primary');

        const emoji = getEmoji(bait.name);
        if (emoji) {
            button.setEmoji(emoji);
        }

        currentRow.addComponents(button);
        buttonCount++;

        if (buttonCount === 5) {
            allComponents.push(currentRow);
            currentRow = new ActionRowBuilder();
            buttonCount = 0;
        }
    });

    if (buttonCount > 0) {
        allComponents.push(currentRow);
    }

    const backpackreturnButton = new ButtonBuilder()
        .setCustomId(`backpack-${userId}-${hexTime}`)
        .setLabel('返回')
        .setStyle('Secondary');

    // 確保每行不超過5個按鈕
    if (allComponents.length > 0 && allComponents[allComponents.length - 1].components.length < 5) {
        allComponents[allComponents.length - 1].addComponents(backpackreturnButton);
    } else {
        allComponents.push(new ActionRowBuilder().addComponents(backpackreturnButton));
    }

    return { embed, components: allComponents };
}

// 處理特殊物品
export function handleSpecialItems(interaction, playerConfig, userId, hexTime) {
    const specialItems = playerConfig.backpack.filter(item => item.rarity === 'special');
    let specialContent = specialItems
        .map(item => `${item.name} x${item.quantity}, 稀有度: ${item.rarity}, 經驗: ${item.experience} xp`)
        .join('\n');

    let embed = {
        title: '<:Training_Rod:1287104368243638292> 特殊物品 <:Training_Rod:1287104368243638292>',
        description: specialContent || '你的背包中沒有特殊物品。'
    };

    const backpackreturnButton = new ButtonBuilder()
        .setCustomId(`backpack-${userId}-${hexTime}`)
        .setLabel('返回')
        .setStyle('Secondary');

    const row = new ActionRowBuilder().addComponents(backpackreturnButton);

    return { embed, components: [row] };
}

// 處理釣竿選擇
export function handleRodSelection(interaction, playerConfig, userId, hexTime, dirPath, generatePlayerInfo, weather) {
    const selectedRod = interaction.customId.split(`backpack-${userId}-${hexTime}-select-rod-`)[1];

    playerConfig.currentRod = selectedRod;
    fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2));

    let embed = {
        title: '<:fishing_rod:1286423711385129041> 釣竿切換成功 <:fishing_rod:1286423711385129041>',
        description: generatePlayerInfo(playerConfig, weather, `🎣<@${playerConfig.userId}> 你已經切換到 ${selectedRod}！`)
    };

    return { embed };
}

// 處理魚餌選擇
export function handleBaitSelection(interaction, playerConfig, userId, hexTime, dirPath, generatePlayerInfo, weather) {
    const selectedBait = interaction.customId.split(`backpack-${userId}-${hexTime}-select-bait-`)[1];

    playerConfig.currentBait = selectedBait;
    fs.writeFileSync(dirPath, JSON.stringify(playerConfig, null, 2));

    let embed = {
        title: '<:worm:1286420915772719237> 魚餌切換成功 <:worm:1286420915772719237>',
        description: generatePlayerInfo(playerConfig, weather, `🎣<@${playerConfig.userId}> 你已經切換到 ${selectedBait}！`)
    };

    return { embed };
}