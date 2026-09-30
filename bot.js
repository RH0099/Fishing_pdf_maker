const TelegramBot = require('node-telegram-bot-api');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    console.error("Error: TELEGRAM_BOT_TOKEN environment variable is not set.");
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const userSessions = {};

console.log("Canva-Style Dynamic Birthday PDF Bot started...");

// Function to send help menu
const sendHelpMenu = (chatId) => {
    const helpMessage = `
🎨 **Canva-Style Birthday PDF Bot — ব্যবহার নির্দেশিকা**

এই বটের সাহায্যে আপনি যেকোনো ব্যক্তির জন্য আকর্ষণীয় ক্যানভা-স্টাইলের কাস্টমাইজড জন্মদিনের PDF উপহার কার্ড তৈরি করতে পারবেন।

━━━━━━━━━━━━━━━━━━━━━━
🛠 **কমান্ড সমূহের তালিকা:**

• \`/start\` — বট সক্রিয় করুন।
• \`/create\` — নতুন কাস্টম PDF ফাইল তৈরি শুরু করুন।
• \`/help\` — এই হেল্প ও ইন্সট্রাকশন মেনুটি দেখুন।
━━━━━━━━━━━━━━━━━━━━━━

✨ **আপনি যা যা পরিবর্তন/এডিট করতে পারবেন:**

১. **নাম/টাইটেল:** যাকে শুভেচ্ছা পাঠাবেন তার নাম।
২. **বয়স/সাবটাইটেল:** যেমন "২৫ তম জন্মদিন" (না চাইলে \`skip\` লিখুন)।
৩. **শুভেচ্ছা বার্তা:** আপনার মনের মতো শুভেচ্ছা বার্তা বা শুভেচ্ছা কবিতা।
৪. **কাস্টম ছবি (Photo URL):** যেকোনো ইমেজের ডাইরেক্ট লিঙ্ক দিলে তা গোলাকার ব্যাজ আকারে কার্ডে যুক্ত হবে (না চাইলে \`skip\` লিখুন)।
৫. **ওয়েবসাইট লিঙ্ক:** PDF-এর বাটনটিতে ক্লিক করলে সরাসরি আপনার ওয়েবসাইটে নিয়ে যাবে।
৬. **বাটনের টেক্সট:** বাটনের ওপর কী লেখা থাকবে তাও এডিট করা যাবে।

💡 **পরামর্শ:** ফটো যোগ করতে ImgBB বা PostImages সাইটে ছবি আপলোড করে Direct Link পেস্ট করুন।

🚀 **শুরু করতে কমান্ড দিন:** \`/create\`
`;

    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown', disable_web_page_preview: true });
};

// Listeners for commands
bot.onText(/\/start/, (msg) => {
    sendHelpMenu(msg.chat.id);
});

bot.onText(/\/help/i, (msg) => {
    sendHelpMenu(msg.chat.id);
});

bot.onText(/\/create/, (msg) => {
    const chatId = msg.chat.id;
    userSessions[chatId] = { step: 1 };
    bot.sendMessage(chatId, "১/৬. **টাইটেল/নাম** লিখুন (যেমন: শুভ জন্মদিন, রহিম!):");
});

// Step-by-Step Message Handler
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;

    if (text.toLowerCase() === 'help' || text.toLowerCase() === '/help') {
        delete userSessions[chatId];
        sendHelpMenu(chatId);
        return;
    }

    if (!userSessions[chatId] || text.startsWith('/')) return;

    const session = userSessions[chatId];

    if (session.step === 1) {
        session.title = text;
        session.step = 2;
        bot.sendMessage(chatId, "২/৬. **বয়স বা সাবটাইটেল** লিখুন (যেমন: ২৫ তম জন্মদিন, না চাইলে `skip` লিখুন):");
    } else if (session.step === 2) {
        session.age = (text.toLowerCase() === 'skip') ? '' : text;
        session.step = 3;
        bot.sendMessage(chatId, "৩/৬. **বিশেষ শুভেচ্ছা বার্তা** লিখুন:");
    } else if (session.step === 3) {
        session.message = text;
        session.step = 4;
        bot.sendMessage(chatId, "৪/৬. **ছবির Direct URL/লিঙ্ক** দিন (না চাইলে `skip` লিখুন):");
    } else if (session.step === 4) {
        session.photoUrl = (text.toLowerCase() === 'skip') ? '' : text;
        session.step = 5;
        bot.sendMessage(chatId, "৫/৬. **ওয়েবসাইটের লিঙ্ক** দিন (যেমন: https://rh0099.github.io/Website-view4/):");
    } else if (session.step === 5) {
        session.websiteUrl = text;
        session.step = 6;
        bot.sendMessage(chatId, "৬/৬. **বাটনের লেখা** কি হবে? (যেমন: জন্মদিনের বিশেষ উপহার 🎁):");
    } else if (session.step === 6) {
        session.buttonText = text;

        const loadingMsg = await bot.sendMessage(chatId, "⏳ ক্যানভা টেমপ্লেট স্টাইলে আপনার PDF তৈরি করা হচ্ছে...");

        try {
            const htmlPath = path.join(__dirname, 'templates', 'canva_card.html');
            let htmlContent = fs.readFileSync(htmlPath, 'utf8');

            const photoHtml = session.photoUrl 
                ? `<img src="${session.photoUrl}" class="user-photo" alt="Photo" />` 
                : '';

            htmlContent = htmlContent
                .replace(/{{PHOTO_HTML}}/g, photoHtml)
                .replace(/{{TITLE_TEXT}}/g, session.title)
                .replace(/{{AGE_TEXT}}/g, session.age || 'শুভ দিন')
                .replace(/{{MESSAGE_TEXT}}/g, session.message)
                .replace(/{{WEBSITE_URL}}/g, session.websiteUrl)
                .replace(/{{BUTTON_TEXT}}/g, session.buttonText);

            const browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

            const pdfPath = path.join(__dirname, `canva_wish_${chatId}_${Date.now()}.pdf`);
            await page.pdf({
                path: pdfPath,
                format: 'A4',
                printBackground: true
            });

            await browser.close();

            await bot.sendDocument(chatId, pdfPath, {
                caption: `🎁 ক্যানভা-স্টাইলে তৈরি আপনার কাস্টম জন্মদিনের PDF শুভেচ্ছা কার্ড!`
            });

            fs.unlinkSync(pdfPath);
            bot.deleteMessage(chatId, loadingMsg.message_id);
            delete userSessions[chatId];

        } catch (error) {
            console.error("PDF generation failed:", error);
            bot.sendMessage(chatId, "❌ ফাইল তৈরি করতে সমস্যা হয়েছে। ছবি বা ওয়েবসাইটের লিঙ্ক সঠিকভাবে দিয়ে আবার চেষ্টা করুন।");
            delete userSessions[chatId];
        }
    }
});
