import { REST, Routes, Collection } from 'discord.js';
import fg from 'fast-glob';
import { useAppStore } from '@/store/app';
import fs from 'fs';
import path from 'path';

// 更新每個伺服器的 Slash 命令
const updateSlashCommands = async (guildId, commands) => {
    const rest = new REST({ version: 10 }).setToken(process.env.TOKEN);
    const result = await rest.put(
        Routes.applicationGuildCommands(
            process.env.CLIENT_ID,
            guildId  // 為每個伺服器註冊命令
        ),
        {
            body: commands,
        }
    );
    console.log(`Commands updated for guild: ${guildId}`);
    console.log(result);
};

// 讀取所有命令並註冊到各伺服器
export const loadCommands = async () => {
    const appStore = useAppStore();
    const commands = [];
    const actions = new Collection();

    // 找到 `src/commands` 資料夾下的所有指令
    const files = await fg('./src/commands/**/index.js');
    
    for (const file of files) {
        const cmd = await import(file);

        // 確保每個命令都有名稱和描述
        if (!cmd.command.name || !cmd.command.description) {
            console.error(`Command in file ${file} is missing a name or description`);
            continue; // 跳過無效命令
        }

        // 打印命令結構進行調試
        console.log('Registering command:', cmd.command);

        commands.push(cmd.command);
        actions.set(cmd.command.name, cmd.action);
    }

    // 如果沒有找到任何命令，則終止
    if (commands.length === 0) {
        console.error('No valid commands found to register.');
        return;
    }

    // 找到 `config/` 目錄下的所有 guildId 資料夾
    const guildConfigs = fs.readdirSync('./src/config').filter(file => fs.statSync(path.join('./src/config', file)).isDirectory());

    // 針對每個 guildId 註冊命令
    for (const guildId of guildConfigs) {
        await updateSlashCommands(guildId, commands);
    }

    // 保存命令操作映射
    appStore.commandsActionMap = actions;
    console.log(appStore.commandsActionMap);
};

// 載入事件
export const loadEvents = async () => {
    const appStore = useAppStore();
    const client = appStore.client;
    const files = await fg('./src/events/**/index.js');

    for (const file of files) {
        const eventFile = await import(file);
        console.log(`Loading event: ${eventFile.event.name}`);

        if (eventFile.event.once) {
            client.once(eventFile.event.name, eventFile.action);
        } else {
            client.on(eventFile.event.name, eventFile.action);
        }
    }
};