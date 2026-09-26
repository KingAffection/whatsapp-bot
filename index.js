import http from "http";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from "@whiskeysockets/baileys";
import pino from "pino";

const PORT = process.env.PORT || 3000;
const PHONE_NUMBER = process.env.PHONE_NUMBER;

// Ti serveur pou Render
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("WhatsApp Bot is running!");
}).listen(PORT);

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

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (
      connection === "connecting" &&
      !state.creds.registered
    ) {
      try {
        const code = await sock.requestPairingCode(
          PHONE_NUMBER
        );

        console.log("================================");
        console.log("📱 WHATSAPP PAIRING CODE:");
        console.log(code);
        console.log("================================");
      } catch (error) {
        console.error("❌ Pairing error:", error);
      }
    }

    if (connection === "open") {
      console.log("✅ WhatsApp Bot Connected!");
    }

    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      if (statusCode !== DisconnectReason.loggedOut) {
        console.log("🔄 Reconnecting...");
        startBot();
      } else {
        console.log("❌ WhatsApp logged out.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const message = messages[0];

    if (!message?.message || message.key.fromMe) {
      return;
    }

    const text =
      message.message.conversation ||
      message.message.extendedTextMessage?.text ||
      "";

    if (text.toLowerCase() === "/ping") {
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text: "🏓 Pong! Bot la ap mache."
        }
      );
    }

    if (text.toLowerCase() === "/menu") {
      await sock.sendMessage(
        message.key.remoteJid,
        {
          text:
            "🤖 *WHATSAPP BOT*\n\n" +
            "📌 /ping - Test bot la\n" +
            "📌 /menu - Montre meni an"
        }
      );
    }
  });
}

startBot();
