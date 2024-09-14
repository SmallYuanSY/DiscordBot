import { REST, Routes, Collection } from 'discord.js'
import fg from 'fast-glob'
import { useAppStore } from '@/store/app'


const updateSlashCommands = async(commands) => {
    const rest = new REST({version: 10}).setToken(process.env.TOKEN);
    const result = await rest.put(
        Routes.applicationGuildCommands(
            process.env.CLIENT_ID,
            process.env.GUILD_ID
        ),
        {
            body: commands,
        }
    )

    console.log(result)
}

export const loadCommands = async() => {
    const appStore = useAppStore();
    const commands = [];
    const actions = new Collection();
    const files = await fg('./src/commands/**/index.js');

    for(const file of files){
        const cmd = await import(file);

        // 檢查命令是否包含名稱和描述
        if (!cmd.command.name || !cmd.command.description) {
            console.error(`Command in file ${file} is missing a name or description`);
            continue; // 跳過無效的命令
        }

        // 打印命令的結構以進行調試
        console.log('Registering command:', cmd.command);

        commands.push(cmd.command);
        actions.set(cmd.command.name, cmd.action);
    }

    // 確保命令數組不為空，然後註冊命令
    if (commands.length > 0) {
        await updateSlashCommands(commands);
    } else {
        console.error('No valid commands to register');
    }

    appStore.commandsActionMap = actions;
    console.log(appStore.commandsActionMap);
}

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