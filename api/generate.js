
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "只支持 POST 请求" });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Vercel 未配置 GEMINI_API_KEY"
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

    const clean = (v, max = 200) =>
      String(v).trim().slice(0, max);

    const languageNames = {
      zh: "简体中文",
      vi: "越南语",
      zhvi: "中文和越南语双语",
      mix: "中文和越南语双语",
      en: "英语"
    };

    const language = languageNames[lang] || "简体中文";
    const safeTheme = clean(theme);

    if (!safeTheme) {
      return res.status(400).json({
        error: "请先输入歌曲主题"
      });
    }

    const instructions = `
你是一名专业的原创歌曲创作人。

歌曲主题：${safeTheme}
歌词语言：${language}
音乐风格：${clean(style, 80)}
演唱方式：${clean(voice, 50)}
歌曲长度：${clean(duration, 50)}

请创作原创歌曲，按以下格式输出：

【歌曲名称】
【歌曲简介】
【主歌 1】
【副歌】
【主歌 2】
【桥段】
【最后副歌】
【AI音乐生成提示词】

音乐提示词请使用英文，描述风格、乐器、
节奏、情绪、人声和编曲。

要求：
1. 使用指定语言创作。
2. 中越双语必须同时包含中文和越南语。
3. 纯音乐模式不写演唱歌词。
4. 根据歌曲长度调整篇幅。
5. 不复制现有歌曲歌词。
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
          "Api-Revision": "2026-05-20"
        },
        body: JSON.stringify({
          model: "gemini-3.8-flash",
          input: instructions
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);

      return res.status(response.status).json({
        error: data?.error?.message ||
          "Gemini API 请求失败，请检查模型和 API 配置"
      });
    }

    const lyrics = (data.steps || [])
      .filter(step => step.type === "model_output")
      .flatMap(step => step.content || [])
      .filter(item => item.type === "text")
      .map(item => item.text || "")
      .join("\n")
      .trim();

    if (!lyrics) {
      console.error("Unexpected Gemini response:", data);

      return res.status(502).json({
        error: "AI 没有返回文本，请检查 API 响应"
      });
    }

    const musicPrompt =
      `Create an original ${clean(duration, 50)} song about ` +
      `"${safeTheme}". Style: ${clean(style, 80)}. ` +
      `Vocal: ${clean(voice, 50)}. Language: ${language}. ` +
      "Professional production, memorable melody, emotional dynamics, " +
      "balanced mix and original musical ideas.";

    return res.status(200).json({
      success: true,
      lyrics,
      prompt: musicPrompt,
      provider: "Gemini",
      model: "gemini-3.8-flash"
    });

  } catch (error) {
    console.error("Generation error:", error);

    return res.status(500).json({
      error: "服务器请求失败，请检查 Vercel 部署日志"
    });
  }
}
