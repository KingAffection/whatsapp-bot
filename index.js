import http from "http";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";

// ==============================
// RENDER SERVER
// ==============================

const PORT = process.env.PORT || 3000;
const PHONE_NUMBER = process.env.PHONE_NUMBER;

http.createServer((req, res) => {
  res.writeHead(200);
  res.end("WhatsApp Bot is running!");
}).listen(PORT);

// ==============================
// BOT SETTINGS
// ==============================

let antiLinkEnabled = false;
let antiDeleteEnabled = false;
let autoStatusEnabled = false;
let autoReplyEnabled = false;

// Messages kept temporarily for Anti-Delete
const messageStore = new Map();

// ==============================
// OWNER CHECK
// ==============================

function getPhoneFromJid(jid = "") {
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

  const senderNumber = getPhoneFromJid(sender);
  const ownerNumber = getPhoneFromJid(PHONE_NUMBER);

  return senderNumber === ownerNumber;
}

// ==============================
// ANTI-LINK
// ==============================

function containsLink(text = "") {
  const linkPattern =
    /(https?:\/\/|www\.|chat\.whatsapp\.com\/|t\.me\/|discord\.gg\/)/i;

  return linkPattern.test(text);
}

// ==============================
// START BOT
// ==============================

async function startBot() {
  if (!PHONE_NUMBER) {
    console.log("❌ PHONE_NUMBER pa configuré.");
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

  // ==============================
  // CONNECTION
  // ==============================

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
          await sock.requestPairingCode(PHONE_NUMBER);

        console.log("================================");
        console.log("📱 WHATSAPP PAIRING CODE:");
        console.log(code);
        console.log("================================");
      } catch (error) {
        console.error("❌ Pairing error:", error);
        pairingRequested = false;
      }
    }

    if (connection === "open") {
      console.log("================================");
      console.log("✅ WHATSAPP BOT CONNECTED!");
      console.log("================================");
    }

    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      if (
        statusCode !== DisconnectReason.loggedOut
      ) {
        console.log("🔄 Reconnecting...");

        setTimeout(() => {
          startBot();
        }, 2000);
      } else {
        console.log("❌ WhatsApp logged out.");
      }
    }
  });

  // ==============================
  // MESSAGES
  // ==============================

  sock.ev.on(
    "messages.upsert",
    async ({ messages }) => {
      const message = messages[0];

      if (!message?.message) {
        return;
      }

      // Ignore our own messages
      if (message.key.fromMe) {
        return;
      }

      const remoteJid =
        message.key.remoteJid || "";

      // ============================
      // AUTO STATUS
      // ============================

      if (
        autoStatusEnabled &&
        remoteJid === "status@broadcast"
      ) {
        try {
          await sock.readMessages([
            message.key
          ]);

          console.log(
            "👀 Status viewed automatically."
          );
        } catch (error) {
          console.log(
            "❌ Status error:",
            error.message
          );
        }

        return;
      }

      // ============================
      // ANTI DELETE
      // ============================

      if (antiDeleteEnabled) {
        const messageId = message.key.id;

        if (messageId) {
          messageStore.set(
            messageId,
            message
          );

          // Keep memory under control
          if (messageStore.size > 500) {
            const firstKey =
              messageStore.keys().next().value;

            messageStore.delete(firstKey);
          }
        }
      }

      // ============================
      // HANDLE DELETED MESSAGE
      // ============================

      const protocolMessage =
        message.message.protocolMessage;

      if (
        antiDeleteEnabled &&
        protocolMessage
      ) {
        const deletedId =
          protocolMessage.key?.id;

        if (deletedId) {
          const original =
            messageStore.get(deletedId);

          const ownerJid =
            `${PHONE_NUMBER}@s.whatsapp.net`;

          if (original) {
            const originalMessage =
              original.message;

            const deletedText =
              originalMessage?.conversation ||
              originalMessage
                ?.extendedTextMessage?.text ||
              "";

            if (deletedText) {
              await sock.sendMessage(
                ownerJid,
                {
                  text:
                    "🗑️ *ANTI-DELETE*\n\n" +
                    `Mesaj efase:\n${deletedText}`
                }
              );
            } else {
              await sock.sendMessage(
                ownerJid,
                {
                  text:
                    "🗑️ *ANTI-DELETE*\n\n" +
                    "Yon medya te efase."
                }
              );
            }
          } else {
            await sock.sendMessage(
              ownerJid,
              {
                text:
                  "🗑️ *ANTI-DELETE*\n\n" +
                  "Yon mesaj te efase, " +
                  "men bot la pa t gen kopi li."
              }
            );
          }

          return;
        }
      }

      // ============================
      // GET TEXT
      // ============================

      const text =
        message.message.conversation ||
        message.message.extendedTextMessage?.text ||
        "";

      const command =
        text.trim().toLowerCase();

      // ============================
      // COMMAND: ANTILINK ON
      // ============================

      if (command === "antilink on") {
        if (!isOwner(message)) {
          return;
        }

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

      // ============================
      // COMMAND: ANTILINK OFF
      // ============================

      if (command === "antilink off") {
        if (!isOwner(message)) {
          return;
        }

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

      // ============================
      // COMMAND: ANTIDELETE ON
      // ============================

      if (command === "antidelete on") {
        if (!isOwner(message)) {
          return;
        }

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

      // ============================
      // COMMAND: ANTIDELETE OFF
      // ============================

      if (command === "antidelete off") {
        if (!isOwner(message)) {
          return;
        }

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

      // ============================
      // COMMAND: AUTOSTATUS ON
      // ============================

      if (command === "autostatus on") {
        if (!isOwner(message)) {
          return;
        }

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

      // ============================
      // COMMAND: AUTOSTATUS OFF
      // ============================

      if (command === "autostatus off") {
        if (!isOwner(message)) {
          return;
        }

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

      // ============================
      // COMMAND: AUTOREPLY ON
      // ============================

      if (command === "autoreply on") {
        if (!isOwner(message)) {
          return;
        }

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

      // ============================
      // COMMAND: AUTOREPLY OFF
      // ============================

      if (command === "autoreply off") {
        if (!isOwner(message)) {
          return;
        }

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
                "🚫 *Anti-Link*\n\n" +
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
          text.trim().toLowerCase();

        if (
          lowerText === "hi" ||
          lowerText === "hello" ||
          lowerText === "bonjou"
        ) {
          await sock.sendMessage(
            remoteJid,
            {
              text:
                "👋 Bonjou! 😊\n" +
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
                "Ekri /menu pou wè meni bot la."
            }
          );

          return;
        }
      }

      // ============================
      // MENU
      // ============================

      if (command === "/menu") {
        await sock.sendMessage(
          remoteJid,
          {
            text:
              "🤖 *WHATSAPP BOT MENU*\n\n" +
              "1️⃣ antilink on/off\n" +
              "2️⃣ antidelete on/off\n" +
              "3️⃣ autostatus on/off\n" +
              "4️⃣ autoreply on/off\n\n" +
              "📊 /status\n" +
              "🏓 /ping"
          }
        );

        return;
      }

      // ============================
      // STATUS
      // ============================

      if (command === "/status") {
        if (!isOwner(message)) {
          return;
        }

        await sock.sendMessage(
          remoteJid,
          {
            text:
              "📊 *BOT STATUS*\n\n" +
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
      // PING
      // ============================

      if (command === "/ping") {
        await sock.sendMessage(
          remoteJid,
          {
            text:
              "🏓 Pong! Bot la ap mache."
          }
        );

        return;
      }
    }
  );
}

startBot();
