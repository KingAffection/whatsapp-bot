import http from "http";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";

// =====================================================
// 🤖 MR. AFFECTION WHATSAPP BOT
// =====================================================

const PORT = process.env.PORT || 3000;

const PHONE_NUMBER = process.env.PHONE_NUMBER;
const OWNER_NUMBER = process.env.OWNER_NUMBER;

const BOT_NAME = "ᴍʀ. ᴀғғᴇᴄᴛɪᴏɴ࿐❤️";
const OWNER_NAME = "ᴍʀ. ᴀғғᴇᴄᴛɪᴏɴ࿐❤️";

const TIKTOK = "www.tiktok.com/@mraffection07";

const PREFIX = ".";

// 🔒 PRIVATE BOT
const PRIVATE_MODE = true;

// =====================================================
// ⚙️ FEATURES
// =====================================================

let antiLinkEnabled = false;
let antiDeleteEnabled = false;
let autoStatusEnabled = false;
let autoReplyEnabled = false;
let viewOnceEnabled = false;

// =====================================================
// 🧠 MESSAGE MEMORY
// =====================================================

const messageStore = new Map();
const MAX_MESSAGES = 300;

// =====================================================
// 🌐 RENDER WEB SERVER
// =====================================================

http.createServer((req, res) => {

  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end(
    `${BOT_NAME}\nWhatsApp Bot is online.\n`
  );

}).listen(PORT, () => {

  console.log(
    `🌐 Web server running on port ${PORT}`
  );

});

// =====================================================
// 🔢 NUMBER FUNCTIONS
// =====================================================

function cleanNumber(number = "") {

  return String(number)
    .replace(/\D/g, "");

}

function getNumberFromJid(jid = "") {

  return String(jid)
    .split("@")[0]
    .split(":")[0]
    .replace(/\D/g, "");

}

// =====================================================
// 👑 OWNER CHECK
// =====================================================

function isOwner(message) {

  // Si mesaj la soti nan kont bot la menm
  if (
    message?.key?.fromMe === true
  ) {

    return true;

  }

  const ownerNumber =
    cleanNumber(OWNER_NUMBER);

  if (!ownerNumber) {

    return false;

  }

  const candidates = [
    message?.key?.participant,
    message?.key?.remoteJid,
    message?.participant
  ].filter(Boolean);

  return candidates.some(
    jid =>
      getNumberFromJid(jid) ===
      ownerNumber
  );

}

// =====================================================
// 🔗 LINK DETECTOR
// =====================================================

function containsLink(text = "") {

  return /(https?:\/\/|www\.|chat\.whatsapp\.com\/|t\.me\/|discord\.gg\/)/i
    .test(text);

}

// =====================================================
// 📤 SEND TEXT
// =====================================================

async function sendText(
  sock,
  jid,
  text
) {

  if (!jid) {

    console.log(
      "❌ No JID available."
    );

    return;

  }

  try {

    await sock.sendMessage(
      jid,
      {
        text: String(text)
      }
    );

    console.log(
      `📤 Message sent to ${jid}`
    );

  } catch (error) {

    console.log(
      "❌ SEND ERROR:",
      error?.message || error
    );

  }

}

// =====================================================
// 👑 SEND TO OWNER
// =====================================================

async function sendToOwner(
  sock,
  text
) {

  if (!OWNER_NUMBER) {

    console.log(
      "❌ OWNER_NUMBER missing."
    );

    return;

  }

  const ownerJid =
    `${cleanNumber(OWNER_NUMBER)}@s.whatsapp.net`;

  await sendText(
    sock,
    ownerJid,
    text
  );

}

// =====================================================
// 💾 SAVE MESSAGE
// =====================================================

function saveMessage(message) {

  const id =
    message?.key?.id;

  if (!id) {

    return;

  }

  messageStore.set(
    id,
    message
  );

  while (
    messageStore.size >
    MAX_MESSAGES
  ) {

    const firstKey =
      messageStore
        .keys()
        .next()
        .value;

    if (!firstKey) {

      break;

    }

    messageStore.delete(
      firstKey
    );

  }

}

