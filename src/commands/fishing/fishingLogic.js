import fs from 'fs';

export const getFishingResult = (playerConfig, guildId) => {
    const currentBiome = playerConfig.biome;
    const biomeData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/biomes/${currentBiome}.json`));

    const rodData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/rods.json`));
    const currentRod = playerConfig.currentRod;

    const rodConfig = rodData.rods.find(rod => rod.name === currentRod);
    if (!rodConfig) throw new Error('找不到該釣竿的配置');

    const rarityChances = rodConfig.rarityChances;
    const fishQuantityRange = rodConfig.fishQuantityRange;

    // 加入天氣影響
    const weatherStatus = JSON.parse(fs.readFileSync('src/config/weatherStatus.json'));
    const weatherEffects = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/weatherEffect.json`));
    const currentWeather = weatherStatus.condition;
    const weatherEffect = weatherEffects.weatherEffects.find(effect => effect.condition === currentWeather);

    if (weatherEffect) {
        rarityChances.common += weatherEffect.rarityModifier.common;
        rarityChances.uncommon += weatherEffect.rarityModifier.uncommon;
        rarityChances.rare += weatherEffect.rarityModifier.rare;
        rarityChances.legendary += weatherEffect.rarityModifier.legendary;
    }

    // 加入魚餌的影響
    const baitData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/bait.json`));
    const currentBait = playerConfig.currentBait;  // 玩家選擇的魚餌
    const baitConfig = baitData.baits.find(bait => bait.name === currentBait);

    if (baitConfig) {
        rarityChances.common += baitConfig.rarityModifier.common;
        rarityChances.uncommon += baitConfig.rarityModifier.uncommon;
        rarityChances.rare += baitConfig.rarityModifier.rare;
        rarityChances.legendary += baitConfig.rarityModifier.legendary;

        // 檢查魚餌數量
        let bait = playerConfig.backpack.find(item => item.name === baitConfig.name);
        if (!bait || bait.quantity <= 0) {
            throw new Error('你沒有魚餌了，請到商店購買！');
        }

        // 消耗一個魚餌
        bait.quantity -= 1;
        if (bait.quantity <= 0) {
            // 移除魚餌
            playerConfig.backpack = playerConfig.backpack.filter(item => item.name !== baitConfig.name);
        }
    } else {
        throw new Error('請選擇魚餌來進行釣魚！');
    }

    // 確保機率不低於 0 並限制在 0-1 之間
    rarityChances.common = Math.max(0, Math.min(1, rarityChances.common));
    rarityChances.uncommon = Math.max(0, Math.min(1, rarityChances.uncommon));
    rarityChances.rare = Math.max(0, Math.min(1, rarityChances.rare));
    rarityChances.legendary = Math.max(0, Math.min(1, rarityChances.legendary));

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

    // 隨機確定釣到的魚數量
    const fishQuantity = Math.floor(Math.random() * (fishQuantityRange[1] - fishQuantityRange[0] + 1)) + fishQuantityRange[0];

    return { fishData, fishQuantity };
};