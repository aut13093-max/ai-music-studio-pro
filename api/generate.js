module.exports = async function handler(req, res) {
  // 設置 CORS 標頭，避免跨域問題
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { theme, lang, style, voice, duration } = req.body || {};

  if (!theme) {
    return res.status(400).json({ error: '缺少歌曲主题' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '未配置 GEMINI_API_KEY 环境变量' });
  }

  try {
    const promptText = `
你是一位专业的顶尖词曲创作人和音乐制作人。请根据以下需求创作一首高质量的歌曲：
- 创作语言: ${lang}
- 歌曲主题: ${theme}
- 音乐风格: ${style}
- 演唱方式: ${voice}
- 歌曲长度: ${duration}

请严格按 JSON 格式返回，包含两个字段：
1. "lyrics": 完整的歌曲歌词（包含 [Verse], [Chorus], [Bridge] 等结构标记）。
2. "prompt": 适配 Suno/Udio 等 AI 音乐生成平台的英文或双语音乐提示词（描述流派、乐器、节拍BPM、情绪和人声）。
    `.trim();

    // 直接使用 fetch 呼叫 Google Gemini 官方 REST API，無需任何第三方套件
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: promptText }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              lyrics: { type: "STRING", description: "完整的歌曲歌词" },
              prompt: { type: "STRING", description: "AI音乐生成提示词" }
            },
            required: ["lyrics", "prompt"]
          }
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Gemini API 呼叫失敗');
    }

    const candidate = data.candidates?.[0];
    const textResponse = candidate?.content?.parts?.[0]?.text;

    if (!textResponse) {
      throw new Error('AI 未能返回有效內容');
    }

    const resultJson = JSON.parse(textResponse);
    return res.status(200).json(resultJson);

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || '生成服务出错' });
  }
};
