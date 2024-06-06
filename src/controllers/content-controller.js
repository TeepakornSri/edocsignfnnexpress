const error = require("../middlewares/error");
const prisma = require("../models/prisma");
const { upload } = require("../utils/cloudinary-service");
const fs = require("fs/promises");
const { checkContentId } = require("../validators/content-validate");

exports.CreateContent = async (req, res, next) => {
  try {
    let content = req.body;

    if (req.file) {
      content.contentPDF = await upload(req.file.path);
      content.supportingDocuments = await upload(req.file.path);
    }

    content.categoryId = +content.categoryId;

    const contentcreated = await prisma.content.create({
      data: content,
    });

    res.status(200).json({ contentcreated });
  } catch (err) {
    next(err);
  } finally {
    if (req.file) {
      fs.unlink(req.file.path);
    }
  }
};

exports.createCategory = async (req, res, next) => {
  const data = req.body;
  try {
    const createCategory = await prisma.category.create({
      data: data,
    });
    res.status(200).json({ createCategory });
  } catch (err) {
    next(err);
  }
};

exports.getAllCategory = async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        category: true,
        createAt: true,
        updateAt: true,
      },
    });
    res.status(200).json({ categories });
  } catch (err) {
    next(err);
  }
};

exports.getAllContent = async (req, res, next) => {
  try {
    const contentIds = await prisma.content.findMany({
      select: {
        id: true,
        contentName: true,
        createAt: true,
        updateAt: true,
        contentPDF: true,
        categoryId: true,
      },
    });
    res.status(200).json({ contentIds });
  } catch (err) {
    next(err);
  }
};

exports.GetAllContent = async (req, res, next) => {
  try {
    const contentIds = await prisma.product.findMany({
      select: {
        id: true,
        contentName: true,
        createAt: true,
        updateAt: true,
        contentPDF: true,
        categoryId: true,
      },
    });
    res.status(200).json({ contentIds });
  } catch (err) {
    next(err);
  }
};

exports.getContentById = async (req, res, next) => {
  try {
    const { value } = checkContentId.validate(req.params);

    const content = await prisma.content.findUnique({
      where: { id: parseInt(value.contentId) },
    });
    res.status(200).json({ content });
  } catch (err) {
    next(err);
  }
};

exports.deleteContent = async (req, res, next) => {
  try {
    const { contentId } = req.params;
    const content = await prisma.content.findUnique({
      where: {
        id: +contentId,
      },
    });

    if (content) {
      await prisma.content.delete({
        where: {
          id: +contentId,
        },
      });
      res.status(200).json({ message: "Deleted Content" });
    } else {
      res.status(404).json({ message: "Content not found" });
    }
  } catch (err) {
    next(err);
  }
};

exports.getCategoryWithContent = async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        contents: true,
      },
    });
    res.status(200).json({ categories });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ message: "Error" });
  }
};

exports.updatecontent = async (req, res, next) => {
  try {
    const { contentId } = req.params;
    let content = req.body;
    console.log(content);
    if (req.file) {
      content.contentPDF = await upload(req.file.path);
    }
    content.categoryId = +content.categoryId;

    const updateCotent = await prisma.content.update({
      data: content,
      where: {
        id: +contentId,
      },
    });

    res.status(201).json({ updateCotent });
  } catch (err) {
    next(err);
  }
};

exports.deleteContent = async (req, res, next) => {
  try {
    const { contentId } = req.params;
    const content = await prisma.content.findUnique({
      where: {
        id: +contentId,
      },
    });

    if (content) {
      await prisma.content.delete({
        where: {
          id: +contentId,
        },
      });

      res.status(200).json({ message: "Deleted Content" });
    } else {
      res.status(404).json({ message: "Content not found" });
    }
  } catch (err) {
    next(err);
  }
};
