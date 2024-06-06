const express = require("express");
const contentController = require("../controllers/content-controller");
const authenticateMiddleware = require("../middlewares/authenticate");
const uploadMiddleware = require("../middlewares/upload");

const router = express.Router();

router.post(
  "/",
  authenticateMiddleware,
  uploadMiddleware.fields([
    { name: 'contentPDF', maxCount: 1 },
    { name: 'supportingDocuments', maxCount: 1 }
  ]),
  contentController.CreateContent
);

module.exports = router;
