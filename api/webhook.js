// Це "мозок" бота. Vercel сам запускає цю функцію щоразу,
// коли Telegram надсилає їй подію (повідомлення, оплату тощо).

export default async function handler(req, res) {
  // Telegram завжди стукає сюди методом POST
  if (req.method !== 'POST') {
    return res.status(200).send('Bot webhook is alive');
  }

  const BOT_TOKEN = process.env.BOT_TOKEN; // токен береться з налаштувань Vercel, не з коду
  const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
  const update = req.body;

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

        // Створюємо інвойс і одразу надсилаємо його в чат
        await fetch(`${API}/sendInvoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            title: `${gemAmount} кристалів`,
            description: `Поповнення балансу на ${gemAmount} кристалів у TabCoin`,
            payload: payload,          // повернеться нам назад після оплати
            provider_token: '',        // для оплати зірками завжди порожній рядок
            currency: 'XTR',           // XTR = Telegram Stars
            prices: [{ label: `${gemAmount} кристалів`, amount: starsPrice }]
          })
        });
      } else {
        // Звичайний /start без покупки — привітання
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

    // 2) Telegram питає дозволу "чи можна списати зірки?" — треба відповісти за 10 сек
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

    // 3) Оплата успішно пройшла — ось тут нараховується покупка
    if (update.message && update.message.successful_payment) {
      const chatId = update.message.chat.id;
      const payload = update.message.successful_payment.invoice_payload;

      // ⚠️ ВАЖЛИВО: тут поки що тільки повідомлення користувачу.
      // Щоб кристали реально з'явились у грі, далі треба підключити
      // базу даних (наприклад Supabase) — про це наступним кроком.
      await fetch(`${API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `✅ Оплата пройшла успішно! (${payload})`
        })
      });
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error(err);
    // Завжди відповідаємо 200, інакше Telegram буде довбити цей запит по колу
    res.status(200).send('OK');
  }
}
