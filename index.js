const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');

// Load token from Render
const token = process.env.TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Database
let db = { users: {} };

function saveDB() {
  fs.writeJsonSync("database.json", db);
  }

  function loadDB() {
    if (fs.existsSync("database.json")) {
        db = fs.readJsonSync("database.json");
          }
          }

          loadDB();

          // Helper functions
          function getUser(id) {
            if (!db.users[id]) {
                db.users[id] = { songs: [], playlists: {}, favorites: [], history: [], playCount: {} };
                  }
                    return db.users[id];
                    }

                    function addSong(user, audio) {
                      user.songs.push({
                          fileId: audio.file_id,
                              title: audio.title || "Unknown",
                                  artist: audio.artist || "Unknown",
                                      album: audio.album || "Unknown",
                                          duration: audio.duration
                                            });
                                              saveDB();
                                              }

                                              // Inline keyboard helper
                                              function createSongKeyboard(songIndex) {
                                                return {
                                                    reply_markup: {
                                                          inline_keyboard: [
                                                                  [{ text: "🎵 Play", callback_data: `play:${songIndex}` }],
                                                                          [{ text: "⭐ Favorite", callback_data: `fav:${songIndex}` }]
                                                                                ]
                                                                                    }
                                                                                      };
                                                                                      }

                                                                                      // Handle uploaded audio
                                                                                      bot.on("message", (msg) => {
                                                                                        const userId = msg.from.id;
                                                                                          const user = getUser(userId);

                                                                                            if (msg.audio) {
                                                                                                addSong(user, msg.audio);
                                                                                                    bot.sendMessage(msg.chat.id, `Indexed: ${msg.audio.title || "Unknown"}`);
                                                                                                      }
                                                                                                      });

                                                                                                      // Commands
                                                                                                      bot.onText(/\/library/, (msg) => {
                                                                                                        const user = getUser(msg.from.id);
                                                                                                          if (user.songs.length === 0) return bot.sendMessage(msg.chat.id, "Library empty.");
                                                                                                            
                                                                                                              let text = user.songs.map((s, i) => `${i+1}. ${s.title} - ${s.artist}`).join("\n");
                                                                                                                bot.sendMessage(msg.chat.id, text);
                                                                                                                });

                                                                                                                bot.onText(/\/random/, (msg) => {
                                                                                                                  const user = getUser(msg.from.id);
                                                                                                                    if (user.songs.length === 0) return bot.sendMessage(msg.chat.id, "Library empty.");
                                                                                                                      
                                                                                                                        let idx = Math.floor(Math.random() * user.songs.length);
                                                                                                                          let song = user.songs[idx];

                                                                                                                            user.history.push(song);
                                                                                                                              user.playCount[song.title] = (user.playCount[song.title] || 0) + 1;
                                                                                                                                saveDB();

                                                                                                                                  bot.sendAudio(msg.chat.id, song.fileId, {}, createSongKeyboard(idx));
                                                                                                                                  });

                                                                                                                                  // Playlist commands
                                                                                                                                  bot.onText(/\/createplaylist (.+)/, (msg, match) => {
                                                                                                                                    const user = getUser(msg.from.id);
                                                                                                                                      const name = match[1].trim();
                                                                                                                                        if (!name) return bot.sendMessage(msg.chat.id, "Playlist name required.");

                                                                                                                                          if (user.playlists[name]) return bot.sendMessage(msg.chat.id, "Playlist exists.");
                                                                                                                                            user.playlists[name] = [];
                                                                                                                                              saveDB();
                                                                                                                                                bot.sendMessage(msg.chat.id, `Playlist "${name}" created.`);
                                                                                                                                                });

                                                                                                                                                bot.onText(/\/addtoplaylist (\S+) (\d+)/, (msg, match) => {
                                                                                                                                                  const user = getUser(msg.from.id);
                                                                                                                                                    const name = match[1];
                                                                                                                                                      const songIndex = parseInt(match[2]) - 1;

                                                                                                                                                        if (!user.playlists[name]) return bot.sendMessage(msg.chat.id, "Playlist not found.");
                                                                                                                                                          if (!user.songs[songIndex]) return bot.sendMessage(msg.chat.id, "Song not found.");

                                                                                                                                                            user.playlists[name].push(user.songs[songIndex]);
                                                                                                                                                              saveDB();
                                                                                                                                                                bot.sendMessage(msg.chat.id, `Added "${user.songs[songIndex].title}" to "${name}".`);
                                                                                                                                                                });

                                                                                                                                                                bot.onText(/\/playlist (\S+)/, (msg, match) => {
                                                                                                                                                                  const user = getUser(msg.from.id);
                                                                                                                                                                    const name = match[1];

                                                                                                                                                                      if (!user.playlists[name]) return bot.sendMessage(msg.chat.id, "Playlist not found.");
                                                                                                                                                                        if (user.playlists[name].length === 0) return bot.sendMessage(msg.chat.id, "Playlist empty.");

                                                                                                                                                                          let text = user.playlists[name].map((s, i) => `${i+1}. ${s.title} - ${s.artist}`).join("\n");
                                                                                                                                                                            bot.sendMessage(msg.chat.id, text);
                                                                                                                                                                            });

                                                                                                                                                                            // Favorites
                                                                                                                                                                            bot.onText(/\/favorites/, (msg) => {
                                                                                                                                                                              const user = getUser(msg.from.id);
                                                                                                                                                                                if (user.favorites.length === 0) return bot.sendMessage(msg.chat.id, "No favorites yet.");
                                                                                                                                                                                  
                                                                                                                                                                                    let text = user.favorites.map((s, i) => `${i+1}. ${s.title} - ${s.artist}`).join("\n");
                                                                                                                                                                                      bot.sendMessage(msg.chat.id, text);
                                                                                                                                                                                      });

                                                                                                                                                                                      // Callback queries (inline buttons)
                                                                                                                                                                                      bot.on("callback_query", (query) => {
                                                                                                                                                                                        const user = getUser(query.from.id);
                                                                                                                                                                                          const [action, idx] = query.data.split(":");
                                                                                                                                                                                            const song = user.songs[parseInt(idx)];

                                                                                                                                                                                              if (action === "play") {
                                                                                                                                                                                                  user.history.push(song);
                                                                                                                                                                                                      user.playCount[song.title] = (user.playCount[song.title] || 0) + 1;
                                                                                                                                                                                                          saveDB();
                                                                                                                                                                                                              bot.sendAudio(query.message.chat.id, song.fileId);
                                                                                                                                                                                                                }

                                                                                                                                                                                                                  if (action === "fav") {
                                                                                                                                                                                                                      if (!user.favorites.find(s => s.fileId === song.fileId)) {
                                                                                                                                                                                                                            user.favorites.push(song);
                                                                                                                                                                                                                                  saveDB();
                                                                                                                                                                                                                                        bot.answerCallbackQuery(query.id, { text: "Added to favorites ⭐" });
                                                                                                                                                                                                                                            } else {
                                                                                                                                                                                                                                                  bot.answerCallbackQuery(query.id, { text: "Already in favorites" });
                                                                                                                                                                                                                                                      }
                                                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                                        });

                                                                                                                                                                                                                                                        // Stats
                                                                                                                                                                                                                                                        bot.onText(/\/top/, (msg) => {
                                                                                                                                                                                                                                                          const user = getUser(msg.from.id);
                                                                                                                                                                                                                                                            let sorted = Object.entries(user.playCount)
                                                                                                                                                                                                                                                                .sort((a,b) => b[1]-a[1])
                                                                                                                                                                                                                                                                    .slice(0, 10);

                                                                                                                                                                                                                                                                      if (sorted.length === 0) return bot.sendMessage(msg.chat.id, "No stats yet.");
                                                                                                                                                                                                                                                                        let text = sorted.map(([title,count]) => `${title}: ${count} plays`).join("\n");
                                                                                                                                                                                                                                                                          bot.sendMessage(msg.chat.id, text);
                                                                                                                                                                                                                                                                          });

                                                                                                                                                                                                                                                                          bot.onText(/\/recent/, (msg) => {
                                                                                                                                                                                                                                                                            const user = getUser(msg.from.id);
                                                                                                                                                                                                                                                                              if (user.history.length === 0) return bot.sendMessage(msg.chat.id, "No recently played songs.");

                                                                                                                                                                                                                                                                                let recent = user.history.slice(-10).reverse();
                                                                                                                                                                                                                                                                                  let text = recent.map(s => `${s.title} - ${s.artist}`).join("\n");
                                                                                                                                                                                                                                                                                    bot.sendMessage(msg.chat.id, text);
                                                                                                                                                                                                                                                                                    });

                                                                                                                                                                                                                                                                                    // Keep Render happy
                                                                                                                                                                                                                                                                                    require("http")
                                                                                                                                                                                                                                                                                      .createServer((req, res) => res.end("Bot running"))
                                                                                                                                                                                                                                                                                        .listen(process.env.PORT || 3000);