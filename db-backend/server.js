const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const app = express();
app.use(cors());
// app.use(express.json());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

/* ===============================
   MongoDB Atlas Connection
================================= */

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

let loggeduserId = null;

/* ===============================
   User Schema
================================= */

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const User = mongoose.model("User", userSchema);



/* ===============================
   TOPIC SCHEMA
================================= */

const topicSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true }
}, { timestamps: true });

topicSchema.index({ userId: 1, name: 1 }, { unique: true });

const Topic = mongoose.model("Topic", topicSchema);


/* ===============================
   NOTE SCHEMA
================================= */

const noteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: "Topic", required: true },
  title: { type: String, required: true },
  content: { type: String } // Stores HTML (text + images)
}, { timestamps: true });

noteSchema.index({ userId: 1, topicId: 1, title: 1 }, { unique: true });

const Note = mongoose.model("Note", noteSchema);






/* ===============================
   SIGN UP
================================= */

app.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      email,
      password: hashedPassword
    });

    await newUser.save();

    res.json({ message: "Account created successfully" });

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   SIGN IN
================================= */

app.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({
      message: "Login successful",
      userId: user._id
    });

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});


app.post("/logout", (req, res) => {
    loggeduserId = null;
    res.send({ success: true });
});


/* ===============================
   CREATE TOPIC
================================= */



app.post("/savetopics", async (req, res) => {
  try {

    const { name, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "Missing userId" });
    }

    // 🔹 Check if topic already exists for this user
    const existingTopic = await Topic.findOne({
      name: name.toLowerCase(),
      userId: userId
    });

    if (existingTopic) {
      return res.status(400).json({ message: "Topic already exists" });
    }

    // 🔹 Create new topic
    const newTopic = new Topic({
      userId: userId,
      name: name.toLowerCase()
    });

    await newTopic.save();

    res.json(newTopic);

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to create topic" });
  }
});



/* ===============================
   GET USER TOPICS
================================= */

app.get("/topics", async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ message: "Missing userId" });

    const topics = await Topic.find({ userId: userId });
    res.json(topics);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch topics" });
  }
});



/* ===============================
   DELETE TOPIC (AND ITS NOTES)
================================= */
app.delete("/topics/:topicId", async (req, res) => {
  try {
    const topicId = req.params.topicId;
    const userId = req.query.userId; // ensure only the owner can delete
    if (!userId) return res.status(400).json({ message: "Missing userId" });

    // Optionally, verify topic belongs to user
    const topic = await Topic.findOne({ _id: topicId, userId: userId });
    if (!topic) return res.status(403).json({ message: "Unauthorized or topic not found" });

    await Note.deleteMany({ topicId });
    await Topic.findByIdAndDelete(topicId);

    res.json({ message: "Topic and related notes deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete topic" });
  }
});






/* ===============================
   CREATE NOTE
================================= */

app.post("/notes", async (req, res) => {
  try {
    const { topicId, title, content, userId } = req.body;


    if (!userId || !topicId || !title) {
      return res.status(400).json({ message: "Missing required fields" });
    }


    // Check if note with same name already exists in this topic
    const existingNote = await Note.findOne({
      topicId,
      userId: userId,
      title
    });

    if (existingNote) {
      return res.status(400).json({
        message: "Found duplicate notes"
      });
    }


    const note = new Note({
      userId: userId,
      topicId,
      title,
      content
    });

    await note.save();

    res.json(note);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create note" });
  }
});



/* ===============================
   GET NOTES FOR A TOPIC
================================= */

app.get("/notes/:topicId", async (req, res) => {
  try {
    const topicId = req.params.topicId;
    const userId = req.query.userId; // get userId
    if (!userId) return res.status(400).json({ message: "Missing userId" });

    const notes = await Note.find({ topicId, userId: userId });
    res.json(notes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch notes" });
  }
});


/* ===============================
   UPDATE NOTE (SAVE BUTTON)
================================= */

app.put("/notes/:noteId", async (req, res) => {
  try {
    const { content, userId } = req.body;

    const updatedNote = await Note.findByIdAndUpdate(
      {_id: req.params.noteId, userId: userId},
      { content },
      { new: true }
    );

    res.json(updatedNote);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update note" });
  }
});


/* ===============================
   DELETE NOTE
================================= */

app.delete("/notes/:noteId", async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ message: "Missing userId" });

    // Only allow deletion if note belongs to user
    const note = await Note.findOne({ _id: req.params.noteId, userId: userId });
    if (!note) return res.status(403).json({ message: "Unauthorized or note not found" });

    await Note.findByIdAndDelete(req.params.noteId);
    res.json({ message: "Note deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete note" });
  }
});


/* ===============================
   START SERVER
================================= */

app.listen(5001, () => {
  console.log("Server running on http://localhost:5001");
});
