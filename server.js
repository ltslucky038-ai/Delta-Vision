// server.js (CommonJS)
// Usage: npm install express node-fetch dotenv
// create .env with OPENAI_API_KEY
const express = require('express');
const fetch = require('node-fetch'); // v2 works with require
require('dotenv').config();
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(express.static(path.join(__dirname))); // serve index.html + assets

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if(!OPENAI_KEY) {
  console.warn('WARNING: OPENAI_API_KEY not set in .env');
}

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if(!Array.isArray(messages)) return res.status(400).send('messages must be an array');

    // convert to OpenAI chat format
    const chatMessages = [
      { role: 'system', content: 'You are Vision, a helpful assistant. Reply concisely in Hindi or English depending on user.' },
      ...messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
    ];

    const body = {
      model: 'gpt-4o-mini', // change model if needed
      messages: chatMessages,
      max_tokens: 800,
      temperature: 0.6
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify(body)
    });

    if(!r.ok) {
      const txt = await r.text();
      console.error('OpenAI error', r.status, txt);
      return res.status(500).send('OpenAI API error: ' + txt);
    }

    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content || (data.choices?.[0]?.text || 'No reply');
    res.json({ reply: reply.trim() });
  } catch(err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});


app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));