import { Events } from "discord.js";

export const event = {
    name: Events.ClientReady,
    once: true
}

export const action = (readyClient) => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
	console.log('教學來自Proladon https://www.youtube.com/playlist?list=PLSCgthA1AnidGdmSea6V6N24O8mXESrf3');
}