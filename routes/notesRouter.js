const router = require("express").Router();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { route } = require("express/lib/application");

const log4js = require("log4js");

log4js.configure({
  appenders: {
    error: { type: "file", filename: "log/notes_error.log" },
    info: { type: "file", filename: "log/notes_info.log" },
  },
  categories: {
    default: {
      appenders: ["info"],
      level: "info",
    },
    error: {
      appenders: ["error"],
      level: "error",
    },
    info: {
      appenders: ["info"],
      level: "info",
    },
  },
});

const infoLogger = log4js.getLogger("info");
const errorLogger = log4js.getLogger("error");

const auth = (req, res, next) => {
  try {
    const token = req.header("Authorization");
    if (!token) {
      return res.status(400).json({ msg: "Invalid Authentication" });
    }

    jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
      if (err) {
        return res.status(400).json({ msg: "Authorization not valid." });
      }

      req.user = user;
      next();
    });
  } catch (err) {
    errorLogger.error(err.message);
    return res.status(500).json({ msg: err.message });
  }
};

const blockSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  tag: {
    type: String,
    required: true,
    default: "p",
  },
  html: {
    type: String,
    require: true,
    default: "",
  },
});

const notesSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    blocks: {
      type: [blockSchema],
      required: true,
      default: [],
    },
    date: {
      type: Date,
      default: Date.now,
    },
    user_id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    childPages: {
      type: [String],
      default: [],
      required: true,
    },
    parentPages: {
      type: [String],
      default: [],
      required: true,
    },
  },
  { timestamps: true }
);

const Notes = mongoose.model("Notes", notesSchema);

const getNotes = async (req, res) => {
  try {
    const notes = await Notes.find({ user_id: req.user.id });
    infoLogger.info(`Get - getNotes`);
    res.status(200).json(notes);
  } catch (err) {
    errorLogger.error(err.message);
    return res.status(500).json({ msg: err.message });
  }
};

const createNotes = async (req, res) => {
  try {
    const { title, blocks, date, childPages, parentPages } = req.body;
    const newNote = new Notes({
      title: title,
      blocks: blocks,
      date: date,
      user_id: req.user.id,
      name: req.user.name,
      childPages: childPages,
      parentPages: parentPages,
    });

    await newNote.save();
    infoLogger.info(`Post - createNote`);
    res.status(200).json({ msg: "Created a Note", id: newNote._id });
  } catch (err) {
    errorLogger.error(err.message);
    return res.status(500).json({ msg: err.message });
  }
};

const deleteNotes = async (req, res) => {
  try {
    const deleteRec = async (id) => {
      const note = await Notes.findById(id);
      for (const i of note.childPages) {
        await deleteRec(i);
      }
      await Notes.findByIdAndDelete(id);
    };
    await deleteRec(req.params.id);
    // await Notes.findByIdAndDelete(req.params.id);
    infoLogger.info(`Delete - deleteNote`);
    res.status(200).json({ msg: "Deleted the Note" });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
};

const updateNote = async (req, res) => {
  try {
    const { title, blocks, date, childPages, parentPages } = req.body;
    await Notes.findOneAndUpdate(
      { _id: req.params.id },
      {
        title: title,
        blocks: blocks,
        date: date,
        childPages: childPages,
        parentPages: parentPages,
      }
    );
    infoLogger.info(`Put - updateNote`);
    res.status(200).json({ msg: "Notes Updated" });
  } catch (err) {
    errorLogger.error(err.message);
    return res.status(500).json({ msg: err.message });
  }
};

const getNote = async (req, res) => {
  try {
    const note = await Notes.findById(req.params.id);
    infoLogger.info(`Get - getNote`);
    res.status(200).json(note);
  } catch (err) {
    errorLogger.error(err.message);
    return res.status(500).json("Note does not exists");
  }
};

const getTitle = async (req, res) => {
  try {
    let ans = [];
    for (const i of req.body.notes_id) {
      const note = await Notes.findById(i);
      if (note) {
        ans.push({ note_id: note._id, title: note.title });
      }
    }
    infoLogger.info(`Post - getTitle`);
    res.status(200).json(ans);
  } catch (err) {
    errorLogger.error(err.message);
    return res.status(500).json("Note does not exists");
  }
};

const deleteChildPage = async (req, res) => {
  try {
    const note = await Notes.findById(req.params.id);
    if (!note) return res.status(400).json("Parent Note does not exists");

    let childPages = note.childPages;
    childPages = childPages.filter((item) => item !== req.body.childPage_id);

    await Notes.findOneAndUpdate(
      { _id: note._id },
      {
        childPages: childPages,
      }
    );

    infoLogger.info(`Post - deleteChildPage`);
    res.status(200).json("ChildPage deleted");
  } catch (err) {
    errorLogger.error(err.message);
    return res.status(500).json({ msg: err.message });
  }
};

router.route("/").get(auth, getNotes).post(auth, createNotes);
router.route("/get-title").post(auth, getTitle);
router.route("/:id/delete-childpage").post(auth, deleteChildPage);

router
  .route("/:id")
  .get(auth, getNote)
  .put(auth, updateNote)
  .delete(auth, deleteNotes);

module.exports = router;
