const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');

const token = process.env.TOKEN;
const storageChannel = process.env.STORAGE_CHANNEL;

const bot = new TelegramBot(token, { polling: true });

// ---------- Database ----------
let db = { users: {} };
function saveDB() { fs.writeJsonSync("database.json", db); }
function loadDB() { if (fs.existsSync("database.json")) db = fs.readJsonSync("database.json"); }
function getUser(id) { 
  if (!db.users[id]) db.users[id] = { songs: [], favorites: [], playlists: {}, history: [], playCount: {} };
    return db.users[id]; 
    }
    loadDB();

    // ---------- Inline Keyboards ----------
    function mainMenuKeyboard() {
      return {
          reply_markup: {
                inline_keyboard: [
                        [{ text: "📚 Library", callback_data: "menu:library" }],
                                [{ text: "⭐ Favorites", callback_data: "menu:favorites" }],
                                        [{ text: "📂 Playlists", callback_data: "menu:playlists" }],
                                                [{ text: "⏱ Recent", callback_data: "menu:recent" }],
                                                        [{ text: "📊 Top Played", callback_data: "menu:top" }]
                                                              ]
                                                                  }
                                                                    };
                                                                    }

                                                                    function createSongKeyboard(index) {
                                                                      return {
                                                                          reply_markup: {
                                                                                inline_keyboard: [
                                                                                        [{ text: "🎵 Play", callback_data: `play:${index}` }],
                                                                                                [{ text: "⭐ Favorite", callback_data: `fav:${index}` }]
                                                                                                      ]
                                                                                                          }
                                                                                                            };
                                                                                                            }

                                                                                                            // ---------- Commands ----------
                                                                                                            bot.setMyCommands([
                                                                                                              { command: "start", description: "Open the main menu" },
                                                                                                                { command: "yt", description: "Search and download a song from YouTube" }
                                                                                                                ]);

                                                                                                                bot.onText(/\/start/, msg => {
                                                                                                                  bot.sendMessage(msg.chat.id, "Welcome to Underground Music Bot! Use the menu below:", mainMenuKeyboard());
                                                                                                                  });

                                                                                                                  // ---------- Upload to Storage Channel ----------
                                                                                                                  async function uploadToStorageChannel(audio, title="Unknown", artist="Unknown") {
                                                                                                                    const sent = await bot.sendAudio(storageChannel, audio, { caption: `${title} - ${artist}` });
                                                                                                                      return sent.audio.file_id;
                                                                                                                      }

                                                                                                                      // ---------- Handle User Audio Upload ----------
                                                                                                                      bot.on("message", async msg => {
                                                                                                                        if (!msg.audio) return;

                                                                                                                          const user = getUser(msg.from.id);
                                                                                                                            const audio = msg.audio;

                                                                                                                              // Upload to storage channel and get file_id
                                                                                                                                const fileId = await uploadToStorageChannel(audio.file_id, audio.title, audio.artist);

                                                                                                                                  // Add to user library
                                                                                                                                    user.songs.push({
                                                                                                                                        fileId,
                                                                                                                                            title: audio.title || "Unknown",
                                                                                                                                                artist: audio.artist || "Unknown",
                                                                                                                                                    duration: audio.duration
                                                                                                                                                      });

                                                                                                                                                        saveDB();
                                                                                                                                                          bot.sendMessage(msg.chat.id, `Indexed and stored: ${audio.title || "Unknown"}`);
                                                                                                                                                          });

                                                                                                                                                          // ---------- YouTube Search Command ----------
                                                                                                                                                          bot.onText(/\/yt (.+)/, async (msg, match) => {
                                                                                                                                                            const chatId = msg.chat.id;
                                                                                                                                                              const user = getUser(msg.from.id);
                                                                                                                                                                const query = match[1] + " official audio"; // bias toward music

                                                                                                                                                                  const results = await ytSearch(query);
                                                                                                                                                                    if (!results.videos.length) return bot.sendMessage(chatId, "No results found.");
                                                                                                                                                                      const top = results.videos.slice(0, 5);

                                                                                                                                                                        const keyboard = top.map(video => [{ text: `${video.title} (${video.timestamp})`, callback_data: `yt:${video.url}` }]);
                                                                                                                                                                          bot.sendMessage(chatId, "Select a song to download:", { reply_markup: { inline_keyboard: keyboard } });
                                                                                                                                                                          });

                                                                                                                                                                          // ---------- Handle Inline Buttons ----------
                                                                                                                                                                          bot.on("callback_query", async query => {
                                                                                                                                                                            const chatId = query.message.chat.id;
                                                                                                                                                                              const user = getUser(query.from.id);
                                                                                                                                                                                const [action, arg] = query.data.split(":");

                                                                                                                                                                                  if (action === "play") {
                                                                                                                                                                                      const index = parseInt(arg);
                                                                                                                                                                                          const song = user.songs[index];
                                                                                                                                                                                              bot.sendAudio(chatId, song.fileId, {}, createSongKeyboard(index));
                                                                                                                                                                                                }

                                                                                                                                                                                                  if (action === "fav") {
                                                                                                                                                                                                      const index = parseInt(arg);
                                                                                                                                                                                                          const song = user.songs[index];
                                                                                                                                                                                                              if (!user.favorites.includes(song.fileId)) user.favorites.push(song.fileId);
                                                                                                                                                                                                                  saveDB();
                                                                                                                                                                                                                      bot.sendMessage(chatId, `Added to favorites: ${song.title}`);
                                                                                                                                                                                                                        }

                                                                                                                                                                                                                          if (action === "yt") {
                                                                                                                                                                                                                              const url = arg;
                                                                                                                                                                                                                                  bot.sendMessage(chatId, "Downloading and storing in your private channel...");

                                                                                                                                                                                                                                      const stream = ytdl(url, { filter: "audioonly" });
                                                                                                                                                                                                                                          const chunks = [];
                                                                                                                                                                                                                                              stream.on("data", chunk => chunks.push(chunk));
                                                                                                                                                                                                                                                  stream.on("end", async () => {
                                                                                                                                                                                                                                                        const buffer = Buffer.concat(chunks);

                                                                                                                                                                                                                                                              // Upload to storage channel
                                                                                                                                                                                                                                                                    const sent = await bot.sendAudio(storageChannel, buffer, { caption: "Downloaded from YouTube" });
                                                                                                                                                                                                                                                                          const fileId = sent.audio.file_id;

                                                                                                                                                                                                                                                                                // Add to user library
                                                                                                                                                                                                                                                                                      const info = await ytdl.getInfo(url);
                                                                                                                                                                                                                                                                                            user.songs.push({
                                                                                                                                                                                                                                                                                                    fileId,
                                                                                                                                                                                                                                                                                                            title: info.videoDetails.title,
                                                                                                                                                                                                                                                                                                                    artist: info.videoDetails.author.name,
                                                                                                                                                                                                                                                                                                                            duration: parseInt(info.videoDetails.lengthSeconds)
                                                                                                                                                                                                                                                                                                                                  });
                                                                                                                                                                                                                                                                                                                                        saveDB();

                                                                                                                                                                                                                                                                                                                                              // Send to user
                                                                                                                                                                                                                                                                                                                                                    bot.sendAudio(chatId, fileId, {}, createSongKeyboard(user.songs.length - 1));
                                                                                                                                                                                                                                                                                                                                                          bot.sendMessage(chatId, `Downloaded and added: ${info.videoDetails.title}`);
                                                                                                                                                                                                                                                                                                                                                              });
                                                                                                                                                                                                                                                                                                                                                                }

                                                                                                                                                                                                                                                                                                                                                                  bot.answerCallbackQuery(query.id);
                                                                                                                                                                                                                                                                                                                                                                  });

                                                                                                                                                                                                                                                                                                                                                                  // ---------- Main Menu Navigation (Library / Favorites / etc.) ----------
                                                                                                                                                                                                                                                                                                                                                                  bot.on("callback_query", async query => {
                                                                                                                                                                                                                                                                                                                                                                    const chatId = query.message.chat.id;
                                                                                                                                                                                                                                                                                                                                                                      const user = getUser(query.from.id);

                                                                                                                                                                                                                                                                                                                                                                        if (query.data === "menu:library") {
                                                                                                                                                                                                                                                                                                                                                                            if (!user.songs.length) return bot.sendMessage(chatId, "Your library is empty!");
                                                                                                                                                                                                                                                                                                                                                                                user.songs.forEach((song, index) => {
                                                                                                                                                                                                                                                                                                                                                                                      bot.sendMessage(chatId, `${song.title} - ${song.artist}`, createSongKeyboard(index));
                                                                                                                                                                                                                                                                                                                                                                                          });
                                                                                                                                                                                                                                                                                                                                                                                            }

                                                                                                                                                                                                                                                                                                                                                                                              if (query.data === "menu:favorites") {
                                                                                                                                                                                                                                                                                                                                                                                                  if (!user.favorites.length) return bot.sendMessage(chatId, "No favorites yet!");
                                                                                                                                                                                                                                                                                                                                                                                                      user.favorites.forEach(fileId => bot.sendAudio(chatId, fileId));
                                                                                                                                                                                                                                                                                                                                                                                                        }

                                                                                                                                                                                                                                                                                                                                                                                                          // Add similar menus for playlists, recent, top
                                                                                                                                                                                                                                                                                                                                                                                                          });