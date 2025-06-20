import express, { Request, Response } from "express";
import { wrapAsync, firestore } from "../index";
import OpenAI from "openai";

declare module "express-serve-static-core" {
  interface Request {
    uid?: string;
  }
}

// 이야기 요약 프롬프트 상수
const STORY_PROMPT = `
다음 대화를 하나의 이야기처럼 정리해줘.

- 이야기의 흐름이 자연스럽게 이어지도록 구성해줘.
- 친근하고 자연스러운(당신은x 너는o) 2인칭 말투를 사용해줘.
- 모든 문장을 절대 "다."로 끝내지 말아줘.
- 등장인물 간의 주요 대사는 실제 대화문("...") 형태로 반드시 넣어줘.
- 감정, 해석, 교훈적 문장은 생략하고 장면 위주로 정리해줘.
- 한글만 사용해줘.
`;

export default function storyRouter(openai: OpenAI) {
  const router = express.Router();

  router.post(
    "/",
    wrapAsync(async (req: Request, res: Response) => {
      const { messages } = req.body;

      // messages 입력 체크
      if (!messages || typeof messages !== "string") {
        return res.status(400).json({ error: "messages가 문자열이어야 합니다." });
      }

      // 실제 프롬프트 생성
      const prompt = `${STORY_PROMPT}\n${messages}`;

      // OpenAI 호출
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });

      const reply = response.choices[0].message?.content?.trim() || "요약 실패";

      // 로그 기록 (실패해도 무시)
      try {
        await firestore.collection("logs").add({
          uid: req.uid ?? null,
          endpoint: "/api/story",
          promptLength: prompt.length,
          tokensUsed: response.usage?.total_tokens || 0,
          timestamp: new Date(),
        });
      } catch (e) {}

      // 최종 응답
      res.status(200).json({ reply });
    })
  );

  return router;
}
