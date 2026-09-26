import http from "http";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";

// =====================================================
// 🤖 MR AFFECTION WHATSAPP BOT
// =====================================================

// ---------------- CONFIG ----------------

const PORT = process.env.PORT || 3000;

const PHONE_NUMBER = process.env.PHONE_NUMBER;
const OWNER_NUMBER = process.env.OWNER_NUMBER;

const BOT_NAME = "ᴍʀ. ᴀғғᴇᴄᴛɪᴏɴ࿐❤️";
const OWNER_NAME = "ᴍʀ. ᴀғғᴇᴄᴛɪᴏɴ࿐❤️";

const TIKTOK = "www.tiktok.com/@mraffection07";

const PREFIX = ".";

// 🔒 PRIVATE MODE
// Se owner la ki ka itilize kòmand bot la.
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

const MAX_STORED_MESSAGES = 300;


// =====================================================
// 🌐 RENDER WEB SERVER
// =====================================================

const server = http.createServer((req, res) => {

  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end(
    `${BOT_NAME}\nWhatsApp Bot is online.\n`
  );
});

server.listen(PORT, () => {

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

  if (!OWNER_NUMBER) {
    return false;
  }

  const ownerNumber =
    cleanNumber(OWNER_NUMBER);

  const remoteJid =
    message?.key?.remoteJid || "";

  const participant =
    message?.key?.participant || "";

  const senderCandidates = [
    participant,
    remoteJid
  ];

  return senderCandidates.some(
    jid =>
      getNumberFromJid(jid) ===
      ownerNumber
  );

}


// =====================================================
// 🔒 PRIVATE CHAT CHECK
// =====================================================

function isPrivateChat(jid = "") {

  return (
    jid.endsWith("@s.whatsapp.net") ||
    jid.endsWith("@lid")
  );

}


// =====================================================
// 🔗 LINK DETECTOR
// =====================================================

function containsLink(text = "") {

  const pattern =
    /(https?:\/\/|www\.|chat\.whatsapp\.com\/|t\.me\/|discord\.gg\/)/i;

  return pattern.test(text);

}


// =====================================================
// 📤 SEND TEXT
// =====================================================

async function sendText(
  sock,
  jid,
  text
) {

  if (!jid) return;

  try {

    await sock.sendMessage(
      jid,
      {
        text: String(text)
      }
    );

  } catch (error) {

    console.log(
      "❌ Send message error:",
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

  if (!OWNER_NUMBER) return;

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

  if (!id) return;

  messageStore.set(
    id,
    message
  );

  while (
    messageStore.size >
    MAX_STORED_MESSAGES
  ) {

    const firstKey =
      messageStore
        .keys()
        .next()
        .value;

    if (!firstKey) break;

    messageStore.delete(
      firstKey
    );

  }

}


// =====================================================
// 🧹 REMOVE MESSAGE
// =====================================================

function removeMessage(id) {

  if (!id) return;

  messageStore.delete(id);

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
// 🗑️ DELETE EVENT DETECTOR
// =====================================================

function getDeletedMessageId(message) {

  const protocol =
    message?.message
      ?.protocolMessage;

  if (!protocol) {
    return null;
  }

  // WhatsApp revoke/delete event
  if (
    protocol.type === 0 ||
    protocol.type === "REVOKE"
  ) {

    return (
      protocol.key?.id ||
      null
    );

  }

  return null;

}


// =====================================================
// 🚀 START BOT
// =====================================================

async function startBot() {

  if (!PHONE_NUMBER) {

    console.log(
      "❌ PHONE_NUMBER pa configured nan Render."
    );

    return;
  }


  if (!OWNER_NUMBER) {

    console.log(
      "❌ OWNER_NUMBER pa configured nan Render."
    );

    return;
  }


  console.log("");
  console.log(
    "======================================"
  );

  console.log(
    `🤖 Starting ${BOT_NAME}`
  );

  console.log(
    "🔒 Private Owner Mode: ON"
  );

  console.log(
    "======================================"
  );


  // ===================================================
  // 🔐 AUTH STATE
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
  // 📲 PAIRING CODE
  // ===================================================

  let pairingRequested = false;


  sock.ev.on(
    "connection.update",
    async update => {

      const {
        connection,
        lastDisconnect,
        qr
      } = update;


      // -----------------------------------------------
      // PAIRING
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
            "======================================"
          );

          console.log(
            "📱 WHATSAPP PAIRING CODE"
          );

          console.log(code);

          console.log(
            "======================================"
          );


        } catch (error) {

          console.log(
            "❌ Pairing error:",
            error?.message || error
          );

          pairingRequested = false;

        }

      }


      // -----------------------------------------------
      // CONNECTED
      // -----------------------------------------------

      if (
        connection === "open"
      ) {

        console.log("");
        console.log(
          "======================================"
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
          "======================================"
        );

      }


      // -----------------------------------------------
      // DISCONNECTED
      // -----------------------------------------------

      if (
        connection === "close"
      ) {

        const statusCode =
          lastDisconnect
            ?.error
            ?.output
            ?.statusCode;


        if (
          statusCode !==
          DisconnectReason.loggedOut
        ) {

          console.log(
            "🔄 WhatsApp disconnected."
          );

          console.log(
            "🔄 Restarting bot..."
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
  // 📨 MESSAGE HANDLER
  // ===================================================

  sock.ev.on(
    "messages.upsert",
    async ({
      messages
    }) => {

      try {

        const message =
          messages?.[0];


        if (
          !message ||
          !message.message
        ) {

          return;

        }


        const remoteJid =
          message.key?.remoteJid ||
          "";


        const fromMe =
          message.key?.fromMe === true;


        const owner =
          isOwner(message);


        // =================================================
        // 🗑️ DELETE EVENT
        // =================================================

        const deletedId =
          getDeletedMessageId(
            message
          );


        if (
          deletedId &&
          antiDeleteEnabled
        ) {

          const original =
            messageStore.get(
              deletedId
            );


          if (original) {

            const originalText =
              original.message
                ?.conversation ||
              original.message
                ?.extendedTextMessage
                ?.text ||
              "";


            if (originalText) {

              await sendToOwner(
                sock,

                `🗑️ *MESSAGE DELETED*\n\n` +
                `📱 Chat: ${remoteJid}\n\n` +
                `💬 Message:\n${originalText}`
              );

            }


            removeMessage(
              deletedId
            );

          }


          return;

        }


        // =================================================
        // 💾 STORE MESSAGE
        // =================================================

        if (
          antiDeleteEnabled &&
          message.key?.id &&
          !deletedId
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

          await sendToOwner(
            sock,

            `👁️ *VIEW ONCE DETECTED*\n\n` +
            `Yon moun voye yon View Once.\n\n` +
            `Bot la detekte li, men li pap kontoune pwoteksyon View Once WhatsApp la.`
          );


          console.log(
            "👁️ View Once detected."
          );

        }


        // =================================================
        // 👀 AUTO STATUS
        // =================================================

        if (
          autoStatusEnabled &&
          remoteJid ===
            "status@broadcast"
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


          return;

        }


        // =================================================
        // 📝 EXTRACT TEXT
        // =================================================

        const text =
          message.message
            ?.conversation ||
          message.message
            ?.extendedTextMessage
            ?.text ||
          "";


        const cleanText =
          String(text)
            .trim();


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


          return;

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
              `Ekri *.menu* pou wè kòmand yo.`
            );


            return;

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


            return;

          }

        }


        // =================================================
        // 🚫 NOT A COMMAND
        // =================================================

        if (
          !cleanText.startsWith(
            PREFIX
          )
        ) {

          return;

        }


        // =================================================
        // 🔒 PRIVATE BOT MODE
        // =================================================

        if (
          PRIVATE_MODE &&
          !owner
        ) {

          // Pa voye okenn repons.
          // Bot la rete silansye.
          return;

        }


        // =================================================
        // 🔒 ADMIN COMMANDS ONLY
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
          parts[0]
            ?.toLowerCase() ||
          "";


        const action =
          parts[1]
            ?.toLowerCase() ||
          "";


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
            `┃  🤖 *${BOT_NAME}*\n` +
            `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +

            `👑 *OWNER*\n` +
            `${OWNER_NAME}\n\n` +

            `🎵 *TIKTOK*\n` +
            `${TIKTOK}\n\n` +

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
            `🔒 *PRIVATE OWNER MODE: ON*\n` +
            `━━━━━━━━━━━━━━━━━━━━`
          );


          return;

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
            `🟢 Bot is online.`
          );


          return;

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


          return;

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


          return;

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


          return;

        }


        // =================================================
        // 🔗 ANTI-LINK
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


            return;

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


            return;

          }


          await sendText(
            sock,
            remoteJid,

            `❓ Itilize:\n\n` +
            `*.antilink on*\n` +
            `*.antilink off*`
          );


          return;

        }


        // =================================================
        // 🗑️ ANTI DELETE
        // =================================================

        if (
          command === "antidelete"
        ) {

          if (
            action === "on"
          ) {

            antiDeleteEnabled =
              true;


            await sendText(
              sock,
              remoteJid,

              `✅ *ANTI-DELETE ON*\n\n` +
              `Bot la ap kòmanse sonje nouvo mesaj yo.`
            );


            return;

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


            return;

          }


          await sendText(
            sock,
            remoteJid,

            `❓ Itilize:\n\n` +
            `*.antidelete on*\n` +
            `*.antidelete off*`
          );


          return;

        }


        // =================================================
        // 👀 AUTO STATUS
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


            return;

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


            return;

          }


          await sendText(
            sock,
            remoteJid,

            `❓ Itilize:\n\n` +
            `*.autostatus on*\n` +
            `*.autostatus off*`
          );


          return;

        }


        // =================================================
        // 💬 AUTO REPLY
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


            return;

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


            return;

          }


          await sendText(
            sock,
            remoteJid,

            `❓ Itilize:\n\n` +
            `*.autoreply on*\n` +
            `*.autoreply off*`
          );


          return;

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


            return;

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


            return;

          }


          await sendText(
            sock,
            remoteJid,

            `❓ Itilize:\n\n` +
            `*.viewonce on*\n` +
            `*.viewonce off*`
          );


          return;

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


      } catch (error) {

        console.log(
          "❌ Message handler error:",
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
      "❌ Fatal bot error:",
      error
    );

  }
);
