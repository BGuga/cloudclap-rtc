const socket = io("https://cloudclap.r-e.kr/", {
  withCredentials: true,
});
const destroyBtn = document.getElementById("destroy-btn");
const eraseBtn = document.getElementById("erase-btn");
const linewidth = document.getElementById("linewidth");
const restoreBtn = document.getElementById("restore_btn");
const lineColor = document.getElementById("lineColor");
const pdfFileInput = document.getElementById("pdf-file");
const saveCombinedBtn = document.getElementById("save-combined-btn");

function saveCombinedCanvasAsImage() {
  // Create a new canvas to combine canvas1 and canvas2
  const combinedCanvas = document.createElement("canvas");
  combinedCanvas.width = canvas1.width;
  combinedCanvas.height = canvas1.height;
  const combinedCtx = combinedCanvas.getContext("2d");

  // Draw canvas1 onto the combined canvas
  combinedCtx.drawImage(canvas1, 0, 0);

  // Draw canvas2 onto the combined canvas
  combinedCtx.drawImage(canvas2, 0, 0);

  // Convert the combined canvas to a data URL
  const dataURL = combinedCanvas.toDataURL("image/png");

  // Create a temporary link element
  const link = document.createElement("a");
  link.href = dataURL;
  link.download = "combined_canvas_image.png";

  // Trigger the download by clicking the link
  document.body.appendChild(link);
  link.click();

  // Remove the link element from the DOM
  document.body.removeChild(link);
}

saveCombinedBtn.addEventListener("click", saveCombinedCanvasAsImage);

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
  console.log(imageData);
  myDataChannel.send(imageData);
}

