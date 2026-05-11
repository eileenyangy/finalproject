require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.json());
app.use(express.static('.'));

const key = process.env.ANTHROPIC_API_KEY || '';
console.log('Key loaded:', key ? key.slice(0, 10) + '...' + key.slice(-4) : 'MISSING');
const anthropic = new Anthropic({ apiKey: key });

app.post('/api/recommendations', async (req, res) => {
  const { goal, days } = req.body;
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Someone wants to "${goal}" in the next ${days} days. Give exactly 3 specific daily actions (each under 8 words) to help them reach this goal. Respond with ONLY a JSON array of 3 strings, nothing else. Example: ["action one here", "action two here", "action three here"]`
      }]
    });
    const text = message.content[0].text;
    const raw = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1);
    const recommendations = JSON.parse(raw);
    res.json({ recommendations });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Running at http://localhost:${PORT}`));
