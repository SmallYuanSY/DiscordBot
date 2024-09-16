import { Client, GatewayIntentBits } from 'discord.js';
import vueInit from '@/core/vue';
import dotenv from 'dotenv';
import { useAppStore } from '@/store/app';
import { loadCommands, loadEvents } from '@/core/loader';

console.log('CLIENT_ID:', process.env.CLIENT_ID);
console.log('GUILD_ID:', process.env.GUILD_ID);
console.log('TOKEN:', process.env.TOKEN);
vueInit();
dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
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
