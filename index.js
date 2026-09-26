import http from "http";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";

const PORT = process.env.PORT || 3000;

const PHONE_NUMBER = process.env.PHONE_NUMBER;
const OWNER_NUMBER = process.env.OWNER_NUMBER;

const BOT_NAME = "ᴍʀ. ᴀғғᴇᴄᴛɪᴏɴ࿐❤️";
const OWNER_NAME = "ᴍʀ. ᴀғғᴇᴄᴛɪᴏɴ࿐❤️";
const TIKTOK = "www.tiktok.com/@mraffection07";

const PREFIX = ".";

// ===============================
// SETTINGS
// ===============================

let antiLinkEnabled = false;
let antiDeleteEnabled = false;
let autoStatusEnabled = false;
let autoReplyEnabled = false;

const messageStore = new Map();

// ===============================
// RENDER SERVER
// ===============================

http.createServer((req, res) => {
  res.writeHead(200);
  res.end(`${BOT_NAME} is running!`);
}).listen(PORT);

// ===============================
// PHONE HELPERS
// ===============================

function cleanNumber(number = "") {
  return number.replace(/\D/g, "");
}

function getSenderNumber(jid = "") {
  return jid
    .split("@")[0]
    .split(":")[0]
    .replace(/\D/g, "");
}

function isOwner(message) {
  const sender =
    message.key.participant ||
    message.key.remoteJid ||
    "";

  return (
    getSenderNumber(sender) ===
    cleanNumber(OWNER_NUMBER)
  );
}

// ===============================
// LINK DETECTOR
// ===============================

function containsLink(text = "") {
  return /(https?:\/\/|www\.|chat\.whatsapp\.com\/|t\.me\/|discord\.gg\/)/i.test(
    text
  );
}

// ===============================
// START BOT
// ===============================

