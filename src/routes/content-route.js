const express = require("express");

const contentController = require("../controllers/content-controller");
const authenticateMiddleware = require("../middlewares/authenticate");
const uploadMiddleware = require("../middlewares/upload");

const router = express.Router();

router.post(
  "/",
  authenticateMiddleware,
  uploadMiddleware.single("contentPDF"),
  uploadMiddleware.single("supportingDocuments"),
  contentController.CreateContent
);

module.exports = router;
