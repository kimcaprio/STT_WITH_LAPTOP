from flask import Flask, request, jsonify
from flask_cors import CORS
import sounddevice as sd
import numpy as np
import whisper
import queue
import threading
import time
import requests
import torch
import pandas as pd
from datetime import datetime
import os
import json
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_community.chat_models import ChatOllama
from typing import Dict, TypedDict, Annotated, Sequence

# PyTorch 설정
torch.set_num_threads(1)
os.environ['PYTORCH_ENABLE_MPS_FALLBACK'] = '1'
os.environ['PYTORCH_MPS_HIGH_WATERMARK_RATIO'] = '0.0'
os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'max_split_size_mb:512'
os.environ['PYTORCH_NO_CUDA_MEMORY_CACHING'] = '1'
os.environ['PYTORCH_JIT'] = '0'
os.environ['PYTORCH_NO_CUDA'] = '1'

app = Flask(__name__)
CORS(app)

class AudioProcessor:
    def __init__(self):
        self.audio_queue = queue.Queue()
        self.current_audio_level = 0.0
        self.is_processing = False
        self.last_result = {"original": "", "translated": ""}
        self.translations = []
        self.is_running = False
        self.model = None
        self.stream = None
        self.process_thread = None
        self.input_language = "en"
        self.target_language = "ko"
        self.selected_model = "exaone3.5:latest"
        self.chunk_duration = 3
        self.on_translation_update = None

    def get_audio_devices(self):
        """사용 가능한 오디오 장치 목록 반환"""
        devices = sd.query_devices()
        return {f"{i}: {device['name']} ({device['max_input_channels']} in, {device['max_output_channels']} out)": i 
                for i, device in enumerate(devices)}

    def get_ollama_models(self):
        """Ollama에서 사용 가능한 모델 목록 반환"""
        try:
            response = requests.get("http://localhost:11434/api/tags")
            if response.status_code == 200:
                models = response.json().get('models', [])
                return {model['name']: model['name'] for model in models}
        except:
            return {"exaone3.5:latest": "exaone3.5:latest"}

    def set_translation_callback(self, callback):
        """번역 업데이트 콜백 함수 설정"""
        self.on_translation_update = callback

    def translate_text(self, text, model_name):
        """텍스트 번역"""
        try:
            lang_names = {
                "ko": "한국어",
                "en": "영어",
                "ja": "일본어",
                "zh": "중국어"
            }
            source_lang = lang_names.get(self.input_language, "영어")
            target_lang = lang_names.get(self.target_language, "한국어")
            
            response = requests.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": model_name,
                    "prompt": f"다음 {source_lang} 텍스트를 자연스러운 {target_lang}로 번역해주세요. 번역만 출력하세요:\n{text}",
                    "stream": False
                }
            )
            if response.status_code == 200:
                translation = response.json().get('response', '').strip()
                if translation and self.on_translation_update:
                    self.on_translation_update(text, translation)
                return translation
        except Exception as e:
            print(f"번역 중 오류 발생: {e}")
        return None

    def process_audio(self, audio_data, model, language):
        """오디오 데이터 처리"""
        try:
            result = model.transcribe(audio_data, language=language)
            if result['text'].strip():
                return result['text'].strip()
        except Exception as e:
            print(f"STT 처리 중 오류 발생: {e}")
        return None

    def audio_callback(self, indata, frames, time, status):
        """오디오 콜백"""
        if status:
            print(f"상태: {status}")
        
        audio_level = np.max(np.abs(indata))
        self.current_audio_level = audio_level
        
        if audio_level > 0.001:
            audio = np.mean(indata, axis=1)
            audio = audio / np.max(np.abs(audio))
            self.audio_queue.put(audio)

    def process_stream(self):
        """오디오 스트림 처리"""
        while self.is_running:
            if not self.audio_queue.empty():
                self.is_processing = True
                audio_data = self.audio_queue.get()
                text = self.process_audio(audio_data, self.model, self.input_language)
                if text:
                    translation = self.translate_text(text, self.selected_model)
                    if translation:
                        self.last_result = {
                            "original": text,
                            "translated": translation
                        }
                        self.translations.append({
                            'timestamp': datetime.now(),
                            'original': text,
                            'translated': translation
                        })
                        print("\n인식된 텍스트:", text)
                        print("번역 결과:", translation)
                self.is_processing = False
            time.sleep(0.05)

    def start_processing(self):
        """처리 시작"""
        if not self.is_running:
            self.is_running = True
            self.process_thread = threading.Thread(target=self.process_stream)
            self.process_thread.start()

    def stop_processing(self):
        """처리 중지"""
        if self.is_running:
            self.is_running = False
            if self.stream:
                self.stream.stop()
                self.stream.close()
                self.stream = None
            if self.process_thread:
                self.process_thread.join()

    def save_translations(self):
        """번역 결과 저장"""
        if self.translations:
            filename = f"translations_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            df = pd.DataFrame(self.translations)
            df.to_csv(filename, index=False)
            print(f"번역 결과가 {filename}에 저장되었습니다.")