async function startBot() {
  if (!PHONE_NUMBER) {
    console.log("❌ PHONE_NUMBER pa configuré.");
    return;
  }

  if (!OWNER_NUMBER) {
    console.log("❌ OWNER_NUMBER pa configuré.");
    return;
  }

  const { state, saveCreds } =
    await useMultiFileAuthState("./auth_info");

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  let pairingRequested = false;

  // ===============================
  // CONNECTION
  // ===============================

  sock.ev.on("connection.update", async (update) => {
    const {
      connection,
      lastDisconnect,
      qr
    } = update;

    if (
      !state.creds.registered &&
      !pairingRequested &&
      (connection === "connecting" || qr)
    ) {
      pairingRequested = true;

      try {
        await new Promise(resolve =>
          setTimeout(resolve, 2000)
        );

        const code =
          await sock.requestPairingCode(
            PHONE_NUMBER
          );

        console.log("================================");
        console.log("📱 WHATSAPP PAIRING CODE:");
        console.log(code);
        console.log("================================");
      } catch (error) {
        console.error(
          "❌ Pairing error:",
          error
        );

        pairingRequested = false;
      }
    }

    if (connection === "open") {
      console.log("================================");
      console.log(`✅ ${BOT_NAME}`);
      console.log("✅ WHATSAPP BOT CONNECTED!");
      console.log("================================");
    }

    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      if (
        statusCode !==
        DisconnectReason.loggedOut
      ) {
        console.log("🔄 Reconnecting...");

        setTimeout(() => {
          startBot();
        }, 2000);
      } else {
        console.log(
          "❌ WhatsApp logged out."
        );
      }
    }
  });

  // ===============================
  // MESSAGES
  // ===============================

  sock.ev.on(
    "messages.upsert",
    async ({ messages }) => {
      const message = messages[0];

      if (!message?.message) {
        return;
      }

      if (message.key.fromMe) {
        return;
      }

      const remoteJid =
        message.key.remoteJid || "";

      const text =
        message.message.conversation ||
        message.message.extendedTextMessage?.text ||
        "";

      const cleanText = text.trim();

      // ============================
      // SAVE FOR ANTIDELETE
      // ============================

      if (
        antiDeleteEnabled &&
        message.key.id
      ) {
        messageStore.set(
          message.key.id,
          message
        );

        if (messageStore.size > 500) {
          const firstKey =
            messageStore.keys().next().value;

          messageStore.delete(firstKey);
        }
      }

      // ============================
      // COMMANDS ONLY WITH "."
      // ============================

      if (!cleanText.startsWith(PREFIX)) {
        return;
      }

      const commandText =
        cleanText.slice(PREFIX.length).trim();

      const parts =
        commandText.split(/\s+/);

      const command =
        parts[0]?.toLowerCase() || "";

      const action =
        parts[1]?.toLowerCase() || "";

      // ============================
      // .MENU
      // ============================

      if (command === "menu") {
        await sock.sendMessage(
          remoteJid,
          {
            text:
              `🤖 *${BOT_NAME}*\n\n` +
              `👑 Owner: ${OWNER_NAME}\n` +
              `🎵 TikTok: ${TIKTOK}\n\n` +
              "━━━━━━━━━━━━━━\n" +
              "📌 *COMMANDS*\n" +
              "━━━━━━━━━━━━━━\n\n" +
              "🔗 .antilink on/off\n" +
              "🗑️ .antidelete on/off\n" +
              "👀 .autostatus on/off\n" +
              "💬 .autoreply on/off\n\n" +
              "📊 .status\n" +
              "👑 .owner\n" +
              "🎵 .tiktok\n" +
              "🏓 .ping"
          }
        );

        return;
      }

      // ============================
      // .PING
      // ============================

      if (command === "ping") {
        await sock.sendMessage(
          remoteJid,
          {
            text:
              `🏓 Pong!\n\n` +
              `🤖 ${BOT_NAME}`
          }
        );

        return;
      }

      // ============================
      // .OWNER
      // ============================

      if (command === "owner") {
        await sock.sendMessage(
          remoteJid,
          {
            text:
              `👑 *BOT OWNER*\n\n` +
              `${OWNER_NAME}\n\n` +
              `🤖 Bot: ${BOT_NAME}`
          }
        );

        return;
      }

      // ============================
      // .TIKTOK
      // ============================

      if (command === "tiktok") {
        await sock.sendMessage(
          remoteJid,
          {
            text:
              `🎵 *TikTok*\n\n${TIKTOK}`
          }
        );

        return;
      }

      // ============================
      // .STATUS
      // ============================

      if (command === "status") {
        if (!isOwner(message)) {
          return;
        }

        await sock.sendMessage(
          remoteJid,
          {
            text:
              `📊 *${BOT_NAME} STATUS*\n\n` +
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
              }`
          }
        );

        return;
      }

      // ============================
      // .ANTILINK ON/OFF
      // ============================

      if (command === "antilink") {
        if (!isOwner(message)) {
          return;
        }

        if (action === "on") {
          antiLinkEnabled = true;

          await sock.sendMessage(
            remoteJid,
            {
              text:
                "✅ *Anti-Link*\n\n" +
                "Anti-Link aktive."
            }
          );

          return;
        }

        if (action === "off") {
          antiLinkEnabled = false;

          await sock.sendMessage(
            remoteJid,
            {
              text:
                "❌ *Anti-Link*\n\n" +
                "Anti-Link dezaktive."
            }
          );

          return;
        }
      }

      // ============================
      // .ANTIDELETE ON/OFF
      // ============================

      if (command === "antidelete") {
        if (!isOwner(message)) {
          return;
        }

        if (action === "on") {
          antiDeleteEnabled = true;

          await sock.sendMessage(
            remoteJid,
            {
              text:
                "✅ *Anti-Delete*\n\n" +
                "Anti-Delete aktive."
            }
          );

          return;
        }

        if (action === "off") {
          antiDeleteEnabled = false;

          await sock.sendMessage(
            remoteJid,
            {
              text:
                "❌ *Anti-Delete*\n\n" +
                "Anti-Delete dezaktive."
            }
          );

          return;
        }
      }

      // ============================
      // .AUTOSTATUS ON/OFF
      // ============================

      if (command === "autostatus") {
        if (!isOwner(message)) {
          return;
        }

        if (action === "on") {
          autoStatusEnabled = true;

          await sock.sendMessage(
            remoteJid,
            {
              text:
                "✅ *Auto-Status*\n\n" +
                "Auto-Status aktive."
            }
          );

          return;
        }

        if (action === "off") {
          autoStatusEnabled = false;

          await sock.sendMessage(
            remoteJid,
            {
              text:
                "❌ *Auto-Status*\n\n" +
                "Auto-Status dezaktive."
            }
          );

          return;
        }
      }

      // ============================
      // .AUTOREPLY ON/OFF
      // ============================

      if (command === "autoreply") {
        if (!isOwner(message)) {
          return;
        }

        if (action === "on") {
          autoReplyEnabled = true;

          await sock.sendMessage(
            remoteJid,
            {
              text:
                "✅ *Auto-Reply*\n\n" +
                "Auto-Reply aktive."
            }
          );

          return;
        }

        if (action === "off") {
          autoReplyEnabled = false;

          await sock.sendMessage(
            remoteJid,
            {
              text:
                "❌ *Auto-Reply*\n\n" +
                "Auto-Reply dezaktive."
            }
          );

          return;
        }
      }

      // ============================
      // ANTI-LINK ACTION
      // ============================

      if (
        antiLinkEnabled &&
        remoteJid.endsWith("@g.us") &&
        containsLink(text)
      ) {
        try {
          await sock.sendMessage(
            remoteJid,
            {
              delete: message.key
            }
          );

          await sock.sendMessage(
            remoteJid,
            {
              text:
                "🚫 *ANTI-LINK*\n\n" +
                "Lyen yo pa otorize nan group sa."
            }
          );
        } catch (error) {
          console.log(
            "❌ Anti-Link error:",
            error.message
          );
        }

        return;
      }

      // ============================
      // AUTO REPLY
      // ============================

      if (autoReplyEnabled) {
        const lowerText =
          cleanText.toLowerCase();

        if (
          lowerText === "hi" ||
          lowerText === "hello" ||
          lowerText === "bonjou"
        ) {
          await sock.sendMessage(
            remoteJid,
            {
              text:
                `👋 Bonjou!\n\n` +
                `🤖 ${BOT_NAME}\n` +
                "Mèsi paske ou kontakte nou."
            }
          );

          return;
        }

        if (
          lowerText === "help" ||
          lowerText === "ede"
        ) {
          await sock.sendMessage(
            remoteJid,
            {
              text:
                "🤖 Mwen la pou ede w.\n\n" +
                "Ekri *.menu* pou wè meni an."
            }
          );

          return;
        }
      }
    }
  );
}

startBot();
