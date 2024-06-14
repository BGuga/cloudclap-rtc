const socket = io("https://cloudclap.r-e.kr/", {
  withCredentials: true,
});
const destroyBtn = document.getElementById("destroy-btn");
const eraseBtn = document.getElementById("erase-btn");
const linewidth = document.getElementById("linewidth");
const restoreBtn = document.getElementById("restore_btn");
const lineColor = document.getElementById("lineColor");
const pdfFileInput = document.getElementById("pdf-file");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

pdfFileInput.addEventListener("change", async function (event) {
  const file = event.target.files[0];
  if (file) {
    await loadPdf(file);
    await wait(500);
    await sendPdf();
  }
});

function sendPdf() {
  console.log("called send pdf");
  const imageData = canvas1.toDataURL();
  myDataChannel.send(imageData);
}

async function loadPdf(file) {
  const reader = new FileReader();

  reader.onload = async function (e) {
    const typedArray = new Uint8Array(e.target.result);

    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js";

    pdfjsLib
      .getDocument(typedArray)
      .promise.then(async function (pdf) {
        console.log("PDF loaded");
        const pdfPageNumber = 1;

        await pdf.getPage(pdfPageNumber).then(async function (page) {
          console.log("Page loaded");

          const viewport = page.getViewport({ scale: 1 });

          const pdfCanvas = document.createElement("canvas");
          const pdfCtx = pdfCanvas.getContext("2d");

          pdfCanvas.width = viewport.width;
          pdfCanvas.height = viewport.height;

          page
            .render({ canvasContext: pdfCtx, viewport: viewport })
            .promise.then(async function () {
              console.log("Page rendered");

              await ctx1.drawImage(
                pdfCanvas,
                0,
                0,
                canvas1.width,
                canvas1.height
              );
            });
        });
      })
      .catch(function (error) {
        console.error("Error loading PDF: ", error);
      });
  };

  reader.readAsArrayBuffer(file);
}

class StrokeStorage {
  constructor() {
    this.strokes = [];
  }
  putStroke(stroke) {
    this.strokes.push(stroke);
  }
  restore(ctx2, ctx1, canvas2) {
    for (let i = 0; i < this.strokes.length; i++) {
      var strokeToRestore = new GetStroke(this.strokes[i]);
      strokeToRestore.reconstructStroke(ctx2, ctx1, canvas2);
    }
  }
}
class StrokeData {
  constructor(type = "none", color = "black", width = 5, coordinates = []) {
    this.coordinateArray = coordinates;
    this.type = type;
    this.color = color;
    this.width = width;
    this.count = coordinates.length;
  }
  coordinateInput(x, y, canvasWidth, canvasHeight) {
    this.coordinateArray.push([x / canvasWidth, y / canvasHeight]);
    this.count += 1;
  }
  exportStroke() {
    var data = {
      type: this.type,
      color: this.color,
      width: this.width,
      dataArray: this.coordinateArray,
    };
    return JSON.stringify(data);
  }
  getType() {
    return this.type;
  }
  getCoordinate(i, canvasWidth, canvasHeight) {
    const [normX, normY] = this.coordinateArray[i];
    return [normX * canvasWidth, normY * canvasHeight];
  }
  getColor() {
    return this.color;
  }
  getWidth() {
    return this.width;
  }
  getLength() {
    return this.count;
  }
}
class GetStroke {
  constructor(receivedStrokeData = "") {
    try {
      var parsedStrokeData = JSON.parse(receivedStrokeData);
      console.log(parsedStrokeData);
      this.strokeData = new StrokeData(
        parsedStrokeData.type,
        parsedStrokeData.color,
        parsedStrokeData.width,
        parsedStrokeData.dataArray
      );
    } catch (e) {
      this.strokeData = new StrokeData();
      console.log("parse failed");
    }
  }

  reconstructStroke(context1, context2, canvasToDraw) {
    console.log(this.strokeData.getType());
    if (this.strokeData.getType() == "draw") {
      context1.strokeStyle = this.strokeData.getColor();
      context1.lineWidth = this.strokeData.getWidth();
      context1.beginPath();
      if (this.strokeData.getLength() > 0) {
        for (let i = 0; i < this.strokeData.getLength(); i++) {
          const [x, y] = this.strokeData.getCoordinate(
            i,
            canvasToDraw.width,
            canvasToDraw.height
          );
          if (i === 0) {
            context1.moveTo(x, y);
          } else {
            context1.lineTo(x, y);
          }
          context1.stroke();
        }
      }

      context2.globalCompositeOperation = "destination-over";
      context2.drawImage(
        canvasToDraw,
        0,
        0,
        canvasToDraw.width,
        canvasToDraw.height
      );
      context2.globalCompositeOperation = "source-over";
      context1.clearRect(0, 0, canvasToDraw.width, canvasToDraw.height);
    }

    if (this.strokeData.getType() == "erase") {
      if (this.strokeData.getLength() > 0) {
        let startCoordinate = this.strokeData.getCoordinate(0);
        context2.clearRect(
          startCoordinate[0] - 5,
          startCoordinate[1] - 5,
          10,
          10
        );

        for (let i = 0; i < this.strokeData.getLength(); i++) {
          var coordinate = this.strokeData.getCoordinate(i);
          context2.clearRect(coordinate[0] - 5, coordinate[1] - 5, 10, 10);
        }
      }
    }
  }

  storeStroke(dataStorage) {
    dataStorage.push(this.strokeData.exportStroke());
  }
}
let strokeStorage = new StrokeStorage();
let isErasing = false;
var data;
var inputData;

let roomName;
let myPeerConnection;

const canvas1 = document.getElementById("canvas1");
const canvas2 = document.getElementById("canvas2");

