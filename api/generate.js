import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { theme, lang, style, voice, duration } = req.body;

  if (!theme) {
    return res.status(400).json({ error: '缺少歌曲主题' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('未配置 GEMINI_API_KEY 环境变量');
    }

    const ai = new GoogleGenAI({ apiKey });

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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lyrics: { type: Type.STRING, description: "完整的歌曲歌词" },
            prompt: { type: Type.STRING, description: "AI音乐生成提示词" }
          },
          required: ["lyrics", "prompt"]
        }
      }
    });

    const resultJson = JSON.parse(response.text);
    return res.status(200).json(resultJson);

  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ error: error.message || '生成服务出错' });
  }
}
