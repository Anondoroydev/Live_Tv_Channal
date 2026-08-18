const fs = require('fs');
const content = `
#EXTM3U
#EXTINF:-1 tvg-id="1" tvg-logo="" group-title="Movies",The Dark Knight
http://domain.com/movie/user/pass/1234.mp4
#EXTINF:-1 tvg-id="2" tvg-logo="" group-title="Series",Breaking Bad S1 E1
http://domain.com/series/user/pass/9876.mkv
`;
const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
let currentChannel = null;
const parsedChannels = [];
for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line || line.startsWith("#EXTM3U")) continue;
    if (line.startsWith("#EXTINF:")) {
        currentChannel = { isActive: true, category: "General" };
        let nameMatch = line.substring(8).split(",");
        currentChannel.name = nameMatch[1];
    } else if (!line.startsWith("#")) {
        let streamUrl = line;
        if (
            /^[a-z0-9]+:\/\//i.test(streamUrl) ||
            streamUrl.startsWith("http") ||
            streamUrl.startsWith("//") ||
            /\.(m3u8|m3u|ts|mp4|mkv|flv|avi|mov|wmv|webm|m4v|3gp|mp3|aac|m4a|ogg|mpd)(\?.*)?$/i.test(streamUrl) ||
            /\/live\/|\/play\/|\/stream\/|\/get\.php/i.test(streamUrl) ||
            streamUrl.length > 5
        ) {
            currentChannel.streamUrl = streamUrl;
            parsedChannels.push(currentChannel);
            currentChannel = null;
        }
    }
}
console.log(parsedChannels);
