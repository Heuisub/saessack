document.addEventListener("DOMContentLoaded", function() {
  let mediaRecorder;
  let audioChunks = [];
  let audioBlob;

  // socket.io 초기화
  const socket = io();
  
  document.getElementById("mic-button").addEventListener("click", async () => {
      if (mediaRecorder && mediaRecorder.state === "recording") {
          stopRecording();
      } else {
          await startRecording();
      }
  });

  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorder = new MediaRecorder(stream);

          mediaRecorder.onstart = () => {
              audioChunks = [];
              document.getElementById("mic-button").classList.add("recording");
              console.log("녹음 시작");
          };

          mediaRecorder.ondataavailable = event => {
              audioChunks.push(event.data);
          };

          mediaRecorder.onstop = () => {
              audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
              const url = URL.createObjectURL(audioBlob);
              const a = document.createElement('a');
              a.style.display = 'none';
              a.href = url;
              a.download = 'recording.wav';
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.getElementById("mic-button").classList.remove("recording");
              console.log("녹음 종료 및 파일 저장 완료");

              // 음성 파일 업로드 및 STT 실행
              convertAndUploadAudio(audioBlob);
          };

          mediaRecorder.start();
      } catch (error) {
          console.error("마이크 접근 오류:", error);
          handleMicAccessError(error);
      }
  };

  const stopRecording = () => {
      mediaRecorder.stop();
  };

  const convertAndUploadAudio = async (audioBlob) => {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Convert to WAV
      const wavBuffer = audioBufferToWav(audioBuffer);
      const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });

      uploadAudio(wavBlob);
  };

  const uploadAudio = (audioBlob) => {
      const formData = new FormData();
      formData.append("audio", audioBlob);

      fetch("/recognize", {
          method: "POST",
          body: formData
      })
      .then(response => response.json())
      .then(data => {
          if (data.error) {
              console.error("Error:", data.error);
              alert(data.error);
          } else {
              document.getElementById("user-message").value = data.text;
          }
      })
      .catch(error => console.error("Error:", error));
  };

  const audioBufferToWav = (buffer) => {
      const numOfChan = buffer.numberOfChannels,
          length = buffer.length * numOfChan * 2 + 44,
          wavBuffer = new ArrayBuffer(length),
          view = new DataView(wavBuffer),
          channels = [],
          sampleRate = buffer.sampleRate,
          bitDepth = 16;

      let offset = 0;

      // Write WAV container
      setUint32(0x46464952); // "RIFF"
      setUint32(length - 8); // file length - 8
      setUint32(0x45564157); // "WAVE"

      // Write format chunk
      setUint32(0x20746d66); // "fmt " chunk
      setUint32(16); // length = 16
      setUint16(1); // PCM (uncompressed)
      setUint16(numOfChan);
      setUint32(sampleRate);
      setUint32(sampleRate * numOfChan * 2); // avg. bytes/sec
      setUint16(numOfChan * 2); // block-align
      setUint16(bitDepth); // 16-bit

      // Write data chunk
      setUint32(0x61746164); // "data" - chunk
      setUint32(length - offset - 4); // chunk length

      // Write interleaved data
      for (let i = 0; i < buffer.length; i++) {
          for (let channel = 0; channel < numOfChan; channel++) {
              let sample = buffer.getChannelData(channel)[i];
              if (sample < -1) sample = -1;
              else if (sample > 1) sample = 1;
              sample = sample * 32768;
              if (sample < 0) sample = sample | 0x8000;
              view.setInt16(offset, sample, true);
              offset += 2;
          }
      }

      function setUint16(data) {
          view.setUint16(offset, data, true);
          offset += 2;
      }

      function setUint32(data) {
          view.setUint32(offset, data, true);
          offset += 4;
      }

      return wavBuffer;
  };

  const handleMicAccessError = (error) => {
      console.error("마이크 접근 오류:", error);
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          alert("마이크가 연결되어 있지 않습니다. 마이크를 연결한 후 다시 시도하세요.");
      } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          alert("마이크 접근이 거부되었습니다. 브라우저 설정에서 마이크 접근 권한을 허용해 주세요.");
      } else {
          alert("마이크에 접근할 수 없습니다. 마이크가 연결되어 있는지 확인하고, 브라우저에서 마이크 접근 권한을 허용했는지 확인하세요.");
      }
  };

  // 나머지 클라이언트 코드
  document.getElementById("start-button").addEventListener("click", function () {
      document.getElementById("slide1").style.display = "none";
      document.getElementById("chat-container").style.display = "flex";
      document.getElementById("end-button-container").classList.remove("hidden");
      document.getElementById("title1").style.display = "none";
  });

  document.getElementById("info-button").addEventListener("click", function() {
      document.getElementById("slide1").style.display = "none";
      document.getElementById("info-container").style.display = "block";
      document.getElementById("title1").innerHTML = '<span class="emoji">♥</span> <div class="title-text">당신의 아픔에 공감하는<br> 포유와 함께 이야기를 나눠요</div>';
      document.getElementById("title1").style.display = "flex"; // title1을 다시 표시
  });

  document.getElementById("back-button-info").addEventListener("click", function() {
      document.getElementById("info-container").style.display = "none";
      document.getElementById("slide1").style.display = "flex";
      document.getElementById("title1").innerHTML = '<span class="emoji">♥</span> <div class="title-text">당신의 아픔에 공감하는<br> 포유와 함께 이야기를 나눠요</div>';
      document.getElementById("title1").style.display = "flex"; // title1을 다시 표시
  });

  document.getElementById("end-button-chat").addEventListener("click", function() {
      document.getElementById("chat-container").style.display = "none";
      document.getElementById("end-button-container").classList.add("hidden");
      document.getElementById("end-page").style.display = "flex"; // 상담 종료 페이지를 표시
  });

  document.getElementById("home-button").addEventListener("click", function() {
      window.location.href = "index.html"; // 홈 페이지로 리디렉션
  });

  document.getElementById("info-button-end").addEventListener("click", function() {
      document.getElementById("end-page").style.display = "none";
      document.getElementById("info-container").style.display = "block"; // 정보 페이지를 표시
      document.getElementById("title1").innerHTML = '<span class="emoji">♥</span> <div class="title-text">당신의 아픔에 공감하는<br> 포유와 함께 이야기를 나눠요</div>';
      document.getElementById("title1").style.display = "flex"; // 제목 다시 표시
  });

  document.getElementById("send-button").addEventListener("click", sendMessage);
  document.getElementById("user-message").addEventListener("keypress", function (event) {
      if (event.key === "Enter") {
          sendMessage();
      }
  });
  
  function sendMessage() {
      const userMessage = document.getElementById("user-message").value;
      if (userMessage.trim() !== "") {
          const userMessageDiv = document.createElement("div");
          userMessageDiv.classList.add("message", "user-message");
          userMessageDiv.textContent = userMessage;
  
          document.getElementById("chat-box").appendChild(userMessageDiv);
          document.getElementById("user-message").value = "";
          document.getElementById("chat-box").scrollTop = document.getElementById("chat-box").scrollHeight;
  
          // 서버로 메시지 전송
          socket.emit("chat message", userMessage);
      }
  }
  
  socket.on("bot message", function (msg) {
      const botMessageDiv = document.createElement("div");
      botMessageDiv.classList.add("message", "bot-message");
  
      console.log("Received bot message:", msg); // 디버그 메시지 출력
      botMessageDiv.textContent = msg; // 원본 메시지를 표시
  
      document.getElementById("chat-box").appendChild(botMessageDiv);
      document.getElementById("chat-box").scrollTop = document.getElementById("chat-box").scrollHeight;
  });

  // 동영상 추천 페이지로 이동 및 동영상 추천 기능
  document.getElementById("video-button").addEventListener("click", function() {
      const keyword = '불법촬영'; // 기본 키워드 설정

      fetch('/video-recommendation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword })
      })
      .then(response => response.json())
      .then(data => {
          if (data.error) {
              alert(data.error);
          } else {
              const videosSection = document.getElementById('videosSection');
              const videosContainer = document.getElementById('videosContainer');
              videosContainer.innerHTML = ''; // 이전 동영상 목록 초기화
              data.forEach(video => {
                  const videoElement = document.createElement('div');
                  videoElement.className = 'video-card';
                  videoElement.innerHTML = `
                      <h3>${video.title}</h3>
                      <img src="http://img.youtube.com/vi/${extractVideoId(video.url)}/0.jpg" alt="Thumbnail">
                      <p>${video.summary}</p>
                      <a href="${video.url}" target="_blank">비디오 보기</a>
                  `;
                  videosContainer.appendChild(videoElement);
              });
              document.getElementById("slide1").style.display = "none";
              videosSection.classList.remove('hidden'); // 섹션을 보이게 설정
          }
      })
      .catch(error => console.error('Error:', error));
  });

  document.getElementById("back-button-videos").addEventListener("click", function() {
      document.getElementById("videosSection").classList.add("hidden");
      document.getElementById("slide1").style.display = "flex";
  });

  // 페이지 로드 시 동영상을 로드합니다.
  loadVideos();
});

