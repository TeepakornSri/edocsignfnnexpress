const error = require("../middlewares/error");
const prisma = require("../models/prisma");
const { upload } = require("../config/cloudinary");
const fs = require("fs/promises");

exports.CreateContent = async (req, res, next) => {
  try {
    let content = req.body;

    if (req.files && req.files.contentPDF) {
      const uploadedPDF = await upload(req.files.contentPDF[0].path);
      content.contentPDF = uploadedPDF;
      await fs.unlink(req.files.contentPDF[0].path);
    }

    if (req.files && req.files.supportingDocuments) {
      const uploadedSupportingDocument = await upload(req.files.supportingDocuments[0].path);
      content.supportingDocuments = uploadedSupportingDocument;
      await fs.unlink(req.files.supportingDocuments[0].path);
    }

    content.senderId = parseInt(content.senderId);

    const datadoc = await prisma.doc.create({
      data: content,
    });

    res.status(200).json({ datadoc });
  } catch (err) {
    next(err);
  }
};

exports.GetAllDoc = async (req, res, next) => {
  try {
    if (req.user.role === 'ADMIN') {
      const Docids = await prisma.doc.findMany({
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          docNumber: true,
          docHeader: true,
          createdAt: true,
          status: true,
          contentPDF: true,
          sender: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              department: true
            }
          },
        },
      });
      res.status(200).json({ documents: Docids });
    } else if (req.user.role === 'USER') {
      const Docids = await prisma.doc.findMany({
        where: { senderId: req.user.id }, 
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          docNumber: true,
          docHeader: true,
          createdAt: true,
          status: true,
          contentPDF: true,
          sender: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              department: true
            }
          }
        }
      });
      res.status(200).json({ documents: Docids });
    }
  } catch (err) {
    next(err);
  }
};





exports.ShowDocById = async (req, res, next) => {
  try {
    const showdoc = await prisma.doc.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        docNumber: true,
        docHeader: true,
        createdAt: true,
        status: true,
        contentPDF: true,
        sender: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            department: true
          }
        },
      },
    });

    res.status(200).json({ showdoc });
  } catch (err) {
    next(err);
  }
};
