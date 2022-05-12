const router = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
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

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      reequired: true,
    },
  },
  { timestamps: true }
);

const Users = mongoose.model("Users", userSchema);

const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const user = await Users.findOne({ email: email });
    if (user) {
      infoLogger.info("Post - Email_already_exists");
      return res.status(400).json({ msg: "The email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new Users({
      username: username,
      email: email,
      password: passwordHash,
    });

    await newUser.save();
    infoLogger.info("Post - Sign_Up_Successfull");
    res.status(200).json({ msg: "Sign Up Successfull" });
  } catch (err) {
    errorLogger.error(err.message);
    return res.status(500).json({ msg: err.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Users.find({ email: email });

    if (user.length == 0) {
      infoLogger.info("Post - User_does_not_exists");
      return res.status(400).json({ msg: "User does not exists." });
    }

    const isMatch = await bcrypt.compare(password, user[0].password);
    if (!isMatch) {
      infoLogger.info("Post - Incorrect_password");
      return res.status(400).json({ msg: "Incorrect password." });
    }

    const payload = { id: user[0]._id, name: user[0].username };
    const token = jwt.sign(payload, process.env.TOKEN_SECRET, {
      expiresIn: "1d",
    });

    infoLogger.info("Post - Login_Successfull");
    res.status(200).json({ token: token, username: user[0].username });
  } catch (err) {
    errorLogger.error(err.message);
    return res.status(500).json({ msg: err.message });
  }
};

const verifyToken = (req, res) => {
  try {
    const token = req.header("Authorization");
    if (!token) return res.status(400).json({ msg: false, username: "" });

    jwt.verify(token, process.env.TOKEN_SECRET, async (err, verified) => {
      if (err) return res.status(400).json({ msg: false, username: "" });

      const user = await Users.findById(verified.id);
      if (!user) return res.status(400).json({ msg: false, username: "" });

      infoLogger.info("Get - Token_verification_successfull");
      return res.status(200).json({ msg: true, username: user.username });
    });
  } catch (err) {
    errorLogger.error(err.message);
    return res.status(500).json({ msg: err.message });
  }
};

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/verify", verifyToken);

module.exports = router;
