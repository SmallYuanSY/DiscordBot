import fs from 'fs';
import path from 'path';
import { DisTube } from 'distube';
import { YtDlpPlugin } from '@distube/yt-dlp';
import { SpotifyPlugin } from '@distube/spotify';
import { EmbedBuilder } from 'discord.js';

let distube;

export const getDistubeInstance = (client) => {
    if (!distube) {
        distube = new DisTube(client, {
            emitNewSongOnly: true,
            plugins: [
                new SpotifyPlugin({
                    api: {
                        clientId: process.env.SPOTIFY_CLIENT_ID,
                        clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
                    },
                }),
                new YtDlpPlugin(),
            ],
        });

        distube
            .on('playSong', (queue, song) => {
                if (!queue.textChannel || !queue.textChannel.id) {
                    console.error('Text channel is not defined');
                    return;
                }
                
                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('正在播放')
                    .setDescription(`[${song.name}](${song.url})`)
                    .addFields(
                        { name: '時長', value: song.formattedDuration, inline: true },
                    )
                    .setThumbnail(song.thumbnail);

                queue.textChannel.send({ embeds: [embed] }).catch(console.error);
            })
            .on('addSong', (queue, song) => {
                if (!queue.textChannel || !queue.textChannel.id) {
                    console.error('Text channel is not defined');
                    return;
                }

                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('已添加到播放列表')
                    .setDescription(`[${song.name}](${song.url})`)
                    .addFields(
                        { name: '時長', value: song.formattedDuration, inline: true },
                    )
                    .setThumbnail(song.thumbnail);

                queue.textChannel.send({ embeds: [embed] }).catch(console.error);
            })
            .on('error', (channel, error) => {
                console.error(`Error in channel ${channel?.id || 'undefined'}:`, error);
            
                if (channel && channel.send) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('錯誤')
                        .setDescription(`發生錯誤: ${error.toString()}`);

                    channel.send({ embeds: [errorEmbed] }).catch(console.error);
                } else {
                    console.error('無法在頻道中發送錯誤訊息');
                }
            });
    }

    return distube;
};