// Це звичайний сервер (на відміну від Vercel), він постійно "слухає"
// та чекає, поки Telegram щось надішле на адресу /webhook

const http = require('http');

const BOT_TOKEN = process.env.BOT_TOKEN; // токен береться з налаштувань Render, не з коду
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function handleUpdate(update) {
  try {
    // 1) Користувач написав /start (в тому числі /start buy_50_gems_25_stars)
    if (update.message && update.message.text && update.message.text.startsWith('/start')) {
      const chatId = update.message.chat.id;
      const parts = update.message.text.split(' ');
      const payload = parts[1]; // напр. "buy_50_gems_25_stars"

      if (payload && payload.startsWith('buy_')) {
        const segments = payload.split('_'); // ['buy','50','gems','25','stars']
        const gemAmount = segments[1];
        const starsPrice = Number(segments[3]);

        await fetch(`${API}/sendInvoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            title: `${gemAmount} кристалів`,
            description: `Поповнення балансу на ${gemAmount} кристалів у TabCoin`,
            payload: payload,
            provider_token: '',
            currency: 'XTR',
            prices: [{ label: `${gemAmount} кристалів`, amount: starsPrice }]
          })
        });
      } else {
        await fetch(`${API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: 'Привіт! Відкрий гру через кнопку меню нижче ⬇️'
          })
        });
      }
    }

    // 2) Telegram питає дозволу "чи можна списати зірки?"
    if (update.pre_checkout_query) {
      await fetch(`${API}/answerPreCheckoutQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_checkout_query_id: update.pre_checkout_query.id,
          ok: true
        })
      });
    }

    // 3) Оплата успішно пройшла
    if (update.message && update.message.successful_payment) {
      const chatId = update.message.chat.id;
      const payload = update.message.successful_payment.invoice_payload;

      await fetch(`${API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `✅ Оплата пройшла успішно! (${payload})`
        })
      });
    }
  } catch (err) {
    console.error('Помилка обробки:', err);
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let update = {};
      try { update = JSON.parse(body); } catch (e) { /* ігноруємо биту подію */ }
      await handleUpdate(update);
      res.writeHead(200);
      res.end('OK');
    });
  } else {
    res.writeHead(200);
    res.end('Bot server is running');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server started on port ' + PORT));
