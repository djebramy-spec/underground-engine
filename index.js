const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');

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

          // Handle incoming messages
          bot.on("message", (msg) => {
            const userId = msg.from.id;

              if (!db.users[userId]) {
                  db.users[userId] = {
                        songs: [],
                              playlists: {},
                                    favorites: [],
                                          history: [],
                                                playCount: {}
                                                    };
                                                      }

                                                        const user = db.users[userId];

                                                          if (msg.audio) {
                                                              user.songs.push({
                                                                    fileId: msg.audio.file_id,
                                                                          title: msg.audio.title || "Unknown",
                                                                                artist: msg.audio.artist || "Unknown",
                                                                                      album: msg.audio.album || "Unknown",
                                                                                            duration: msg.audio.duration
                                                                                                });

                                                                                                    saveDB();
                                                                                                        bot.sendMessage(msg.chat.id, "Song indexed!");
                                                                                                          }
                                                                                                          });

                                                                                                          // Commands
                                                                                                          bot.onText(/\/library/, (msg) => {
                                                                                                            const userId = msg.from.id;
                                                                                                              const user = db.users[userId];
                                                                                                                let text = user.songs.map((s, i) => `${i+1}. ${s.title} - ${s.artist}`).join("\n");
                                                                                                                  bot.sendMessage(msg.chat.id, text || "Library empty.");
                                                                                                                  });

                                                                                                                  bot.onText(/\/random/, (msg) => {
                                                                                                                    const userId = msg.from.id;
                                                                                                                      const user = db.users[userId];
                                                                                                                        if (user.songs.length === 0) return bot.sendMessage(msg.chat.id, "Library empty.");
                                                                                                                          let song = user.songs[Math.floor(Math.random() * user.songs.length)];
                                                                                                                            bot.sendAudio(msg.chat.id, song.fileId);
                                                                                                                            });

                                                                                                                            // Keep Render happy
                                                                                                                            require("http")
                                                                                                                              .createServer((req, res) => res.end("Bot running"))
                                                                                                                                .listen(process.env.PORT || 3000);