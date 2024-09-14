import fs from 'fs';
import path from 'path';

// 設定基礎資料夾路徑
const baseConfigPath = './src/config/';

// 初始化伺服器資料夾與文件
export const initServerConfig = (guildId, configFileName) => {
  const serverFolderPath = path.join(baseConfigPath, guildId);

  // 如果伺服器資料夾不存在，創建它
  if (!fs.existsSync(serverFolderPath)) {
    fs.mkdirSync(serverFolderPath, { recursive: true });
    console.log(`Created folder for guild ${guildId}`);
  }

  const configFilePath = path.join(serverFolderPath, configFileName);

  // 如果配置文件不存在，創建它
  if (!fs.existsSync(configFilePath)) {
    const defaultConfig = {}; // 默認配置，可以根據需求調整
    fs.writeFileSync(configFilePath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    console.log(`Created default config file for guild ${guildId}`);
  }

  return configFilePath;
};

// 加載伺服器的配置文件
export const loadServerConfig = (guildId, configFileName) => {
  const configFilePath = initServerConfig(guildId, configFileName);
  const configData = fs.readFileSync(configFilePath, 'utf-8');
  return JSON.parse(configData);
};

// 更新伺服器的配置文件
export const updateServerConfig = (guildId, configFileName, newConfig) => {
  const configFilePath = initServerConfig(guildId, configFileName);
  fs.writeFileSync(configFilePath, JSON.stringify(newConfig, null, 2), 'utf-8');
  console.log(`Updated config file for guild ${guildId}`);
};