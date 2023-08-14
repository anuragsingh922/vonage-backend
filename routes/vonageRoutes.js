const express = require("express");
const router = express();

const controller = require("../controller");

router.get("/voice/answer", controller.answerCall);
router.post("/voice/handleCalls", controller.handleCalls);
router.post("/voice/handleCallEvents", controller.handleCallEvents);
router.post("/voice/embed_files", controller.embedFiles);

module.exports = router;