# 전역 변수로 AudioProcessor 인스턴스 생성
processor = AudioProcessor()

@app.route('/api/audio-devices', methods=['GET'])
def get_audio_devices():
    devices = processor.get_audio_devices()
    return jsonify({
        'devices': [{'name': name, 'id': idx} for name, idx in devices.items()]
    })

@app.route('/api/models', methods=['GET'])
def get_models():
    models = processor.get_ollama_models()
    return jsonify({
        'models': [{'name': name, 'id': id} for name, id in models.items()]
    })

@app.route('/api/start', methods=['POST'])
def start_processing():
    data = request.json
    
    processor.input_language = data.get('inputLanguage', 'en')
    processor.target_language = data.get('targetLanguage', 'ko')
    processor.selected_model = data.get('selectedModel', 'exaone3.5:latest')
    processor.chunk_duration = int(data.get('chunkDuration', 3))
    
    # Whisper 모델 로드
    model_size = data.get('modelSize', 'small')
    processor.model = whisper.load_model(model_size, device="cpu")
    
    # 오디오 스트림 시작
    try:
        device_idx = int(data.get('deviceIndex', 0))
    except (ValueError, TypeError):
        device_idx = 0  # 기본값으로 0 사용
        
    try:
        processor.stream = sd.InputStream(
            device=device_idx,
            channels=2,
            samplerate=16000,
            blocksize=int(16000 * processor.chunk_duration),
            callback=processor.audio_callback
        )
        processor.stream.start()
        processor.start_processing()
        
        return jsonify({'status': 'started'})
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'오디오 스트림 시작 중 오류 발생: {str(e)}'
        }), 500

@app.route('/api/pause', methods=['POST'])
def pause_processing():
    processor.is_processing = not processor.is_processing
    return jsonify({'status': 'paused' if not processor.is_processing else 'resumed'})

@app.route('/api/stop', methods=['POST'])
def stop_processing():
    processor.stop_processing()
    processor.save_translations()
    
    # 번역 기록 요약
    summary = ""
    if processor.translations:
        all_text = " ".join([t['translated'] for t in processor.translations])
        try:
            # Prepare initial state for summary
            initial_state = {
                "messages": [],
                "context": all_text,
                "reasoning": "",
                "selected_template": ""
            }
            
            # Run the summary graph
            final_state = summary_app.invoke(initial_state)
            
            # Get the final summary
            summary = final_state["messages"][-1].content
        except Exception as e:
            summary = f"요약 중 오류 발생: {e}"
    else:
        summary = "번역된 내용이 없습니다."
    
    return jsonify({
        'status': 'stopped',
        'summary': summary
    })

@app.route('/api/results', methods=['GET'])
def get_results():
    return jsonify({
        'originalText': processor.last_result.get('original', ''),
        'translatedText': processor.last_result.get('translated', ''),
        'audioLevel': float(processor.current_audio_level),
        'translations': [{
            'timestamp': t['timestamp'].strftime('%H:%M:%S'),
            'original': t['original'],
            'translated': t['translated']
        } for t in processor.translations]
    })

# Define the state for our summary graph
class SummaryState(TypedDict):
    messages: Annotated[Sequence[HumanMessage | AIMessage], "The messages in the conversation"]
    context: Annotated[str, "The translation content to summarize"]
    reasoning: Annotated[str, "The reasoning from the deepseek model"]
    selected_template: Annotated[str, "The selected prompt template"]

# Initialize the Ollama models for summary
try:
    summary_reasoning_model = ChatOllama(
        model="deepseek-r1:7b",
        base_url="http://localhost:11434",
        temperature=0.7,
        timeout=300,
        streaming=True,
        stop=["</think>"]
    )
    summary_response_model = ChatOllama(
        model="exaone3.5:latest",
        base_url="http://localhost:11434",
        temperature=0.7,
        timeout=300,
        streaming=True
    )
except Exception as e:
    print(f"Error initializing summary models: {str(e)}")

