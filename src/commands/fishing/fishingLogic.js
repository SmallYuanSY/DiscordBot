import fs from 'fs';

export const getFishingResult = (playerConfig, guildId, consumeBait = true) => {
    //console.log('開始釣魚操作');
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

        if (consumeBait) {
            // 檢查魚餌數量
            let bait = playerConfig.backpack.find(item => item.name === baitConfig.name);
            if (!bait || bait.quantity <= 0) {
                throw new Error('你沒有魚餌了，請到商店購買！');
            }

            // 消耗一個魚餌
            //console.log(`消耗魚餌前數量: ${bait.quantity}`);
            bait.quantity -= 1;
            //console.log(`消耗魚餌後數量: ${bait.quantity}`);
            if (bait.quantity <= 0) {
                // 移除魚餌
                playerConfig.backpack = playerConfig.backpack.filter(item => item.name !== baitConfig.name);
            }
        }
    } else {
        throw new Error('請選擇魚餌來進行釣魚！');
    }

    // 確保機率低於 0 並限制在 0-1 間
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

    // 修改這部分
    let availableItems = [];
    if (biomeData.items && Array.isArray(biomeData.items)) {
        availableItems = biomeData.items.filter(item => 
            (item.type === 'fish' && item.rarity === fishRarity) || 
            (item.type === 'pat' && Math.random() < 0.01 && playerConfig.level >= item.requiredLevel)
        );
    }

    if (availableItems.length > 0) {
        const selectedItem = availableItems[Math.floor(Math.random() * availableItems.length)];

        if (selectedItem.type === 'pat') {
            return { petData: selectedItem, isPet: true };
        } else {
            // 隨機確定釣到的魚數量
            const fishQuantity = Math.floor(Math.random() * (fishQuantityRange[1] - fishQuantityRange[0] + 1)) + fishQuantityRange[0];
            return { fishData: selectedItem, fishQuantity };
        }
    } else {
        // 如果沒有可用的物品，回退到原來的魚類選擇邏輯
        const availableFish = biomeData.fish.filter(fish => fish.rarity === fishRarity);
        const fishData = availableFish[Math.floor(Math.random() * availableFish.length)];

        // 隨機確定釣到的魚數量
        const fishQuantity = Math.floor(Math.random() * (fishQuantityRange[1] - fishQuantityRange[0] + 1)) + fishQuantityRange[0];

        return { fishData, fishQuantity };
    }

    // 根據稀有度選擇魚
    const availableFish = biomeData.fish.filter(fish => fish.rarity === fishRarity);
    const fishData = availableFish[Math.floor(Math.random() * availableFish.length)];

    // 隨機確定釣到的魚數量
    const fishQuantity = Math.floor(Math.random() * (fishQuantityRange[1] - fishQuantityRange[0] + 1)) + fishQuantityRange[0];

    return { fishData, fishQuantity };
};

// 新增寵物釣魚邏輯
export const getPetFishingResult = (playerConfig, guildId) => {
    // 不消耗魚餌
    const { fishData, fishQuantity } = getFishingResult(playerConfig, guildId, false);
    
    // 將經驗減半（四捨五入）
    const petExperience = Math.round(fishData.experience * fishQuantity / 2);
    
    return { fishData, fishQuantity, petExperience };
};

// 修改寵物釣魚檢查函數
export const checkPetFishing = (playerConfig) => {
    const currentTime = Date.now();
    const lastPetFishingTime = playerConfig.lastPetFishingTime || 0;
    const petFishingInterval = 3600000; // 1小時（以毫秒為單位）

    if (currentTime - lastPetFishingTime >= petFishingInterval) {
        return true;
    }
    return false;
};

// 修改寵物釣魚結果處理函數
export const processPetFishingResult = (playerConfig, guildId) => {
    if (checkPetFishing(playerConfig)) {
        const results = [];
        const petData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/pat.json`));
        const playerPet = petData.pat.find(pet => pet.id === playerConfig.currentPet);

        if (!playerPet) {
            throw new Error('找不到該寵物的配置');
        }

        const fishingTimes = playerPet.time; // 使用寵物的釣魚次數

        // 在這裡消耗一次魚餌
        const baitData = JSON.parse(fs.readFileSync(`src/config/${guildId}/fishing/bait.json`));
        const currentBait = playerConfig.currentBait;
        const baitConfig = baitData.baits.find(bait => bait.name === currentBait);

        if (baitConfig) {
            let bait = playerConfig.backpack.find(item => item.name === baitConfig.name);
            if (!bait || bait.quantity <= 0) {
                throw new Error('你沒有魚餌了，請到商店購買！');
            }

            //console.log(`寵物釣魚消耗魚餌前數量: ${bait.quantity}`);
            bait.quantity -= 1;
            //console.log(`寵物釣魚消耗魚餌後數量: ${bait.quantity}`);
            if (bait.quantity <= 0) {
                playerConfig.backpack = playerConfig.backpack.filter(item => item.name !== baitConfig.name);
            }
        } else {
            throw new Error('請選擇魚餌來進行釣魚！');
        }

        for (let i = 0; i < fishingTimes; i++) {
            const { fishData, fishQuantity, petExperience } = getPetFishingResult(playerConfig, guildId);

            // 更新玩家背包
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
            playerConfig.experience += petExperience;

            results.push({ fishData, fishQuantity, petExperience });
        }

        // 更新最後寵物釣魚時間
        playerConfig.lastPetFishingTime = Date.now();

        if (results.length > 0) {
            playerConfig.lastPetFishingResult = results;
            playerConfig.lastPetFishingTime = Date.now();
        }

        return results;
    }
    return null;
};

// 新增自動釣魚函數
export const autoPetFishing = (playerConfig, guildId) => {
    const currentTime = Date.now();
    const lastPetFishingTime = playerConfig.lastPetFishingTime || 0;
    const petFishingInterval = 3600000; // 1小時（以毫秒為單位）

    if (currentTime - lastPetFishingTime >= petFishingInterval) {
        return processPetFishingResult(playerConfig, guildId);
    }
    return null;
};