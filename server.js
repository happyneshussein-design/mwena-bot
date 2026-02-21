const express = require("express")
const fs = require("fs")
const axios = require("axios")
const ytdl = require("ytdl-core")
const { default: makeWASocket, useMultiFileAuthState, downloadContentFromMessage } = require("@whiskeysockets/baileys")

const app = express()
app.use(express.json())

let sock

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("session")

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message) return

        const from = msg.key.remoteJid
        const isGroup = from.endsWith("@g.us")
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ""

        // AUTO VIEW STATUS
        if (from === "status@broadcast") {
            await sock.readMessages([msg.key])
        }

        // MENU
        if (text === "!menu") {
            let menu = `
╔═══ MWENA BOT ═══╗
!ai
!sticker
!yt
!audio
!tagall
!antilink on/off
!antidelete on/off
╚══════════════════╝
`
            await sock.sendMessage(from, { text: menu })
        }

        // AI CHAT (Free API)
        if (text.startsWith("!ai ")) {
            let q = text.replace("!ai ", "")
            let res = await axios.get(`https://api.simsimi.net/v2/?text=${q}&lc=en`)
            await sock.sendMessage(from, { text: res.data.success })
        }

        // STICKER AUTO
        if (msg.message.imageMessage) {
            const stream = await downloadContentFromMessage(msg.message.imageMessage, "image")
            let buffer = Buffer.from([])
            for await(const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk])
            }
            await sock.sendMessage(from, { sticker: buffer })
        }

        // YOUTUBE AUDIO
        if (text.startsWith("!audio ")) {
            let url = text.replace("!audio ", "")
            const stream = ytdl(url, { filter: "audioonly" })
            await sock.sendMessage(from, { audio: stream, mimetype: "audio/mp4" })
        }

        // GROUP TOOLS
        if (text === "!tagall" && isGroup) {
            let metadata = await sock.groupMetadata(from)
            let members = metadata.participants.map(p => p.id)
            let txt = members.map(v => "@" + v.split("@")[0]).join(" ")
            await sock.sendMessage(from, { text: txt, mentions: members })
        }

        // ANTI LINK
        if (isGroup && text.includes("chat.whatsapp.com")) {
            await sock.sendMessage(from, { text: "Link detected!" })
        }
    })
}

startBot()

// PAIRING API
app.post("/pair", async (req, res) => {
    let number = req.body.number

    if (!number.startsWith("255")) {
        return res.json({ error: "Use country code 255 without 0" })
    }

    try {
        const code = await sock.requestPairingCode(number)
        res.json({ code })
    } catch (e) {
        res.json({ error: e.message })
    }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log("MWENA BOT Running on port " + PORT))