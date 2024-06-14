const prisma = require('../models/prisma');
const { upload } = require('../config/cloudinary');
const fs = require('fs/promises');
const sendEmail = require('../utils/sendmail');

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
          })),
        },
      },
    });

    console.log('content.recipients:', content.recipients);
    console.log('ส่งอีเมลเฉพาะ Step 1');
    const step1Recipients = content.recipients.filter(recipient => parseInt(recipient.step) === 1);
    const totalSteps = Math.max(...content.recipients.map(recipient => parseInt(recipient.step) || 1));
    console.log('step1Recipients:', step1Recipients);
    await notifyRecipients(step1Recipients, datadoc.id, content.docNumber, content.docHeader, content.docInfo, content.contentPDF, content.supportingDocuments, sender, totalSteps, content.topic);

    console.log('การสร้างเอกสารสำเร็จ');
    res.status(200).json({ datadoc });
  } catch (err) {
    next(err);
  }
};

const notifyRecipients = async (recipients, docId, docNumber, docHeader, docInfo, contentPDF, supportingDocuments, sender, totalSteps, topic) => {
  console.log('notifyRecipients ถูกเรียกใช้งาน');
  console.log('recipients:', recipients);

  for (let recipient of recipients) {
    console.log(`กำลังส่งอีเมลถึง recipient id: ${recipient.recipientId}`);
    const user = await prisma.user.findUnique({ where: { id: parseInt(recipient.recipientId) } });
    console.log('ข้อมูลผู้ใช้:', user);

    if (!user) {
      console.error(`ไม่พบผู้ใช้ที่มี id: ${recipient.recipientId}`);
      continue;
    }

    try {
      const emailSent = await sendEmail(
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
        topic 
      );
      console.log(`ส่งอีเมลถึง ${user.email} แล้ว: ${emailSent}`);
    } catch (error) {
      console.error(`การส่งอีเมลถึง ${user.email} ล้มเหลว: ${error.message}`);
    }
  }
};

exports.approveDocument = async (req, res, next) => {
  try {
    const { docId, recipientId } = req.params;

    console.log('กำลังอัปเดตสถานะเป็น APPROVED');
    await prisma.docRecipient.updateMany({
      where: { docId: parseInt(docId), recipientId: parseInt(recipientId) },
      data: { status: 'APPROVED' }
    });

    const currentRecipient = await prisma.docRecipient.findFirst({
      where: { docId: parseInt(docId), recipientId: parseInt(recipientId) }
    });

    const currentStepRecipients = await prisma.docRecipient.findMany({
      where: { docId: parseInt(docId), step: currentRecipient.step }
    });
    const allApproved = currentStepRecipients.every(recipient => recipient.status === 'APPROVED');
    console.log('สถานะของทุกคนใน step นี้:', currentStepRecipients);

    if (allApproved) {
      console.log('ทุกคนใน step นี้อนุมัติแล้ว');
      const nextStepRecipients = await prisma.docRecipient.findMany({
        where: { docId: parseInt(docId), step: currentRecipient.step + 1 }
      });
      if (nextStepRecipients.length > 0) {
        const doc = await prisma.doc.findUnique({ where: { id: parseInt(docId) } });
        const sender = await prisma.user.findUnique({ where: { id: doc.senderId } });
        await notifyRecipients(nextStepRecipients, docId, doc.docNumber, doc.docHeader, doc.docInfo, doc.contentPDF, doc.supportingDocuments, sender, currentRecipient.step + 1);
      } else {
        console.log('ไม่มี step ถัดไป อัปเดตสถานะเอกสารเป็น APPROVED');
        await prisma.doc.update({
          where: { id: parseInt(docId) },
          data: { status: 'APPROVED' }
        });
      }
    }

    res.status(200).send('อนุมัติเอกสารเรียบร้อยแล้ว');
  } catch (err) {
    next(err);
  }
};

exports.rejectDocument = async (req, res, next) => {
  try {
    const { docId, recipientId } = req.params;

    console.log('กำลังอัปเดตสถานะเป็น REJECTED');
    await prisma.docRecipient.updateMany({
      where: { docId: parseInt(docId), recipientId: parseInt(recipientId) },
      data: { status: 'REJECT' }
    });

    await prisma.doc.update({
      where: { id: parseInt(docId) },
      data: { status: 'REJECT' }
    });

    res.status(200).send('ปฏิเสธเอกสารเรียบร้อยแล้ว');
  } catch (err) {
    next(err);
  }
};