async function loadPdf(file) {
  const reader = new FileReader();

  reader.onload = async function (e) {
    const typedArray = new Uint8Array(e.target.result);

    // Set worker source for pdf.js
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js";

    // Load PDF document using pdf.js
    pdfjsLib
      .getDocument(typedArray)
      .promise.then(async function (pdf) {
        console.log("PDF loaded");
        const pdfPageNumber = 1;

        await pdf.getPage(pdfPageNumber).then(async function (page) {
          console.log("Page loaded");

          // Get the viewport
          const viewport = page.getViewport({ scale: 1 });

          // Create a canvas element to draw the PDF image
          const pdfCanvas = document.createElement("canvas");
          const pdfCtx = pdfCanvas.getContext("2d");

          // Set canvas dimensions to match PDF page
          pdfCanvas.width = viewport.width;
          pdfCanvas.height = viewport.height;

          // Render the PDF page on the canvas
          page
            .render({ canvasContext: pdfCtx, viewport: viewport })
            .promise.then(async function () {
              console.log("Page rendered");

              // Draw the PDF image on canvas1
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

  coordinateInput(x, y) {
    this.coordinateArray.push([x, y]);
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

  getCoordinate(i) {
    return this.coordinateArray[i];
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
        let startCoordinate = this.strokeData.getCoordinate(0);
        context1.moveTo(startCoordinate[0], startCoordinate[1]);

        for (let i = 0; i < this.strokeData.getLength(); i++) {
          var coordinate = this.strokeData.getCoordinate(i);
          context1.lineTo(coordinate[0], coordinate[1]);
          context1.stroke();
        }
      }
    }

    if (this.strokeData.getType() == "erase") {
      if (this.strokeData.getLength() > 0) {
        let startCoordinate = this.strokeData.getCoordinate(0);
        context1.clearRect(
          startCoordinate[0] - 5,
          startCoordinate[1] - 5,
          10,
          10
        );

        for (let i = 0; i < this.strokeData.getLength(); i++) {
          var coordinate = this.strokeData.getCoordinate(i);
          context1.clearRect(coordinate[0] - 5, coordinate[1] - 5, 10, 10);
        }
      }
    }
  }

  storeStroke(dataStorage) {
    dataStorage.push(this.strokeData.exportStroke);
  }
}

let strokeStorage = new StrokeStorage();
let isErasing = false;
let isPainting = false;
var tempData;
var inputData;

let roomName;
let myPeerConnection;
let myDataChannel;

const canvas1 = document.getElementById("canvas1");
const canvas2 = document.getElementById("canvas2");

const ctx1 = canvas1.getContext("2d");
const ctx2 = canvas2.getContext("2d");

ctx1.lineWidth = 5;
ctx1.lineCap = "round";
ctx1.strokeStyle = "black";
ctx2.lineWidth = 5;
ctx2.lineCap = "round";
ctx2.strokeStyle = "black";

// Set the canvas dimensions to match the window size
canvas1.width = window.innerWidth;
canvas1.height = window.innerHeight;
canvas2.width = window.innerWidth;
canvas2.height = window.innerHeight;

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

const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");
welcomeForm.addEventListener("submit", handleWelcomeSubmit);

function messageHandle(event, context1, context2, canvasToDraw) {
  console.log("messagehandlecalled");
  try {
    eventData = JSON.parse(event.data);
    if (eventData.type === "draw" || eventData.type === "erase") {
      inputData = new GetStroke(event.data);
      inputData.reconstructStroke(context1, context2, canvasToDraw);
      strokeStorage.putStroke(event.data);
    }
  } catch (error) {
    console.log("hellohelloehllo");
    const image = new Image();
    image.onload = function () {
      ctx1.drawImage(image, 0, 0);
    };
    image.src = event.data;
  }
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

socket.on("offer", async (offer) => {
  myPeerConnection.addEventListener("datachannel", (event) => {
    myDataChannel = event.channel;
    myDataChannel.addEventListener("message", (event) =>
      messageHandle(event, ctx2, ctx1, canvas2)
    );
  });
  console.log("received offer");
  await myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  await myPeerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName);
});

socket.on("answer", (answer) => {
  myPeerConnection.setRemoteDescription(answer);
});

let message = "  has left the room";
socket.on("disconnected", (event) => {
  socket.emit("welcomed");
});

destroyBtn.addEventListener("click", destroyConnection);
eraseBtn.addEventListener("click", eraseDrawing);
restoreBtn.addEventListener("click", restoreDrawing);

linewidth.addEventListener("input", (event) => {
  const value = event.target.value;
  ctx1.lineWidth = value;
  ctx2.lineWidth = value;
});

lineColor.addEventListener("input", (event) => {
  const value = event.target.value;
  ctx1.strokeStyle = value;
  ctx2.strokeStyle = value;
});

function eraseDrawing() {
  isErasing = !isErasing;
  if (isErasing) {
    eraseBtn.innerText = "Stop Erasing";
  } else {
    eraseBtn.innerText = "Start Erasing";
  }
}

function restoreDrawing() {
  ctx1.clearRect(0, 0, canvas1.width, canvas1.height);
  strokeStorage.restore(ctx2, ctx1, canvas2);
}

function makeConnection() {
  myPeerConnection = new RTCPeerConnection();
  myPeerConnection.addEventListener("icecandidate", handleIceCandidate);
  myPeerConnection.addEventListener("iceconnectionstatechange", () =>
    console.log(myPeerConnection.iceConnectionState)
  );
  myPeerConnection.addEventListener("datachannel", receiveDataChannel);
}

function handleIceCandidate(event) {
  console.log("ice candidate");
  socket.emit("candidate", event.candidate, roomName);
}

function receiveDataChannel(event) {
  console.log("data channel received");
  myDataChannel = event.channel;
  myDataChannel.addEventListener("message", (event) =>
    messageHandle(event, ctx2, ctx1, canvas2)
  );
}

function destroyConnection() {
  myPeerConnection.close();
  console.log("destroyed");
}

canvas1.addEventListener("mousedown", onStartPainting);
canvas1.addEventListener("mouseup", onStopPainting);
canvas1.addEventListener("mouseleave", onStopPainting);

function getCanvasCoordinates(event) {
  const rect = canvas1.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function onDraw(event) {
  if (isPainting) {
    const coords = getCanvasCoordinates(event);
    tempData.coordinateInput(coords.x, coords.y);
    if (isErasing) {
      ctx1.clearRect(coords.x - 5, coords.y - 5, 10, 10);
    } else {
      ctx1.lineTo(coords.x, coords.y);
      ctx1.stroke();
    }
  }
}

canvas1.addEventListener("mousemove", onDraw);

function onStartPainting(event) {
  if (!isPainting) {
    ctx1.beginPath();
    const coords = getCanvasCoordinates(event);
    if (isErasing) {
      tempData = new StrokeData("erase", ctx1.strokeStyle, ctx1.lineWidth);
    } else {
      tempData = new StrokeData("draw", ctx1.strokeStyle, ctx1.lineWidth);
    }
    tempData.coordinateInput(coords.x, coords.y);
    isPainting = true;
  }
}

function onStopPainting(event) {
  if (isPainting) {
    const coords = getCanvasCoordinates(event);
    if (myDataChannel) {
      myDataChannel.send(tempData.exportStroke());
    }
    strokeStorage.putStroke(tempData.exportStroke());
    isPainting = false;
  }
}
