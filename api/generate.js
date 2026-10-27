
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "只支持 POST 请求"
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "未配置 GEMINI_API_KEY，请检查 Vercel 环境变量"
    });
  }

  try {
    const {
      theme = "爱情",
      lang = "zh",
      style = "流行音乐",
      voice = "女声",
      duration = "3分钟"
    } = req.body || {};

    const languageNames = {
      zh: "简体中文",
      vi: "越南语",
      zhvi: "中文和越南语双语",
      en: "英语"
    };

    const prompt = `
你是一名专业的歌曲创作人。
请根据用户的要求创作原创歌曲。

歌曲主题：${theme}
歌词语言：${languageNames[lang] || lang}
音乐风格：${style}
演唱方式：${voice}
歌曲时长：${duration}

请使用以下格式输出：

【歌曲名称】
填写歌曲名称

【歌曲简介】
简短介绍歌曲情绪与故事

【主歌 1】
歌词

【副歌】
歌词

【主歌 2】
歌词

【桥段】
歌词

【最后副歌】
歌词

【AI音乐生成提示词】
用英文描述音乐风格、乐器、节奏、情绪、
人声特点和编曲，方便用于 AI 音乐生成平台。

要求：
1. 歌词自然、有情感、结构完整。
2. 根据指定语言创作，不要随意切换语言。
3. 不要仿写或复制现有歌曲歌词。
4. 输出清晰，方便复制使用。
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 3000
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Gemini 请求失败，请检查 API 配额和密钥设置"
      });
    }

    const lyrics =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("\n")
        .trim();

    if (!lyrics) {
      return res.status(502).json({
        error: "AI 没有返回歌词，请重试"
      });
    }

    return res.status(200).json({
      success: true,
      lyrics,
      prompt: `Create an original ${style} song with ${voice}, approximately ${duration}. Theme: ${theme}. Language: ${languageNames[lang] || lang}.`,
      provider: "Gemini"
    });
  } catch (error) {
    console.error("Song generation error:", error);

    return res.status(500).json({
      error: "服务器发生错误，请稍后重试"
    });
  }
}
