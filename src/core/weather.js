import fetch from 'node-fetch';
import cron from 'node-cron';
import fs from 'fs';

// 你的 WeatherAPI API Key
const API_KEY = 'b687096f6f9f4a87a0865901242309';
const weatherUrl = `http://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=Taipei&aqi=no`;

// 定義一個函數來更新天氣 JSON 文件
const updateWeatherStatus = async () => {
    try {
        const response = await fetch(weatherUrl);
        const data = await response.json();

        // 解析天氣數據
        const location = data.location.name;
        const localtime = data.location.localtime;
        const weatherCondition = data.current.condition.text;
        const weatherIcon = data.current.condition.icon;
        const temperature = data.current.temp_c;

        // 根據天氣條件更新 JSON
        const weatherData = {
            lastUpdate: new Date(),
            location: location,
            condition: weatherCondition,
            icon: ("https:"+ weatherIcon),
            temperature: temperature,
        };

        // 將天氣數據寫入 JSON 文件
        fs.writeFileSync('src/config/weatherStatus.json', JSON.stringify(weatherData, null, 2));
        console.log('天氣數據已更新:', weatherData);
    } catch (error) {
        console.error('更新天氣數據失敗:', error);
    }
};
cron.schedule('0 */1 * * *', () => {
    console.log('每小時更新天氣數據');
    updateWeatherStatus();
});

// 立即執行一次
updateWeatherStatus();