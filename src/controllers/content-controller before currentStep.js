const prisma = require('../models/prisma');
const { upload } = require('../config/cloudinary');
const fs = require('fs/promises');
const sendEmail = require('../utils/sendmail');
const sendNotificationToSender = require('../utils/sendmailtosender');

exports.GetAllDoc = async (req, res, next) => {
  try {
    let Docids;
    if (req.user.role === 'ADMIN') {
      Docids = await prisma.doc.findMany({
        where: {
          deleted: false 
        },
        orderBy: { createdAt: 'desc' },
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
    } else if (req.user.role === 'USER') {
      Docids = await prisma.doc.findMany({
        where: {
          senderId: req.user.id,
          deleted: false 
        },
        orderBy: { createdAt: 'desc' },
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
    }
    res.status(200).json({ documents: Docids });
  } catch (err) {
    next(err);
  }
};

exports.CreateDocumentWithRecipients = async (req, res, next) => {
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

    const sender = await prisma.user.findUnique({ where: { id: content.senderId } });

    const datadoc = await prisma.doc.create({
      data: {
        docNumber: content.docNumber,
        senderId: content.senderId,
        docHeader: content.docHeader,
        docInfo: content.docInfo,
        contentPDF: content.contentPDF,
        supportingDocuments: content.supportingDocuments,
        topic: content.topic,
        recipients: {
          create: content.recipients.map(recipient => ({
            recipientId: parseInt(recipient.recipientId),
            status: recipient.status || 'PENDING',
            step: parseInt(recipient.step) || 1
          }))
        }
      }
    });

    const step1Recipients = content.recipients.filter(recipient => parseInt(recipient.step) === 1);
    const totalSteps = Math.max(...content.recipients.map(recipient => parseInt(recipient.step) || 1));
    await notifyRecipients(step1Recipients, datadoc.id, content.docNumber, content.docHeader, content.docInfo, content.contentPDF, content.supportingDocuments, sender, totalSteps, content.topic);

    res.status(200).json({ datadoc });
  } catch (err) {
    next(err);
  }
};

const notifyRecipients = async (recipients, docId, docNumber, docHeader, docInfo, contentPDF, supportingDocuments, sender, totalSteps, topic) => {
  for (let recipient of recipients) {
    const user = await prisma.user.findUnique({ where: { id: parseInt(recipient.recipientId) } });
    if (!user) {
      continue;
    }

    const previousApprovedSteps = await prisma.docRecipient.findMany({
      where: {
        docId: parseInt(docId),
        status: 'APPROVED',
        step: { lt: parseInt(recipient.step) }
      },
      select: { step: true, recipientId: true }
    });

    const previousApprovedUsers = await prisma.user.findMany({
      where: { id: { in: previousApprovedSteps.map(step => step.recipientId) } },
      select: { id: true, firstName: true, lastName: true, department: true }
    });

    const previousApprovedStepsInfo = previousApprovedSteps.map(step => {
      const user = previousApprovedUsers.find(u => u.id === step.recipientId);
      return { step: step.step, name: `${user.firstName} ${user.lastName}`, department: user.department };
    });

    try {
      await sendEmail(
        user.email,
        'กรุณาอนุมัติเอกสาร',
        docId,
        recipient.recipientId,
        docNumber,
        docHeader,
        docInfo,
        contentPDF,
        supportingDocuments,
        `${sender.firstName} ${sender.lastName}`,
        sender.department,
        recipient.step,
        totalSteps,
        topic,
        previousApprovedStepsInfo
      );
    } catch (error) {
      console.error(`การส่งอีเมลถึง ${user.email} ล้มเหลว: ${error.message}`);
    }
  }
};

const getPreviousApprovedStepsInfo = async (docId) => {
  const previousApprovedSteps = await prisma.docRecipient.findMany({
    where: {
      docId: parseInt(docId),
      status: 'APPROVED'
    },
    select: { step: true, recipientId: true }
  });

  const previousApprovedUsers = await prisma.user.findMany({
    where: { id: { in: previousApprovedSteps.map(step => step.recipientId) } },
    select: { id: true, firstName: true, lastName: true, department: true }
  });

  return previousApprovedSteps.map(step => {
    const user = previousApprovedUsers.find(u => u.id === step.recipientId);
    return { step: step.step, name: `${user.firstName} ${user.lastName}`, department: user.department };
  });
};

exports.approveDocument = async (req, res, next) => {
  try {
    const { docId, recipientId } = req.params;

    const currentRecipient = await prisma.docRecipient.findFirst({
      where: { docId: parseInt(docId), recipientId: parseInt(recipientId) }
    });

    if (!currentRecipient) {
      return res.status(404).send('ไม่พบเอกสารหรือผู้รับที่ระบุ');
    }

    if (currentRecipient.status !== 'PENDING') {
      return res.status(304).send('การดำเนินการนี้ได้เสร็จสมบูรณ์แล้ว');
    }

    await prisma.docRecipient.updateMany({
      where: { docId: parseInt(docId), recipientId: parseInt(recipientId) },
      data: { status: 'APPROVED' }
    });

    const currentStepRecipients = await prisma.docRecipient.findMany({
      where: { docId: parseInt(docId), step: currentRecipient.step }
    });

    const allApproved = currentStepRecipients.every(recipient => recipient.status === 'APPROVED');

    const doc = await prisma.doc.findUnique({ where: { id: parseInt(docId) } });
    const sender = await prisma.user.findUnique({ where: { id: doc.senderId } });

    const totalSteps = Math.max(...(await prisma.docRecipient.findMany({
      where: { docId: parseInt(docId) },
      select: { step: true }
    })).map(r => r.step));
    
    console.log(`currentStep: ${currentRecipient.step}, totalSteps: ${totalSteps}`);

    if (allApproved) {
      const nextStepRecipients = await prisma.docRecipient.findMany({
        where: { docId: parseInt(docId), step: currentRecipient.step + 1 }
      });

      if (nextStepRecipients.length > 0) {
        await notifyRecipients(nextStepRecipients, parseInt(docId), doc.docNumber, doc.docHeader, doc.docInfo, doc.contentPDF, doc.supportingDocuments, sender, totalSteps, doc.topic);
      }

      const previousApprovedStepsInfo = await getPreviousApprovedStepsInfo(docId);

      // ส่งอีเมลแจ้งเตือนผู้ส่งเอกสาร
      await sendNotificationToSender(
        sender.email,
        doc.docNumber,
        doc.docHeader,
        doc.docInfo,
        doc.contentPDF,
        doc.supportingDocuments,
        sender.department,
        totalSteps,
        totalSteps,
        doc.topic,
        previousApprovedStepsInfo,
        'APPROVED'
      );

      // อัปเดตสถานะเอกสารเป็น 'APPROVED' เฉพาะเมื่อถึงขั้นตอนสุดท้ายและทุกคนอนุมัติแล้วเท่านั้น
      if (currentRecipient.step === totalSteps) {
        await prisma.doc.update({
          where: { id: parseInt(docId) },
          data: { status: 'APPROVED' }
        });
      }
    } else {
      const previousApprovedStepsInfo = await getPreviousApprovedStepsInfo(docId);

      // ส่งอีเมลแจ้งเตือนผู้ส่งเอกสารสำหรับขั้นตอนที่ไม่ใช่ขั้นตอนสุดท้าย
      await sendNotificationToSender(
        sender.email,
        doc.docNumber,
        doc.docHeader,
        doc.docInfo,
        doc.contentPDF,
        doc.supportingDocuments,
        sender.department,
        currentRecipient.step,
        totalSteps,
        doc.topic,
        previousApprovedStepsInfo,
        'PENDING'
      );
    }

    res.status(200).send('อนุมัติเอกสารเรียบร้อยแล้ว');
  } catch (err) {
    next(err);
  }
};

exports.rejectDocument = async (req, res, next) => {
  try {
    const { docId, recipientId } = req.params;

    const currentRecipient = await prisma.docRecipient.findFirst({
      where: { docId: parseInt(docId), recipientId: parseInt(recipientId) }
    });

    if (!currentRecipient) {
      return res.status(404).send('ไม่พบเอกสารหรือผู้รับที่ระบุ');
    }

    if (currentRecipient.status !== 'PENDING') {
      return res.status(304).send('การดำเนินการนี้ได้เสร็จสมบูรณ์แล้ว');
    }

    await prisma.docRecipient.updateMany({
      where: { docId: parseInt(docId), recipientId: parseInt(recipientId) },
      data: { status: 'REJECT' }
    });

    await prisma.doc.update({
      where: { id: parseInt(docId) },
      data: { status: 'REJECT' }
    });

    const doc = await prisma.doc.findUnique({ where: { id: parseInt(docId) } });
    const sender = await prisma.user.findUnique({ where: { id: doc.senderId } });

    const previousApprovedStepsInfo = await getPreviousApprovedStepsInfo(docId);

    // ส่งอีเมลแจ้งเตือนผู้ส่งเอกสาร
    await sendNotificationToSender(
      sender.email,
      doc.docNumber,
      doc.docHeader,
      doc.docInfo,
      doc.contentPDF,
      doc.supportingDocuments,
      sender.department,
      currentRecipient.step,
      1,  // Rejection doesn't need total steps, so it's set to 1.
      doc.topic,
      previousApprovedStepsInfo,
      'REJECT'
    );

    res.status(200).send('ปฏิเสธเอกสารเรียบร้อยแล้ว');
  } catch (err) {
    next(err);
  }
};

exports.softDeleteDocument = async (req, res, next) => {
  try {
    const { docId } = req.params;

    const doc = await prisma.doc.findUnique({ where: { id: parseInt(docId) } });

    if (!doc) {
      return res.status(404).send('ไม่พบเอกสารที่ระบุ');
    }
    await prisma.doc.update({
      where: { id: parseInt(docId) },
      data: { deleted: true, deletedAt: new Date() }
    });

    res.status(200).send('ลบเอกสารเรียบร้อยแล้ว');
  } catch (err) {
    next(err);
  }
};