// =====================================================
// 👁️ VIEW ONCE DETECTOR
// =====================================================

function isViewOnce(message) {

  const content =
    message?.message;

  if (!content) {

    return false;

  }

  return Boolean(
    content.viewOnceMessage ||
    content.viewOnceMessageV2 ||
    content.viewOnceMessageV2Extension
  );

}

// =====================================================
// 📝 GET MESSAGE TEXT
// =====================================================

function getMessageText(message) {

  const content =
    message?.message;

  if (!content) {

    return "";

  }

  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    content.buttonsResponseMessage
      ?.selectedButtonId ||
    content.listResponseMessage
      ?.singleSelectReply
      ?.selectedRowId ||
    ""
  );

}

// =====================================================
// 🚀 START BOT
// =====================================================

async function startBot() {

  if (!PHONE_NUMBER) {

    console.log(
      "❌ PHONE_NUMBER pa jwenn nan Render."
    );

    return;

  }

  if (!OWNER_NUMBER) {

    console.log(
      "❌ OWNER_NUMBER pa jwenn nan Render."
    );

    return;

  }

  console.log("");
  console.log(
    "=============================================="
  );

  console.log(
    `🤖 STARTING ${BOT_NAME}`
  );

  console.log(
    "🔒 PRIVATE MODE: ON"
  );

  console.log(
    "=============================================="
  );

  // ===================================================
  // 🔐 AUTH
  // ===================================================

  const {
    state,
    saveCreds
  } =
    await useMultiFileAuthState(
      "./auth_info"
    );

  // ===================================================
  // 📱 WHATSAPP SOCKET
  // ===================================================

  const sock =
    makeWASocket({

      auth: state,

      logger:
        pino({
          level: "silent"
        }),

      printQRInTerminal: false,

      emitOwnEvents: true,

      markOnlineOnConnect: false,

      syncFullHistory: false

    });

  // ===================================================
  // 💾 SAVE CREDENTIALS
  // ===================================================

  sock.ev.on(
    "creds.update",
    saveCreds
  );

  // ===================================================
  // 📲 CONNECTION
  // ===================================================

  let pairingRequested = false;

  let connectionMessageSent = false;

  sock.ev.on(
    "connection.update",
    async update => {

      const {
        connection,
        lastDisconnect,
        qr
      } = update;

      // -----------------------------------------------
      // PAIRING CODE
      // -----------------------------------------------

      if (
        !state.creds.registered &&
        !pairingRequested &&
        (
          connection === "connecting" ||
          qr
        )
      ) {

        pairingRequested = true;

        try {

          await new Promise(
            resolve =>
              setTimeout(
                resolve,
                2000
              )
          );

          const code =
            await sock.requestPairingCode(
              cleanNumber(
                PHONE_NUMBER
              )
            );

          console.log("");
          console.log(
            "=============================================="
          );

          console.log(
            "📱 WHATSAPP PAIRING CODE"
          );

          console.log(code);

          console.log(
            "=============================================="
          );

        } catch (error) {

          console.log(
            "❌ PAIRING ERROR:",
            error?.message || error
          );

          pairingRequested = false;

        }

      }

      // -----------------------------------------------
      // ✅ CONNECTED
      // -----------------------------------------------

      if (
        connection === "open"
      ) {

        console.log("");
        console.log(
          "=============================================="
        );

        console.log(
          `✅ ${BOT_NAME}`
        );

        console.log(
          "✅ WHATSAPP CONNECTED"
        );

        console.log(
          "🔒 PRIVATE MODE ACTIVE"
        );

        console.log(
          "⚡ READY FOR COMMANDS"
        );

        console.log(
          "📩 MESSAGE LISTENER ACTIVE"
        );

        console.log(
          "=============================================="
        );

        // =================================================
        // 📩 AUTOMATIC OWNER MESSAGE
        // =================================================

        if (
          !connectionMessageSent
        ) {

          connectionMessageSent = true;

          await new Promise(
            resolve =>
              setTimeout(
                resolve,
                1500
              )
          );

          await sendToOwner(
            sock,

            `🤖 *BOT LA DISPONIB!*\n\n` +

            `👋 Mwen la! Mwen pare pou resevwa kòmand ou yo.\n\n` +

            `👑 *Mèt bot la:* ${OWNER_NAME}\n` +

            `🤖 *Non bot la:* ${BOT_NAME}\n` +

            `🔑 *Prefix:* ${PREFIX}\n` +

            `🎵 *TikTok:* ${TIKTOK}\n\n` +

            `⚡ Ekri *${PREFIX}menu* pou wè tout kòmand yo.`
          );

        }

      }

      // -----------------------------------------------
      // ❌ DISCONNECTED
      // -----------------------------------------------

      if (
        connection === "close"
      ) {

        const statusCode =
          lastDisconnect
            ?.error
            ?.output
            ?.statusCode;

        console.log(
          `⚠️ WhatsApp connection closed. Code: ${statusCode}`
        );

        if (
          statusCode !==
          DisconnectReason.loggedOut
        ) {

          console.log(
            "🔄 Restarting WhatsApp connection..."
          );

          setTimeout(
            () => {
              startBot();
            },
            3000
          );

        } else {

          console.log(
            "❌ WhatsApp logged out."
          );

        }

      }

    }
  );

  // ===================================================
  // 📨 MESSAGE LISTENER
  // ===================================================

  sock.ev.on(
    "messages.upsert",
    async event => {

      try {

        console.log("");
        console.log(
          "📩 MESSAGE EVENT RECEIVED"
        );

        console.log(
          `📦 Type: ${event?.type}`
        );

        console.log(
          `📦 Count: ${event?.messages?.length || 0}`
        );

        // Nou enterese sitou nan nouvo mesaj
        if (
          event?.type !== "notify"
        ) {

          console.log(
            "ℹ️ Non-notify event."
          );

          return;

        }

        // Trete tout mesaj yo
        for (
          const message
          of event.messages || []
        ) {

          if (
            !message ||
            !message.message
          ) {

            continue;

          }

          const remoteJid =
            message?.key?.remoteJid ||
            "";

          const fromMe =
            message?.key?.fromMe === true;

          const owner =
            isOwner(message);

          console.log(
            "----------------------------------------------"
          );

          console.log(
            `📨 Chat: ${remoteJid}`
          );

          console.log(
            `👤 FromMe: ${fromMe}`
          );

          console.log(
            `👑 Owner: ${owner}`
          );

          // =================================================
          // 💾 SAVE FOR ANTIDELETE
          // =================================================

          if (
            antiDeleteEnabled
          ) {

            saveMessage(
              message
            );

          }

          // =================================================
          // 👁️ VIEW ONCE
          // =================================================

          if (
            viewOnceEnabled &&
            !fromMe &&
            isViewOnce(message)
          ) {

            console.log(
              "👁️ VIEW ONCE DETECTED"
            );

            await sendToOwner(
              sock,

              `👁️ *VIEW ONCE DETECTED*\n\n` +
              `Yon moun voye yon View Once.\n\n` +
              `Bot la detekte li, men li pap kontoune pwoteksyon View Once WhatsApp la.`
            );

          }

          // =================================================
          // 👀 AUTO STATUS
          // =================================================

          if (
            autoStatusEnabled &&
            remoteJid === "status@broadcast"
          ) {

            try {

              await sock.readMessages([
                message.key
              ]);

              console.log(
                "👀 Status viewed."
              );

            } catch (error) {

              console.log(
                "❌ Status error:",
                error?.message || error
              );

            }

            continue;

          }

          // =================================================
          // 📝 TEXT
          // =================================================

          const text =
            getMessageText(
              message
            );

          const cleanText =
            String(text)
              .trim();

          console.log(
            `💬 Text: ${cleanText || "[NO TEXT]"}`
          );

          // =================================================
          // 🔗 ANTI-LINK
          // =================================================

          if (
            antiLinkEnabled &&
            !fromMe &&
            remoteJid.endsWith("@g.us") &&
            containsLink(cleanText)
          ) {

            try {

              await sock.sendMessage(
                remoteJid,
                {
                  delete:
                    message.key
                }
              );

              await sendText(
                sock,
                remoteJid,

                `🚫 *ANTI-LINK*\n\n` +
                `Lyen yo pa otorize nan group sa.\n` +
                `🤖 ${BOT_NAME}`
              );

            } catch (error) {

              console.log(
                "❌ Anti-Link error:",
                error?.message || error
              );

            }

            continue;

          }

          // =================================================
          // 💬 AUTO REPLY
          // =================================================

          if (
            autoReplyEnabled &&
            !fromMe &&
            !cleanText.startsWith(PREFIX)
          ) {

            const lowerText =
              cleanText.toLowerCase();

            if (
              [
                "hi",
                "hello",
                "hey",
                "bonjou",
                "slt",
                "salut"
              ].includes(
                lowerText
              )
            ) {

              await sendText(
                sock,
                remoteJid,

                `👋 Bonjou!\n\n` +
                `🤖 ${BOT_NAME}\n` +
                `Mèsi paske ou kontakte nou.\n\n` +
                `Ekri *.menu* pou wè meni an.`
              );

              continue;

            }

            if (
              [
                "help",
                "ede",
                "aide"
              ].includes(
                lowerText
              )
            ) {

              await sendText(
                sock,
                remoteJid,

                `🤖 *${BOT_NAME}*\n\n` +
                `Mwen la pou ede w.\n\n` +
                `Ekri *.menu* pou wè meni an.`
              );

              continue;

            }

          }

          // =================================================
          // 🚫 NOT COMMAND
          // =================================================

          if (
            !cleanText.startsWith(
              PREFIX
            )
          ) {

            continue;

          }

          // =================================================
          // 🔒 PRIVATE MODE
          // =================================================

          if (
            PRIVATE_MODE &&
            !owner
          ) {

            console.log(
              "🔒 Command blocked: not owner."
            );

            // Pa reponn moun ki pa owner
            continue;

          }

          // =================================================
          // COMMAND PARSER
          // =================================================

          const commandText =
            cleanText
              .slice(
                PREFIX.length
              )
              .trim();

          const parts =
            commandText
              .split(/\s+/);

          const command =
            (
              parts[0] || ""
            ).toLowerCase();

          const action =
            (
              parts[1] || ""
            ).toLowerCase();

          console.log(
            `⚡ COMMAND: ${command}`
          );

          console.log(
            `⚙️ ACTION: ${action || "[NONE]"}`
          );

          // =================================================
          // 📋 MENU
          // =================================================

          if (
            command === "menu"
          ) {

            await sendText(
              sock,
              remoteJid,

              `╭━━━━━━━━━━━━━━━━━━━━╮\n` +
              `┃ 🤖 *${BOT_NAME}*\n` +
              `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +

              `👑 *MÈT BOT LA*\n` +
              `${OWNER_NAME}\n\n` +

              `🎵 *TIKTOK*\n` +
              `${TIKTOK}\n\n` +

              `🔑 *PREFIX:* ${PREFIX}\n\n` +

              `━━━━━━━━━━━━━━━━━━━━\n` +
              `📌 *COMMANDS*\n` +
              `━━━━━━━━━━━━━━━━━━━━\n\n` +

              `🔗 *.antilink on*\n` +
              `🔗 *.antilink off*\n\n` +

              `🗑️ *.antidelete on*\n` +
              `🗑️ *.antidelete off*\n\n` +

              `👀 *.autostatus on*\n` +
              `👀 *.autostatus off*\n\n` +

              `💬 *.autoreply on*\n` +
              `💬 *.autoreply off*\n\n` +

              `👁️ *.viewonce on*\n` +
              `👁️ *.viewonce off*\n\n` +

              `📊 *.status*\n` +
              `🏓 *.ping*\n` +
              `👑 *.owner*\n` +
              `🎵 *.tiktok*\n\n` +

              `━━━━━━━━━━━━━━━━━━━━\n` +
              `🔒 *PRIVATE OWNER MODE*\n` +
              `━━━━━━━━━━━━━━━━━━━━`
            );

            continue;

          }

          // =================================================
          // 🏓 PING
          // =================================================

          if (
            command === "ping"
          ) {

            const start =
              Date.now();

            await sendText(
              sock,
              remoteJid,
              "🏓 *PONG!*"
            );

            const ms =
              Date.now() - start;

            await sendText(
              sock,
              remoteJid,

              `⚡ Response: ${ms}ms\n` +
              `🤖 ${BOT_NAME}\n` +
              `🟢 Bot la online.`
            );

            continue;

          }

          // =================================================
          // 👑 OWNER
          // =================================================

          if (
            command === "owner"
          ) {

            await sendText(
              sock,
              remoteJid,

              `👑 *BOT OWNER*\n\n` +
              `${OWNER_NAME}\n\n` +
              `🤖 *BOT*\n` +
              `${BOT_NAME}`
            );

            continue;

          }

          // =================================================
          // 🎵 TIKTOK
          // =================================================

          if (
            command === "tiktok"
          ) {

            await sendText(
              sock,
              remoteJid,

              `🎵 *TIKTOK*\n\n` +
              `${TIKTOK}`
            );

            continue;

          }

          // =================================================
          // 📊 STATUS
          // =================================================

          if (
            command === "status"
          ) {

            await sendText(
              sock,
              remoteJid,

              `📊 *${BOT_NAME} STATUS*\n\n` +

              `🔒 Private Mode: ON\n\n` +

              `🔗 Anti-Link: ${
                antiLinkEnabled
                  ? "ON ✅"
                  : "OFF ❌"
              }\n` +

              `🗑️ Anti-Delete: ${
                antiDeleteEnabled
                  ? "ON ✅"
                  : "OFF ❌"
              }\n` +

              `👀 Auto-Status: ${
                autoStatusEnabled
                  ? "ON ✅"
                  : "OFF ❌"
              }\n` +

              `💬 Auto-Reply: ${
                autoReplyEnabled
                  ? "ON ✅"
                  : "OFF ❌"
              }\n` +

              `👁️ View Once Detection: ${
                viewOnceEnabled
                  ? "ON ✅"
                  : "OFF ❌"
              }`
            );

            continue;

          }

          // =================================================
          // 🔗 ANTILINK
          // =================================================

          if (
            command === "antilink"
          ) {

            if (
              action === "on"
            ) {

              antiLinkEnabled =
                true;

              await sendText(
                sock,
                remoteJid,

                `✅ *ANTI-LINK ON*\n\n` +
                `Anti-Link aktive imedyatman.`
              );

              continue;

            }

            if (
              action === "off"
            ) {

              antiLinkEnabled =
                false;

              await sendText(
                sock,
                remoteJid,

                `❌ *ANTI-LINK OFF*\n\n` +
                `Anti-Link dezaktive.`
              );

              continue;

            }

            await sendText(
              sock,
              remoteJid,

              `❓ Itilize:\n\n` +
              `*.antilink on*\n` +
              `*.antilink off*`
            );

            continue;

          }

          // =================================================
          // 🗑️ ANTIDELETE
          // =================================================

          if (
            command === "antidelete"
          ) {

            if (
              action === "on"
            ) {

              antiDeleteEnabled =
                true;

              messageStore.clear();

              await sendText(
                sock,
                remoteJid,

                `✅ *ANTI-DELETE ON*\n\n` +
                `Bot la ap sonje nouvo mesaj yo.`
              );

              continue;

            }

            if (
              action === "off"
            ) {

              antiDeleteEnabled =
                false;

              messageStore.clear();

              await sendText(
                sock,
                remoteJid,

                `❌ *ANTI-DELETE OFF*\n\n` +
                `Anti-Delete dezaktive.`
              );

              continue;

            }

            await sendText(
              sock,
              remoteJid,

              `❓ Itilize:\n\n` +
              `*.antidelete on*\n` +
              `*.antidelete off*`
            );

            continue;

          }

          // =================================================
          // 👀 AUTOSTATUS
          // =================================================

          if (
            command === "autostatus"
          ) {

            if (
              action === "on"
            ) {

              autoStatusEnabled =
                true;

              await sendText(
                sock,
                remoteJid,

                `✅ *AUTO-STATUS ON*\n\n` +
                `Bot la ap eseye wè status otomatikman.`
              );

              continue;

            }

            if (
              action === "off"
            ) {

              autoStatusEnabled =
                false;

              await sendText(
                sock,
                remoteJid,

                `❌ *AUTO-STATUS OFF*\n\n` +
                `Auto-Status dezaktive.`
              );

              continue;

            }

            await sendText(
              sock,
              remoteJid,

              `❓ Itilize:\n\n` +
              `*.autostatus on*\n` +
              `*.autostatus off*`
            );

            continue;

          }

          // =================================================
          // 💬 AUTOREPLY
          // =================================================

          if (
            command === "autoreply"
          ) {

            if (
              action === "on"
            ) {

              autoReplyEnabled =
                true;

              await sendText(
                sock,
                remoteJid,

                `✅ *AUTO-REPLY ON*\n\n` +
                `Auto-Reply aktive imedyatman.`
              );

              continue;

            }

            if (
              action === "off"
            ) {

              autoReplyEnabled =
                false;

              await sendText(
                sock,
                remoteJid,

                `❌ *AUTO-REPLY OFF*\n\n` +
                `Auto-Reply dezaktive.`
              );

              continue;

            }

            await sendText(
              sock,
              remoteJid,

              `❓ Itilize:\n\n` +
              `*.autoreply on*\n` +
              `*.autoreply off*`
            );

            continue;

          }

          // =================================================
          // 👁️ VIEW ONCE
          // =================================================

          if (
            command === "viewonce"
          ) {

            if (
              action === "on"
            ) {

              viewOnceEnabled =
                true;

              await sendText(
                sock,
                remoteJid,

                `✅ *VIEW ONCE DETECTION ON*\n\n` +
                `Bot la ap detekte View Once.\n` +
                `Li pap kontoune pwoteksyon WhatsApp la.`
              );

              continue;

            }

            if (
              action === "off"
            ) {

              viewOnceEnabled =
                false;

              await sendText(
                sock,
                remoteJid,

                `❌ *VIEW ONCE DETECTION OFF*\n\n` +
                `Detection dezaktive.`
              );

              continue;

            }

            await sendText(
              sock,
              remoteJid,

              `❓ Itilize:\n\n` +
              `*.viewonce on*\n` +
              `*.viewonce off*`
            );

            continue;

          }

          // =================================================
          // ❓ UNKNOWN COMMAND
          // =================================================

          await sendText(
            sock,
            remoteJid,

            `❓ Kòmand *${PREFIX}${command}* pa egziste.\n\n` +
            `Ekri *.menu* pou wè tout kòmand yo.`
          );

        }

      } catch (error) {

        console.log("");
        console.log(
          "❌ MESSAGE HANDLER ERROR"
        );

        console.log(
          error?.stack ||
          error?.message ||
          error
        );

      }

    }
  );

  // ===================================================
  // 🗑️ DELETE EVENTS
  // ===================================================

  sock.ev.on(
    "messages.delete",
    async event => {

      try {

        if (!antiDeleteEnabled) {
          return;
        }

        const keys =
          event?.keys || [];

        console.log(
          `🗑️ DELETE EVENT: ${keys.length}`
        );

        for (
          const key
          of keys
        ) {

          const id =
            key?.id;

          if (!id) {
            continue;
          }

          const original =
            messageStore.get(id);

          if (!original) {
            continue;
          }

          const originalText =
            getMessageText(
              original
            );

          const chat =
            key?.remoteJid ||
            "Unknown";

          await sendToOwner(
            sock,

            `🗑️ *MESSAGE DELETED*\n\n` +
            `📱 Chat: ${chat}\n\n` +
            `💬 Message:\n${
              originalText ||
              "[Media/No text]"
            }`
          );

          messageStore.delete(id);

        }

      } catch (error) {

        console.log(
          "❌ DELETE HANDLER ERROR:",
          error?.message || error
        );

      }

    }
  );

}

// =====================================================
// 🚀 LAUNCH
// =====================================================

startBot().catch(
  error => {

    console.error(
      "❌ FATAL BOT ERROR:",
      error?.stack ||
      error
    );

  }
);