const ctx1 = canvas1.getContext("2d");
const ctx2 = canvas2.getContext("2d");

let isPainting = false;

ctx1.lineWidth = 5;
ctx1.lineCap = "round";
ctx1.strokeStyle = "black";
ctx2.lineWidth = 5;
ctx2.lineCap = "round";
ctx2.strokeStyle = "black";

canvas1.width = window.innerWidth;
canvas1.height = window.innerHeight;
canvas2.width = window.innerWidth;
canvas2.height = window.innerHeight;

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

function loadPdfFromData(typedArray) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js";

  pdfjsLib
    .getDocument(typedArray)
    .promise.then(function (pdf) {
      console.log("PDF loaded");
      const pdfPageNumber = 1;

      pdf.getPage(pdfPageNumber).then(function (page) {
        console.log("Page loaded");

        let viewport = page.getViewport({ scale: 1 });
        const scale = canvas1.height / viewport.height;
        viewport = page.getViewport({ scale: scale });

        canvas1.width = window.innerWidth;
        canvas1.height = window.innerHeight;

        ctx1.clearRect(0, 0, canvas1.width, canvas1.height);

        var renderContext = {
          canvasContext: ctx1,
          viewport: viewport,
          transform: [
            scale,
            0,
            0,
            scale,
            (canvas1.width - viewport.width * scale) / 2,
            (canvas1.height - viewport.height * scale) / 2,
          ],
        };

        page.render(renderContext).promise.then(function () {
          console.log("Page rendered");
        });
      });
    })
    .catch(function (error) {
      console.error("Error loading PDF: ", error);
    });
}

socket.on("welcome", async () => {
  myDataChannel = myPeerConnection.createDataChannel("chat");
  myDataChannel.addEventListener("message", (event) =>
    messageHandle(event, ctx2, ctx1, canvas2)
  );
  console.log("made data channel");
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  console.log("sent the offer");
  socket.emit("offer", offer, roomName);
});

function messageHandle(event, context1, context2, canvasToDraw) {
  console.log("messagehandlecalled");
  try {
    data = JSON.parse(event.data);
    if (data.type === "draw") {
      inputData = new GetStroke(event.data);
      inputData.reconstructStroke(context1, context2, canvasToDraw);
      strokeStorage.putStroke(event.data);
    } else {
      loadPdfFromData(new Uint8Array(data.data));
    }
  } catch (error) {
    console.log(error);
  }
}

socket.on("offer", async (offer) => {
  myPeerConnection.addEventListener("datachannel", (event) => {
    myDataChannel = event.channel;
    myDataChannel.addEventListener("message", (event) =>
      messageHandle(event, ctx2, ctx1, canvas2)
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
  myPeerConnection.addEventListener("addstream", handleAddStream);
}

function handleIce(data) {
  console.log("sent candidate");
  socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data) {
  console.log("got an stream from my peer");
  const peerFace = document.getElementById("peerFace");
  peerFace.srcObject = data.stream;
}

function getCanvasCoordinates(event) {
  const rect = canvas1.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  return { x, y };
}

canvas1.addEventListener("mousemove", onDraw);
canvas1.addEventListener("mousedown", onStartPainting);
canvas1.addEventListener("mouseup", onStopPainting);
canvas1.addEventListener("mouseleave", onStopPainting);

function onDraw(event) {
  if (isPainting) {
    const coords = getCanvasCoordinates(event);
    data.coordinateInput(coords.x, coords.y, canvas1.width, canvas1.height);
    if (isErasing) {
      ctx1.clearRect(coords.x - 5, coords.y - 5, 10, 10);
    } else {
      ctx1.lineTo(coords.x, coords.y);
      ctx1.stroke();
    }

    return;
  }

  const coords = getCanvasCoordinates(event);
  ctx1.moveTo(coords.x, coords.y);
}

function onStartPainting(event) {
  if (!isPainting) {
    ctx1.beginPath();
    const coords = getCanvasCoordinates(event);
    if (isErasing) {
      data = new StrokeData("erase", ctx1.strokeStyle, ctx1.lineWidth);
    } else {
      data = new StrokeData("draw", ctx1.strokeStyle, ctx1.lineWidth);
    }
    data.coordinateInput(coords.x, coords.y, canvas1.width, canvas1.height);
    isPainting = true;
  }
}

function onStopPainting(event) {
  if (isPainting) {
    const coords = getCanvasCoordinates(event);
    data.coordinateInput(coords.x, coords.y, canvas1.width, canvas1.height);

    if (myDataChannel) {
      myDataChannel.send(data.exportStroke());
    }

    strokeStorage.putStroke(data.exportStroke());
    isPainting = false;
  }
}

eraseBtn.addEventListener("click", () => {
  isErasing = true;
  canvas1.style.cursor = "crosshair";
  ctx1.strokeStyle = "white";
  ctx1.globalCompositeOperation = "destination-out";
});

destroyBtn.addEventListener("click", () => {
  ctx2.clearRect(0, 0, canvas2.width, canvas2.height);
  strokeStorage = new StrokeStorage();
  ctx1.globalCompositeOperation = "source-over";
  isErasing = false;
  canvas1.style.cursor = "default";
});

linewidth.addEventListener("input", (event) => {
  ctx1.lineWidth = event.target.value;
});

lineColor.addEventListener("input", (event) => {
  ctx1.strokeStyle = event.target.value;
});

restoreBtn.addEventListener("click", () => {
  strokeStorage.restore(ctx2, ctx1, canvas2);
});

window.addEventListener("resize", () => {
  canvas1.width = window.innerWidth;
  canvas1.height = window.innerHeight;
  canvas2.width = window.innerWidth;
  canvas2.height = window.innerHeight;
});
