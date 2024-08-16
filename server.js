const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const upload = multer({ dest: 'uploads/' });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CLOVA_SPEECH_INVOKE_URL = process.env.CLOVA_SPEECH_INVOKE_URL;
const CLOVA_SPEECH_SECRET_KEY = process.env.CLOVA_SPEECH_SECRET_KEY;

app.post('/recognize', upload.single('audio'), async (req, res) => {
  if (!CLOVA_SPEECH_INVOKE_URL || !CLOVA_SPEECH_SECRET_KEY) {
    return res.status(500).json({ error: 'Clova Speech API 키가 설정되지 않았습니다.' });
  }

  const audioPath = req.file.path;
  console.log(`Audio file path: ${audioPath}`);

  const formData = new FormData();
  formData.append('media', fs.createReadStream(audioPath));
  formData.append('params', JSON.stringify({
    language: 'ko-KR',
    completion: 'sync',
  }));

  try {
    console.log('Sending request to Clova Speech API...');
    const response = await axios.post(`${CLOVA_SPEECH_INVOKE_URL}/recognizer/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        'X-CLOVASPEECH-API-KEY': CLOVA_SPEECH_SECRET_KEY,
      }
    });
    console.log('Clova Speech API response:', response.data);
    res.json({ text: response.data.text });
  } catch (error) {
    console.error('Clova Speech API 오류:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: '음성을 인식하는 도중 오류가 발생했습니다.' });
  } finally {
    fs.unlinkSync(audioPath); // 파일 삭제
  }
});

const askOpenAI = async (query) => {
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "ft:gpt-3.5-turbo-1106:personal:foryou10:9rJvJieS",
      messages: [
        { role: "system", content: "너는 불법촬영 피해자를 위로와 법률 상담을 해주는 챗봇이야." },
        { role: "user", content: query }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    return "요청을 처리할 수 없습니다.";
  }
};

// YouTube 동영상 요약 엔드포인트 추가
app.post('/video-recommendation', async (req, res) => {
  const { keyword } = req.body;
  if (!YOUTUBE_API_KEY) {
    return res.status(500).json({ error: 'YouTube API 키가 설정되지 않았습니다.' });
  }

  const youtubeUrl = 'https://www.googleapis.com/youtube/v3/search';

  try {
    const response = await axios.get(youtubeUrl, {
      params: {
        part: 'snippet',
        q: keyword,
        key: YOUTUBE_API_KEY,
        type: 'video',
        maxResults: 10
      }
    });

    const videoItems = response.data.items.slice(0, 3);
    const videoDetails = await Promise.all(videoItems.map(async item => {
      const videoId = item.id.videoId;
      const title = item.snippet.title;
      const description = item.snippet.description;
      const url = `https://www.youtube.com/watch?v=${videoId}`;

      // ChatGPT API를 사용하여 설명 요약하기
      const summary = await getChatGptSummary(description);

      return {
        title,
        url,
        summary
      };
    }));

    res.json(videoDetails);
  } catch (error) {
    console.error('YouTube API 오류:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: '동영상 검색 중 오류가 발생했습니다.' });
  }
});

async function getChatGptSummary(text) {
  try {
    const response = await axios.post('https://api.openai.com/v1/completions', {
      model: "gpt-4o",
      prompt: `영상의 내용을 3줄로 요약해줘:\n\n${text}\n\nSummary:`,
      max_tokens: 100,
      temperature: 0.5
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const summary = response.data.choices[0].text.trim();
    return summary;
  } catch (error) {
    console.error('OpenAI API error:', error);
    return 'Summary is not available.';
  }
}

// 소켓 연결 및 이벤트 리스너 설정
io.on('connection', (socket) => {
  console.log('사용자가 연결되었습니다.');

  socket.on('chat message', async (msg) => {
    console.log('메시지: ' + msg);

    const response = await askOpenAI(msg);
    socket.emit('bot message', response);
  });

  socket.on('disconnect', () => {
    console.log('사용자가 연결을 끊었습니다.');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버가 *:${PORT} 포트에서 실행 중입니다.`);
});
