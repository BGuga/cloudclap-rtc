import http from "http";
import { Server } from "socket.io";
import express from "express";
import path from "path";

const app = express();

// Set the static files location
app.use("/public", express.static(path.join(__dirname, "public")));

// Serve the HTML file
app.get("/", (_, res) =>
  res.sendFile(path.join(__dirname, "views", "home.html"))
);
app.get("/*", (_, res) => res.redirect("/"));

const httpServer = http.createServer(app);
const wsServer = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000", "http://52.78.162.153:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

wsServer.on("connection", (socket) => {
  socket.on("join_room", (roomName) => {
    socket.join(roomName);
    socket.to(roomName).emit("welcome");
  });
  socket.on("offer", (offer, roomName) => {
    socket.to(roomName).emit("offer", offer);
  });
  socket.on("answer", (answer, roomName) => {
    socket.to(roomName).emit("answer", answer);
  });
  socket.on("ice", (ice, roomName) => {
    socket.to(roomName).emit("ice", ice);
  });
});

const handleListen = () => console.log(`Listening on http://localhost:3000`);
httpServer.listen(3000, handleListen);
