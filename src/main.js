import { Client, GatewayIntentBits } from 'discord.js';
import vueInit from '@/core/vue';
import dotenv from 'dotenv';
import { useAppStore } from '@/store/app';
import { loadCommands, loadEvents } from '@/core/loader';

vueInit();
dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

const appStore = useAppStore();
appStore.client = client;

loadCommands();
loadEvents();

client.login(process.env.TOKEN);

export { client }; // 导出 client 对象
