
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
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
      style = "高级流行",
      voice = "女声",
      duration = "3分钟完整歌曲"
    } = req.body || {};

    const clean = (value, max = 200) =>
      String(value).trim().slice(0, max);

    const safeTheme = clean(theme);
    const safeStyle = clean(style, 80);
    const safeVoice = clean(voice, 50);
    const safeDuration = clean(duration, 50);

    if (!safeTheme) {
      return res.status(400).json({
        error: "请先输入歌曲主题"
      });
    }

    const languageNames = {
      zh: "简体中文",
      vi: "越南语",
      zhvi: "中文和越南语双语",
      mix: "中文和越南语双语",
      en: "英语"
    };

    const language = languageNames[lang] || "简体中文";

    const instructions = `
你是一名专业的原创歌曲创作人。
请根据以下要求创作一首完整、原创的歌曲。

歌曲主题：${safeTheme}
歌词语言：${language}
音乐风格：${safeStyle}
演唱方式：${safeVoice}
歌曲长度：${safeDuration}

请严格按照以下格式输出：

【歌曲名称】
创作一个合适的歌曲名称。

【歌曲简介】
介绍歌曲的故事、情绪和主题。

【主歌 1】
创作歌词。

【副歌】
创作容易记忆、具有感染力的歌词。

【主歌 2】
继续歌曲故事。

【桥段】
创作有情绪变化的桥段。

【最后副歌】
创作有力量的结尾。

【AI音乐生成提示词】
用英文写出可直接用于 AI 音乐平台的提示词，
包括音乐风格、乐器、节奏、情绪、人声和编曲。

创作规则：
1. 必须使用指定的歌词语言。
2. 中越双语模式必须同时使用中文和越南语。
3. 纯音乐模式不写演唱歌词，但要提供音乐提示词。
4. 根据歌曲长度调整歌词篇幅。
5. 保持原创，不复制现有歌曲歌词。
6. 不要省略上述标题。
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: instructions
                }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 4000
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);

      const message =
        data?.error?.message ||
        "Gemini 请求失败，请检查模型、API 密钥或配额。";

      return res.status(response.status).json({
        error: message
      });
    }

    const lyrics = (
      data?.candidates?.[0]?.content?.parts || []
    )
      .map(part => part.text || "")
      .join("\n")
      .trim();

    if (!lyrics) {
      console.error(
        "Gemini returned no text:",
        JSON.stringify(data)
      );

      return res.status(502).json({
        error: "AI 没有返回歌词，请重新尝试。"
      });
    }

    const musicPrompt =
      `Create an original ${safeDuration} song about "${safeTheme}". ` +
      `Style: ${safeStyle}. Vocal: ${safeVoice}. ` +
      `Language: ${language}. ` +
      `Professional studio production, memorable melody, ` +
      `emotional dynamics, balanced mix and polished mastering. ` +
      `Use original musical ideas and do not imitate a specific artist.`;

    return res.status(200).json({
      success: true,
      lyrics,
      prompt: musicPrompt,
      provider: "Gemini",
      model: "gemini-3.8-flash"
    });

  } catch (error) {
    console.error("Song generation error:", error);

    return res.status(500).json({
      error: "服务器发生错误，请稍后重试。"
    });
  }
}
