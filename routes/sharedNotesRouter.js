const router = require("express").Router();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
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
    if (!token) return res.status(400).json({ msg: "Invalid Authentication" });

    jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
      if (err) return res.status(400).json({ msg: "Authorization not valid." });

      req.user = user;
      next();
    });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
};

const sharedNotesSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    user_id: {
      type: String,
      required: true,
    },
    othersNotes: {
      type: [String],
      required: true,
      default: [],
    },
  },
  { timestamps: true }
);

const sharedNotes = mongoose.model("sharedNotes", sharedNotesSchema);

const addToShareNotes = async (req, res) => {
  try {
    const userShareNotes = await sharedNotes.find({ user_id: req.user.id });
    if (userShareNotes.length == 0) {
      const newShareNotes = new sharedNotes({
        name: req.user.name,
        user_id: req.user.id,
        othersNotes: [req.body.note_id],
      });
      await newShareNotes.save();
    } else {
      var { name, user_id, othersNotes } = userShareNotes[0];
      othersNotes.push(req.body.note_id);
      await sharedNotes.findOneAndUpdate(
        { user_id: user_id },
        {
          name: name,
          user_id: user_id,
          othersNotes: othersNotes,
        }
      );
    }
    infoLogger.info(`Post - sharedNote_added`);
    res.status(200).json({ msg: "sharenote added successfully" });
  } catch (err) {
    errorLogger.error(err.message);
    return res.status(500).json({ msg: err.message });
  }
};

const getSharedNotes = async (req, res) => {
  try {
    const userShareNotes = await sharedNotes.find({ user_id: req.user.id });
    if (userShareNotes.length == 0) {
      res.status(200).json([]);
    } else {
      res.status(200).json(userShareNotes[0].othersNotes);
    }
    infoLogger.info(`Get - get_sharedNotes`);
  } catch (err) {
    errorLogger.error(err.message);
    return res.status(500).json({ msg: err.message });
  }
};

const deleteSharedNote = async (req, res) => {
  try {
    const userShareNotes = await sharedNotes.find({ user_id: req.user.id });
    if (userShareNotes.length !== 0) {
      let othersNotes = userShareNotes[0].othersNotes;
      othersNotes = othersNotes.filter((item) => item !== req.body.note_id);
      await sharedNotes.findOneAndUpdate(
        { user_id: req.user.id },
        {
          othersNotes: othersNotes,
        }
      );
      infoLogger.info(`Post - delete_sharedNote`);
      res.status(200).json("Shared Note delete");
    }
  } catch (err) {
    errorLogger.error(err.message);
    return res.status(500).json({ msg: err.message });
  }
};

router.route("/").get(auth, getSharedNotes).post(auth, addToShareNotes);

router.route("/delete").post(auth, deleteSharedNote);

module.exports = router;
