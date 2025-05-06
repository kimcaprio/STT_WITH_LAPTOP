import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Grid, 
  Box, 
  Typography, 
  Button, 
  Slider, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  TextField, 
  Paper, 
  Switch, 
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Tabs,
  Tab,
  Divider,
  IconButton,
  Card,
  CardContent,
  Stack
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  Refresh,
  Settings,
  Translate,
  History,
  Summarize,
  MusicNote
} from '@mui/icons-material';
import axios from 'axios';
import './App.css';

// API 기본 URL
const API_URL = 'http://localhost:5001/api';

// 탭 패널 컴포넌트
function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function App() {
  // 상태 변수들
  const [audioDevices, setAudioDevices] = useState([]);
  const [ollamaModels, setOllamaModels] = useState([]);
  const [modelSize, setModelSize] = useState('small');
  const [inputLanguage, setInputLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('ko');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [chunkDuration, setChunkDuration] = useState(3);
  const [selectedModel, setSelectedModel] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [status, setStatus] = useState('대기 중');
  const [audioLevel, setAudioLevel] = useState(0);
  const [translatedText, setTranslatedText] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [translations, setTranslations] = useState([]);
  const [summary, setSummary] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  // 탭 변경 핸들러
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // 초기 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 오디오 장치 목록 가져오기
        const devicesResponse = await axios.get(`${API_URL}/audio-devices`);
        setAudioDevices(devicesResponse.data.devices);
        
        if (devicesResponse.data.devices.length > 0) {
          setSelectedDevice(devicesResponse.data.devices[0].id);
        }
        
        // Ollama 모델 목록 가져오기
        const modelsResponse = await axios.get(`${API_URL}/models`);
        setOllamaModels(modelsResponse.data.models);
        
        if (modelsResponse.data.models.length > 0) {
          setSelectedModel(modelsResponse.data.models[0].id);
        }
      } catch (error) {
        console.error('초기 데이터 로드 중 오류:', error);
      }
    };
    
    fetchData();
  }, []);
  
  // 주기적으로 결과 업데이트 (자동 갱신이 활성화된 경우)
  useEffect(() => {
    let interval = null;
    
    if (isRunning && autoRefresh) {
      interval = setInterval(() => {
        fetchResults();
      }, 500);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning, autoRefresh]);
  
  // 최신 결과 가져오기
  const fetchResults = async () => {
    try {
      const response = await axios.get(`${API_URL}/results`);
      setOriginalText(response.data.originalText);
      setTranslatedText(response.data.translatedText);
      setAudioLevel(response.data.audioLevel);
      setTranslations(response.data.translations);
    } catch (error) {
      console.error('결과 가져오기 중 오류:', error);
    }
  };
  
  // 처리 시작
  const startProcessing = async () => {
    try {
      setIsLoading(true);
      const response = await axios.post(`${API_URL}/start`, {
        inputLanguage,
        targetLanguage,
        selectedModel,
        chunkDuration,
        modelSize,
        deviceIndex: selectedDevice || 0  // 기본값 0 설정
      });
      
      if (response.data.status === 'started') {
        setIsRunning(true);
        setIsPaused(false);
        setStatus('실행 중...');
        setTabValue(1); // 자동으로 결과 탭으로 전환
      } else if (response.data.status === 'error') {
        setStatus(`오류: ${response.data.message}`);
      }
      setIsLoading(false);
    } catch (error) {
      console.error('처리 시작 중 오류:', error);
      setStatus(`오류: ${error.response?.data?.message || error.message}`);
      setIsLoading(false);
    }
  };
  
  // 일시정지/재개
  const togglePause = async () => {
    try {
      const response = await axios.post(`${API_URL}/pause`);
      setIsPaused(response.data.status === 'paused');
      setStatus(response.data.status === 'paused' ? '일시정지됨' : '실행 중...');
    } catch (error) {
      console.error('일시정지/재개 중 오류:', error);
    }
  };
  
  // 처리 종료
  const stopProcessing = async () => {
    try {
      setIsLoading(true);
      const response = await axios.post(`${API_URL}/stop`);
      
      if (response.data.status === 'stopped') {
        setIsRunning(false);
        setIsPaused(false);
        setStatus('종료됨');
        setSummary(response.data.summary);
        setTabValue(3); // 요약 탭으로 자동 전환
      }
      setIsLoading(false);
    } catch (error) {
      console.error('처리 종료 중 오류:', error);
      setIsLoading(false);
    }
  };
  
  // 수동으로 결과 갱신
  const refreshResults = () => {
    fetchResults();
  };

  return (
    <Container maxWidth="xl" sx={{ height: '100vh', py: 2, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          🎙️ 실시간 음성 인식 & 번역
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 200 }}>
            <Typography variant="body1" sx={{ mr: 1 }}>상태:</Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                fontWeight: 'bold',
                color: isRunning ? (isPaused ? 'warning.main' : 'success.main') : 'text.primary'
              }}
            >
              {status}
            </Typography>
            {isLoading && <CircularProgress size={20} sx={{ ml: 1 }} />}
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<PlayArrow />}
              onClick={startProcessing}
              disabled={isRunning || isLoading}
            >
              시작
            </Button>
            <Button
              variant="contained"
              color="secondary"
              size="small"
              startIcon={<Pause />}
              onClick={togglePause}
              disabled={!isRunning || isLoading}
            >
              {isPaused ? '재개' : '일시정지'}
            </Button>
            <Button
              variant="contained"
              color="error"
              size="small"
              startIcon={<Stop />}
              onClick={stopProcessing}
              disabled={!isRunning || isLoading}
            >
              종료
            </Button>
          </Box>
        </Box>
      </Box>
      
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        <Paper sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange} 
              variant="fullWidth" 
              indicatorColor="primary"
              textColor="primary"
            >
              <Tab icon={<Settings />} label="설정" iconPosition="start" />
              <Tab icon={<Translate />} label="실시간 결과" iconPosition="start" />
              <Tab icon={<History />} label="번역 기록" iconPosition="start" />
              <Tab icon={<Summarize />} label="요약" iconPosition="start" />
            </Tabs>
          </Box>
          
          {/* 설정 탭 */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ height: 'calc(100vh - 180px)', overflow: 'auto', px: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6} lg={3}>
                  <FormControl fullWidth margin="dense" size="small">
                    <InputLabel>Whisper 모델 크기</InputLabel>
                    <Select
                      value={modelSize}
                      label="Whisper 모델 크기"
                      onChange={(e) => setModelSize(e.target.value)}
                      disabled={isRunning}
                      size="small"
                    >
                      <MenuItem value="tiny">tiny</MenuItem>
                      <MenuItem value="base">base</MenuItem>
                      <MenuItem value="small">small</MenuItem>
                      <MenuItem value="medium">medium</MenuItem>
                      <MenuItem value="large">large</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={6} lg={3}>
                  <FormControl fullWidth margin="dense" size="small">
                    <InputLabel>입력 언어</InputLabel>
                    <Select
                      value={inputLanguage}
                      label="입력 언어"
                      onChange={(e) => setInputLanguage(e.target.value)}
                      disabled={isRunning}
                      size="small"
                    >
                      <MenuItem value="en">영어</MenuItem>
                      <MenuItem value="ko">한국어</MenuItem>
                      <MenuItem value="ja">일본어</MenuItem>
                      <MenuItem value="zh">중국어</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={6} lg={3}>
                  <FormControl fullWidth margin="dense" size="small">
                    <InputLabel>변환 언어</InputLabel>
                    <Select
                      value={targetLanguage}
                      label="변환 언어"
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      disabled={isRunning}
                      size="small"
                    >
                      <MenuItem value="ko">한국어</MenuItem>
                      <MenuItem value="en">영어</MenuItem>
                      <MenuItem value="ja">일본어</MenuItem>
                      <MenuItem value="zh">중국어</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={6} lg={3}>
                  <FormControl fullWidth margin="dense" size="small">
                    <InputLabel>번역 모델</InputLabel>
                    <Select
                      value={selectedModel}
                      label="번역 모델"
                      onChange={(e) => setSelectedModel(e.target.value)}
                      disabled={isRunning}
                      size="small"
                    >
                      {ollamaModels.map((model) => (
                        <MenuItem key={model.id} value={model.id}>
                          {model.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth margin="dense" size="small">
                    <InputLabel>오디오 입력 장치</InputLabel>
                    <Select
                      value={selectedDevice}
                      label="오디오 입력 장치"
                      onChange={(e) => setSelectedDevice(e.target.value)}
                      disabled={isRunning}
                      size="small"
                    >
                      {audioDevices.map((device) => (
                        <MenuItem key={device.id} value={device.id}>
                          {device.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Box sx={{ px: 2, mt: 1 }}>
                    <Typography variant="body2" gutterBottom>청킹 크기 (초)</Typography>
                    <Slider
                      value={chunkDuration}
                      min={1}
                      max={10}
                      step={1}
                      marks
                      valueLabelDisplay="auto"
                      onChange={(e, value) => setChunkDuration(value)}
                      disabled={isRunning}
                      size="small"
                    />
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ mt: 1, mb: 1 }}>
                    <Typography variant="body2" gutterBottom>오디오 레벨</Typography>
                    <Slider
                      value={audioLevel}
                      min={0}
                      max={1}
                      step={0.01}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                      disabled={true}
                      size="small"
                      sx={{ 
                        '& .MuiSlider-track': { 
                          backgroundColor: audioLevel > 0.5 ? 'success.main' : audioLevel > 0.2 ? 'warning.main' : 'primary.main'
                        } 
                      }}
                    />
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>
          
          {/* 실시간 결과 탭 */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ height: 'calc(100vh - 180px)', overflow: 'auto', px: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>원문</Typography>
                      <TextField
                        value={originalText}
                        variant="outlined"
                        fullWidth
                        multiline
                        rows={5}
                        InputProps={{ readOnly: true }}
                        size="small"
                      />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" gutterBottom>번역 결과</Typography>
                      <TextField
                        value={translatedText}
                        variant="outlined"
                        fullWidth
                        multiline
                        rows={5}
                        InputProps={{ readOnly: true }}
                        size="small"
                      />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                    <Button
                      variant="outlined"
                      startIcon={<Refresh />}
                      onClick={refreshResults}
                      disabled={!isRunning}
                      size="small"
                    >
                      결과 갱신
                    </Button>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={autoRefresh}
                          onChange={(e) => setAutoRefresh(e.target.checked)}
                          disabled={!isRunning}
                          size="small"
                        />
                      }
                      label="자동 갱신"
                    />
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>
          
          {/* 번역 기록 탭 */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ height: 'calc(100vh - 180px)', overflow: 'auto', px: 2 }}>
              <TableContainer sx={{ maxHeight: 'calc(100vh - 200px)' }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell width="15%">시간</TableCell>
                      <TableCell width="42.5%">원문</TableCell>
                      <TableCell width="42.5%">번역</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {translations.length > 0 ? (
                      translations.map((translation, index) => (
                        <TableRow key={index}>
                          <TableCell>{translation.timestamp}</TableCell>
                          <TableCell>{translation.original}</TableCell>
                          <TableCell>{translation.translated}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} align="center">
                          번역 기록이 없습니다
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </TabPanel>
          
          {/* 요약 탭 */}
          <TabPanel value={tabValue} index={3}>
            <Box sx={{ height: 'calc(100vh - 180px)', overflow: 'auto', px: 2 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    번역 요약
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ minHeight: '350px' }}>
                    {summary ? (
                      <Box 
                        dangerouslySetInnerHTML={{ 
                          __html: summary.replace(/\n/g, '<br/>') 
                        }} 
                        sx={{ 
                          typography: 'body1',
                          '& table': { 
                            width: '100%', 
                            borderCollapse: 'collapse',
                            '& th, & td': { 
                              border: '1px solid rgba(224, 224, 224, 1)', 
                              padding: '8px' 
                            }
                          }
                        }}
                      />
                    ) : (
                      <Typography variant="body1" color="text.secondary" align="center" sx={{ mt: 8 }}>
                        번역 요약이 없습니다. '종료' 버튼을 클릭하면 자동으로 요약이 생성됩니다.
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </TabPanel>
        </Paper>
      </Box>
    </Container>
  );
}

export default App; 