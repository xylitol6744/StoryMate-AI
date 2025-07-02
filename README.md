# StoryMate AI

AI와 대화하며 꿈 이야기를 만들어가는 웹 기반 창작 서비스입니다.  
사용자는 AI와 주고받는 대화를 통해 자신만의 이야기를 이어가고,  
완성된 이야기는 저장하거나 PDF로 다운로드할 수 있습니다.

## 🚀 주요 기능

- Google 로그인 기반 사용자 인증  
- GPT-4 기반 이야기 생성 및 이어쓰기  
- 히스토리 페이지에서 대화 기록 및 완성된 이야기 열람  
- PDF 다운로드 기능  
- Firebase Firestore를 통한 실시간 데이터 저장

## 💻 사용 기술

| 분야         | 기술 스택                        |
|--------------|---------------------------------|
| 프론트엔드   | React, TypeScript, Vite, Tailwind CSS |
| 백엔드       | Firebase Auth, Firestore, OpenAI GPT API |
| 배포         | Vercel                          |
| 기타         | Framer Motion, Google OAuth, dotenv |

## 📂 환경 변수 (.env)

📂 환경 변수 (.env)

아래 정보는 `.env` 파일을 통해 설정됩니다.
`.env` 파일은 Git에 포함되지 않으며, 아래 예시를 참고하여 생성해야 합니다:

✅ /frontend/.env
-------------------------------------
OPENAI_API_KEY=your_openai_api_key
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

✅ /backend/.env
-------------------------------------
OPENAI_API_KEY=your_openai_api_key

✅ /backend/serviceAccountKey.json
-------------------------------------
{
  "type": "service_account",
  "project_id": "your_project_id",
  "private_key_id": "your_private_key_id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "your_client_email",
  "client_id": "your_client_id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "your_client_cert_url",
  "universe_domain": "googleapis.com"
}