# Define prompt templates
SUMMARY_TEMPLATES = {
    "architecture": """너는 **소프트웨어 아키텍처 전문가**야. 아래 트랜스크립트를 보고
1) 주요 개념을 4개의 소제목으로 나누고,
2) 각 소제목마다 **핵심 메시지**를 1문장으로 요약하고,
3) **용어 정의**(필요 시)와 **추가 참고 링크**(가능한 경우 간략 URL) 를 덧붙여줘.
출력은 Markdown 형식으로 작성해.""",

    "technical_briefing": """너는 **시니어 엔지니어 대상 기술 브리핑어**야. 아래 스크립트를 참고해
- 1단계: 주요 모듈/컴포넌트 식별 및 정의
- 2단계: 각 모듈의 동작 원리 2~3문장 설명
- 3단계: 실제 운영 시 고려할 **주의사항** 3개
- 4단계: 다음 스텝(추가 학습/테스트) 권장 사항
순서대로 정리해줘. 불필요한 내용은 생략하고, "확실치 않은 부분"은 **[확실치 않음]** 태그로 표시.""",

    "faq": """너는 **내부 기술 문서 작성자**야. 이 트랜스크립트를 바탕으로
- 자주 묻는 질문(FAQ) 형태로 5문항을 만들고,
- 각 질문 뒤에 **간결한 답변**(2~3문장) 작성,
- 추가 심화 학습 리소스(예: 공식 문서 URL) 제안
형식:  
Q1. …  
A1. …""",

    "comparison": """너는 **기술 리뷰어**야. 아래 동영상 스크립트에서 다룬 **A vs B** 기술(또는 프레임워크) 특징을
| 항목 | A 특징 | B 특징 | 비고 |
|------|--------|--------|------|
형태의 표로 5개 항목 비교 정리해줘.  
"비고" 칸에는 사용 시 유의점이나 성능 차이 짧게 기재."""
}

def template_selection_agent(state: SummaryState) -> SummaryState:
    """Agent that uses deepseek-r1:7b to select the most appropriate template."""
    try:
        context = state["context"]
        
        # Create prompt for template selection
        prompt = f"""You are a template selection expert. Given the following translation content, select the most appropriate template from the options below.

Translation content:
{context}

Available templates:
1. Architecture Expert Template: For technical architecture and system design discussions
2. Technical Briefing Template: For detailed technical explanations and operational considerations
3. FAQ Template: For creating question-answer format documentation
4. Comparison Template: For comparing different technologies or approaches

Think step by step about which template would be most suitable for this content.
You MUST start your response with '<think>\n' and end with '</think>'.
Your response should be in the format: 'template_name: reason'"""

        # Get reasoning from deepseek model
        response = summary_reasoning_model.invoke(prompt)
        reasoning = response.content
        
        # Extract template name from reasoning
        template_name = reasoning.split(":")[0].strip().lower()
        if "architecture" in template_name:
            selected_template = "architecture"
        elif "briefing" in template_name:
            selected_template = "technical_briefing"
        elif "faq" in template_name:
            selected_template = "faq"
        elif "comparison" in template_name:
            selected_template = "comparison"
        else:
            selected_template = "architecture"  # default template
        
        return {
            **state,
            "reasoning": reasoning,
            "selected_template": selected_template
        }
    except Exception as e:
        print(f"Error in template selection agent: {str(e)}")
        return state

def summary_generation_agent(state: SummaryState) -> SummaryState:
    """Agent that uses exaone3.5:latest to generate the final summary."""
    try:
        context = state["context"]
        selected_template = state["selected_template"]
        
        # Get the selected template
        template = SUMMARY_TEMPLATES[selected_template]
        
        # Create prompt for final summary
        prompt = f"""You are a technical documentation expert. Use the following template to summarize the translation content:

{template}

Translation content:
{context}

Provide a clear and well-structured summary following the template format."""

        # Get final summary from exaone model
        response = summary_response_model.invoke(prompt)
        summary = response.content
        
        # Add the summary to messages
        new_messages = list(state["messages"])
        new_messages.append(AIMessage(content=summary))
        
        return {
            **state,
            "messages": new_messages
        }
    except Exception as e:
        print(f"Error in summary generation agent: {str(e)}")
        return state

# Create the summary graph
summary_workflow = StateGraph(SummaryState)

# Add nodes
summary_workflow.add_node("template_selection", template_selection_agent)
summary_workflow.add_node("summary_generation", summary_generation_agent)

# Add edges
summary_workflow.add_edge("template_selection", "summary_generation")
summary_workflow.add_edge("summary_generation", END)

# Set entry point
summary_workflow.set_entry_point("template_selection")

# Compile the graph
summary_app = summary_workflow.compile()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True) 