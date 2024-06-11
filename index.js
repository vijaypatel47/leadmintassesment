const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const dbPath = path.join(__dirname, "users.db");

const app = express();

app.use(express.json());

let db = null;

const intilializeData = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running on http://localhost:3000")
    );
  } catch (e) {
    console.log(`DB ERROR: ${e.message}`);
    process.exit(1);
  }
};

intilializeData();

let chatRooms = [];
let users = [];
let isAuthenticated = false;

let availableCoins = 0;

// midlleWear

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
        isAuthenticated = true;
      }
    });
  }
};

// Get all users

app.get("/", async (request, response) => {
  const queryData = `
        SELECT 
        *
        FROM
       user
       `;
  const responseData = await db.all(queryData);
  response.send(responseData);
});

// Register

app.post("/register", async (request, response) => {
  const { deviceId, name, phone, availCoins, password } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const getUsername = `
    select
    * 
    from 
    user 
    where name='${name}';
    `;
  const dbUser = await db.get(getUsername);
  if (dbUser === undefined) {
    const createUser = `
        INSERT INTO user(deviceId, name, phone, availCoins, password)
        VALUES('${deviceId}','${name}' ,'${phone}',${availCoins} ,'${hashedPassword}')
        `;
    const sendData = db.run(createUser);
    response.send("user Created Successfully");
    availableCoins = availCoins;
    users.push(createUser);
  } else {
    response.status(400);
    response.send("Already user Register");
  }
});

// Login

app.post("/login", async (request, response) => {
  const { name, password } = request.body;
  const getUsername = `
    select
    * 
    from 
    user 
    where name='${name}';
    `;
  const dbUser = await db.get(getUsername);

  if (dbUser === undefined) {
    response.status(400);
    response.send("please register first username not find");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      const payload = {
        name: name,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

// createChat Room

app.post("/chatroom", authenticateToken, (request, response) => {
  const { roomName, capacity } = request.body;

  const existingRoom = chatRooms.find((room) => room.name === roomName);
  if (existingRoom) {
    return response.status(400).json({ error: "Room name already exists" });
  }
  // const availableCoins = users.find((user) => user.availCoins >= 150);
  const newRoom = {
    name: roomName,
    capacity: capacity,
    participants: [],
  };

  chatRooms.push(newRoom);

  response
    .status(201)
    .json({ message: "Chat room created successfully", room: newRoom });

  response.send("Coin is less");
});

// function Check PrimeMember

function checkPrimeMembership(req, res, next) {
  const isPrimeMember = true;
  let isAuthenticated = true;

  if (isAuthenticated && isPrimeMember) {
    next();
  } else {
    res.status(403).json({ error: "Unauthorized" });
  }
}

// Invite member to join chatRooms

app.post("/invite", authenticateToken, checkPrimeMembership, (req, res) => {
  const { roomId, deviceId } = req.body;

  const room = chatRooms.find((room) => room.id === roomId);
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  const recipient = users.find((user) => user.deviceId === recipientId);
  if (!recipient || !recipient.isPrimeMember) {
    return res.status(400).json({ error: "Recipient is not a prime member" });
  }

  // token
  const invitationToken = crypto.randomBytes(20).toString("hex");

  res.status(200).json({ message: "Invitation sent successfully" });
});

// Endpoint for joining a chat room with an invitation token
app.post("/join", (req, res) => {
  const { roomId, invitationToken } = req.body;
  const room = chatRooms.find(
    (room) => room.id === roomId && room.token === invitationToken
  );
  if (!room) {
    return res
      .status(404)
      .json({ error: "Room not found or invalid invitation token" });
  }
  const availableCoins = users.find((user) => user.availCoins >= 150);
  if (availableCoins) {
    room.participants.push(req.user);

    res.status(200).json({ message: "Joined the chat room successfully" });
  } else {
    response.send("Generate Super Coins  than You are be join");
  }
});

let friendRequests = [];

// profile VIew

app.get("/profile/:userId", checkPrimeMembership, (req, res) => {
  const userId = parseInt(req.params.userId);

  const userProfile = users.find((user) => user.id === userId);

  if (userProfile) {
    res.status(200).json(userProfile);
  } else {
    res.status(404).json({ error: "User not found" });
  }
});

// friend request

app.post("/friend-requests", checkPrimeMembership, (req, res) => {
  const { senderId, receiverId } = req.body;

  const sender = users.find((user) => user.id === senderId);
  const receiver = users.find((user) => user.id === receiverId);

  if (!sender || !receiver) {
    return res.status(404).json({ error: "Sender or receiver not found" });
  }

  const existingRequest = friendRequests.find(
    (request) =>
      request.senderId === senderId && request.receiverId === receiverId
  );

  if (existingRequest) {
    return res.status(400).json({ error: "Friend request already sent" });
  }

  friendRequests.push({ senderId, receiverId });

  res.status(200).json({ message: "Friend request sent successfully" });
});
