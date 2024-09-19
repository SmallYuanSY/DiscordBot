import fs from 'fs';
import path from 'path';
import { DisTube } from 'distube';
import { YtDlpPlugin } from '@distube/yt-dlp';
import { SpotifyPlugin } from '@distube/spotify';

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
                console.log(`準備播放音樂，文字頻道: ${queue.textChannel ? queue.textChannel.id : '無'}，語音頻道: ${queue.voiceChannel ? queue.voiceChannel.id : '無'}`);

                if (!queue.textChannel || !queue.textChannel.id) {
                    console.error('Text channel is not defined');
                    return;
                }
                
                queue.textChannel.send(`正在播放: ${song.name}`);
            })
            .on('addSong', (queue, song) => {
                if (!queue.textChannel || !queue.textChannel.id) {
                    console.error('Text channel is not defined');
                    return;
                }

                queue.textChannel.send(`已添加: ${song.name}`);
            })
            .on('error', (channel, error) => {
                console.error(`Error in channel ${channel?.id || 'undefined'}:`, error);
            
                if (channel && channel.send) {
                    channel.send(`發生錯誤: ${error.toString()}`);
                } else {
                    console.error('無法在頻道中發送錯誤訊息');
                }
            });
    }

    return distube;
};