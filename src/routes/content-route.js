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
  contentController.CreateDocumentWithRecipients
);

router.get(
  "/showalldoc",
  authenticateMiddleware,
  contentController.GetAllDoc
);

router.get('/approve/:docId/:recipientId/:action', async (req, res, next) => {
  const { docId, recipientId, action } = req.params;

  try {
    if (action === 'approve') {
      await contentController.approveDocument(req, res, next);
    } else if (action === 'reject') {
      await contentController.rejectDocument(req, res, next);
    } else {
      res.status(400).send('Invalid action');
    }
  } catch (error) {
    next(error);
  }
});

router.delete('/:docId/delete'
  ,authenticateMiddleware,
  contentController.softDeleteDocument
)
module.exports = router;
