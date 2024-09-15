import { SlashCommandBuilder } from 'discord.js';

export const command = new SlashCommandBuilder().setName('ping').setDescription('Ping');

export const action = async (ctx) => 
    {
        ctx.reply('Pong!');
        console.log('Pong!');
    };