function loadVideos() {
    fetch('/video-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: '불법촬영' }) // 기본 키워드를 사용하여 요청
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        displayVideos(data);
    })
    // .catch(error => {
    //     console.error('Fetch error:', error);
    //     alert('동영상을 불러오는데 실패했습니다.');
    // });
}

function displayVideos(videos) {
    const container = document.getElementById('videos-container');
    container.innerHTML = '';
    videos.forEach(video => {
        const videoId = extractVideoId(video.url);
        const thumbnailUrl = `http://img.youtube.com/vi/${videoId}/0.jpg`;
        const videoElement = document.createElement('div');
        videoElement.className = 'video-card';
        videoElement.innerHTML = `
            <h3>${video.title}</h3>
            <img src="${thumbnailUrl}" alt="Thumbnail">
            <p>${video.summary}</p>
            <a href="${video.url}" target="_blank">비디오 보기</a>
        `;
        container.appendChild(videoElement);
    });
}

function extractVideoId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length == 11) ? match[7] : null;
}

function fetchVideos(keyword) {
    fetch('/video-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword })
    })
    .then(response => response.json())
    .then(data => {
        displayVideos(data);
    })
    .catch(error => console.error('Error:', error));
}

function requestVideos(keyword) {
    let seenVideos = localStorage.getItem('seenVideos');
    seenVideos = seenVideos ? JSON.parse(seenVideos) : [];

    fetch('/video-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, seenVideos })
    })
    .then(response => response.json())
    .then(data => {
        displayVideos(data.filter(video => !seenVideos.includes(video.id)));
        updateSeenVideos(data.map(video => video.id));
    })
    .catch(error => console.error('Error:', error));
}

function updateSeenVideos(newVideos) {
    let seenVideos = localStorage.getItem('seenVideos');
    seenVideos = seenVideos ? JSON.parse(seenVideos) : [];
    seenVideos = [...new Set([...seenVideos, ...newVideos])]; // 중복 제거
    localStorage.setItem('seenVideos', JSON.stringify(seenVideos));
}

function refreshRecommendations() {
    const lastKeyword = localStorage.getItem('lastKeyword');
    if (lastKeyword) {
        document.getElementById('keyword').value = lastKeyword; // 입력 필드에 이전 검색어 설정
        requestVideos(lastKeyword); // 저장된 검색어로 동영상 다시 요청
    } else {
        alert('검색 이력이 없습니다.');
    }

     
  const videoCards = document.querySelectorAll('.video-card');

  videoCards.forEach(card => {
      const videoId = card.dataset.videoId;
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/0.jpg`;
      const title = card.querySelector('h3').innerText;

      card.innerHTML = `<img src="${thumbnailUrl}" alt="${title}">
                        <h3>${title}</h3>
                        <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank">Watch Video</a>`;
  });


}