const socket = io("https://cloudclap.r-e.kr/", {
  withCredentials: true,
});

const messageDiv = document.getElementById("message");
const messageForm = messageDiv.querySelector("form");

/**
 * 메시지를 송신하는 부분임
 * message 는 마찬가지로 string, a Blob, an ArrayBuffer, a TypedArray or a DataView object. 형태로 전송 가능함
 */
function sendMessage(event) {
  event.preventDefault();
  const input = messageForm.querySelector("input");
  myDataChannel.send(input.value);
  input.value = "";
}

messageForm.addEventListener("submit", sendMessage);

let roomName;
let myPeerConnection;

/**
 * 현재는 1:1 실시간 반영만 우선 개발하고자 하나의 dataChannel을 운영함 만약 여러명 참여해야하는 경우 myDataChannels 로 다수의 Cahnnel을 관리해야함
 */
let myDataChannel;

const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall() {
  welcome.hidden = true;
  makeConnection();
}

async function handleWelcomeSubmit(event) {
  event.preventDefault();
  const input = welcomeForm.querySelector("input");
  await initCall();
  socket.emit("join_room", input.value);
  roomName = input.value;
  input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

socket.on("welcome", async () => {
  myDataChannel = myPeerConnection.createDataChannel("chat");
  myDataChannel.addEventListener("message", (event) => console.log(event.data));
  console.log("made data channel");
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  console.log("sent the offer");
  socket.emit("offer", offer, roomName);
});

/**
 * 중요!! myDataChannel 에 추가하는 myDataChannel.addEventListener 가 데이터를 주고 받는 과정에서 수신 과정에 해당함.
 * 해당 부분에서 전달 받을 수 있는 형태는 string, a Blob, an ArrayBuffer, a TypedArray or a DataView object. 임
 * 따라서 데이터를 받은 후 데이터를 정제해서 그림에 포함시키는 과정만 만들면 됨!
 * 참고 : https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/send
 **/
socket.on("offer", async (offer) => {
  myPeerConnection.addEventListener("datachannel", (event) => {
    myDataChannel = event.channel;
    myDataChannel.addEventListener("message", (event) =>
      // canvas draw
      console.log(event.data)
    );
  });
  console.log("received the offer");
  myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName);
  console.log("sent the answer");
});

socket.on("answer", (answer) => {
  console.log("received the answer");
  myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
  console.log("received candidate");
  myPeerConnection.addIceCandidate(ice);
});

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

function handleIce(data) {
  console.log("sent candidate");
  socket.emit("ice", data.candidate, roomName);
}
