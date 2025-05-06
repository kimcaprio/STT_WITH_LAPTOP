# 실시간 음성 인식 및 번역 시스템

이 프로젝트는 시스템 오디오를 실시간으로 캡처하여 음성을 텍스트로 변환(STT)하고 번역하는 애플리케이션입니다. 기존의 Gradio 기반 인터페이스를 React로 재구현하였습니다.

## 주요 기능

- 시스템 오디오 실시간 캡처
- Whisper를 이용한 음성-텍스트 변환(STT)
- Ollama를 이용한 텍스트 번역
- 번역 기록 및 요약 생성
- 자동/수동 결과 갱신 기능

## 기술 스택

### 백엔드
- Python
- Flask
- Whisper (OpenAI)
- SoundDevice (오디오 캡처)
- Ollama (번역)

### 프론트엔드
- React
- Material-UI
- Axios

## 시작하기

### 필수 조건
- Python 3.8+
- Node.js 14+
- Ollama 설치 및 실행 (http://localhost:11434)

### 설치 및 실행

1. 백엔드 설정:
```bash
cd react-stt-app/backend
pip install -r requirements.txt
python app.py
```

2. 프론트엔드 설정:
```bash
cd react-stt-app/frontend
npm install
npm start
```

3. 브라우저에서 http://localhost:3000 접속

## 사용 방법

1. 설정 섹션에서 필요한 옵션을 선택:
   - Whisper 모델 크기 (tiny, base, small, medium, large)
   - 입력/출력 언어
   - 오디오 입력 장치
   - 청킹 크기 (초)
   - 번역 모델

2. "시작" 버튼을 클릭하여 실시간 음성 인식 및 번역 시작

3. 필요시 "일시정지" 또는 "종료" 버튼 클릭

4. 자동 갱신 토글로 실시간 업데이트 켜기/끄기 가능

## 주요 구성 요소

- `AudioProcessor` 클래스: 오디오 캡처, 처리, 번역 등을 담당
- React 컴포넌트: 사용자 인터페이스 구현
- Flask API: 백엔드와 프론트엔드 연결

## 성능 최적화

- 실시간 처리를 위한 스레드 기반 처리
- 주기적 폴링을 통한 UI 업데이트
- 효율적인 메모리 사용을 위한 설정

## 라이센스

MIT 