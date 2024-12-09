const socket = io("http://localhost:3000", {
  withCredentials: true,
});

let roomName;
let myPeerConnection;
let myDataChannel;

const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");
const controls = document.getElementById("controls");
const sendJsonBtn = document.getElementById("send-json-btn");
const jsonInput = document.getElementById("json-input");
const jsonOutput = document.getElementById("json-output");

// Initialize the WebRTC connection
async function initCall() {
  welcome.hidden = true;
  controls.hidden = false;
  makeConnection();
}

// Handle room joining
async function handleWelcomeSubmit(event) {
  event.preventDefault();
  const input = welcomeForm.querySelector("input");
  await initCall();
  socket.emit("join_room", input.value);
  roomName = input.value;
  input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// WebRTC setup
function makeConnection() {
  myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
          "stun:stun4.l.google.com:19302",
        ],
      },
    ],
  });

  myPeerConnection.addEventListener("icecandidate", handleIce);
}

// Handle ICE candidates
function handleIce(data) {
  socket.emit("ice", data.candidate, roomName);
}

// WebRTC signaling
socket.on("welcome", async () => {
  myDataChannel = myPeerConnection.createDataChannel("jsonChannel");
  myDataChannel.addEventListener("message", handleMessage);
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  socket.emit("offer", offer, roomName);
});

socket.on("offer", async (offer) => {
  myPeerConnection.addEventListener("datachannel", (event) => {
    myDataChannel = event.channel;
    myDataChannel.addEventListener("message", handleMessage);
  });
  myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName);
});

socket.on("answer", (answer) => {
  myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
  myPeerConnection.addIceCandidate(ice);
});

// Handle incoming messages
function handleMessage(event) {
  try {
    const receivedTime = Date.now(); // 데이터 수신 시간 기록
    const jsonData = JSON.parse(event.data);
    jsonOutput.textContent = JSON.stringify(jsonData, null, 2);

    // 전송 시간 계산
    if (jsonData.__timestamp) {
      const latency = receivedTime - jsonData.__timestamp;
      console.log(`JSON 전송 소요 시간: ${latency} ms`);
    }
  } catch (error) {
    console.error("Invalid JSON received:", event.data);
  }
}

// Send JSON data
sendJsonBtn.addEventListener("click", () => {
  const jsonData = jsonInput.value;
  try {
    const jsonObject = JSON.parse(jsonData); // Validate JSON
    jsonObject.__timestamp = Date.now(); // 전송 시작 시간 기록
    myDataChannel.send(JSON.stringify(jsonObject));
  } catch (error) {
    alert("Invalid JSON format");
  }
});
