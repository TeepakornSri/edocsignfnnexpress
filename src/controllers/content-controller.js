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
          },
          recipients: {
            select: {
              recipient: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  department: true
                }
              },
              status: true,
              step: true
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
          },
          recipients: {
            select: {
              recipient: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  department: true
                }
              },
              status: true,
              step: true
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



exports.getDocById = async (req, res, next) => {
  const docId = parseInt(req.params.docId); // Parse docId to integer

  try {
    const document = await prisma.doc.findUnique({
      where: {
        id: docId,
      },
      select: {
        id: true,
        docNumber: true,
        docHeader: true,
        docInfo: true,
        createdAt: true,
        status: true,
        contentPDF: true,
        supportingDocuments: true,
        sender: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            department: true,
          },
        },
        recipients: {
          select: {
            recipient: {
              select: {
                id:true,
                firstName: true,
                lastName: true,
                email: true,
                department: true,
              },
            },
            status: true,
            step: true,
          },
        },
      },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Logging the fetched document to console
    console.log('Fetched document:', document);

    res.status(200).json({ doc: document });
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
        recipients: {
          create: content.recipients.map(recipient => ({
            recipientId: parseInt(recipient.recipientId),
            status: recipient.status || 'PENDING',
            step: parseInt(recipient.step) || 1,
            topic: recipient.topic || 'APPROVE' // จัดเก็บหัวข้อใน DocRecipient
          }))
        }
      }
    });

    const step1Recipients = content.recipients.filter(recipient => parseInt(recipient.step) === 1);
    const totalSteps = Math.max(...content.recipients.map(recipient => parseInt(recipient.step) || 1));
    await notifyRecipients(step1Recipients, datadoc.id, content.docNumber, content.docHeader, content.docInfo, content.contentPDF, content.supportingDocuments, sender, totalSteps);

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
        recipient.topic, // เพิ่ม topic ที่นี่
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

    if (allApproved) {
      const nextStepRecipients = await prisma.docRecipient.findMany({
        where: { docId: parseInt(docId), step: currentRecipient.step + 1 }
      });

      if (nextStepRecipients.length > 0) {
        await notifyRecipients(nextStepRecipients, parseInt(docId), doc.docNumber, doc.docHeader, doc.docInfo, doc.contentPDF, doc.supportingDocuments, sender, totalSteps);
      }

      const previousApprovedStepsInfo = await getPreviousApprovedStepsInfo(docId);

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
        currentRecipient.topic, // เพิ่ม topic ที่นี่
        previousApprovedStepsInfo,
        currentRecipient.step === totalSteps ? 'APPROVED' : 'PENDING'
      );

      if (currentRecipient.step === totalSteps) {
        await prisma.doc.update({
          where: { id: parseInt(docId) },
          data: { status: 'APPROVED' }
        });
      }
    } else {
      const previousApprovedStepsInfo = await getPreviousApprovedStepsInfo(docId);

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
        currentRecipient.topic, // เพิ่ม topic ที่นี่
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

    await sendNotificationToSender(
      sender.email,
      doc.docNumber,
      doc.docHeader,
      doc.docInfo,
      doc.contentPDF,
      doc.supportingDocuments,
      sender.department,
      currentRecipient.step,
      1, // Rejection doesn't need total steps, so it's set to 1.
      currentRecipient.topic, // เพิ่ม topic ที่นี่
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


// exports.updateDocument = async (req, res, next) => {
//   try {
//     const { docId } = req.params;
//     const content = req.body;

//     const existingDoc = await prisma.doc.findUnique({ where: { id: parseInt(docId) } });
//     if (!existingDoc) {
//       return res.status(404).send('ไม่พบเอกสารที่ระบุ');
//     }

//     if (req.files && req.files.contentPDF) {
//       const uploadedPDF = await upload(req.files.contentPDF[0].path);
//       content.contentPDF = uploadedPDF;
//       await fs.unlink(req.files.contentPDF[0].path);
//     }

//     if (req.files && req.files.supportingDocuments) {
//       const uploadedSupportingDocument = await upload(req.files.supportingDocuments[0].path);
//       content.supportingDocuments = uploadedSupportingDocument;
//       await fs.unlink(req.files.supportingDocuments[0].path);
//     }

//     const updatedDoc = await prisma.doc.update({
//       where: { id: parseInt(docId) },
//       data: {
//         docNumber: content.docNumber || existingDoc.docNumber,
//         docHeader: content.docHeader || existingDoc.docHeader,
//         docInfo: content.docInfo || existingDoc.docInfo,
//         contentPDF: content.contentPDF || existingDoc.contentPDF,
//         supportingDocuments: content.supportingDocuments || existingDoc.supportingDocuments
//       }
//     });

//     if (content.recipients && Array.isArray(content.recipients)) {
//       // ลบ recipients เดิมทั้งหมด
//       await prisma.docRecipient.deleteMany({
//         where: { docId: parseInt(docId) }
//       });

//       // เพิ่ม recipients ใหม่
//       const recipientUpdates = content.recipients.map(async recipient => {
//         const recipientId = parseInt(recipient.recipientId);
//         const step = parseInt(recipient.step) || 1;
//         const topic = recipient.topic || 'APPROVE';

//         if (isNaN(recipientId)) {
//           throw new Error(`Invalid recipient ID: ${recipient.recipientId}`);
//         }

//         return prisma.docRecipient.create({
//           data: {
//             docId: parseInt(docId),
//             recipientId: recipientId,
//             status: recipient.status || 'PENDING',
//             step: step,
//             topic: topic // จัดเก็บหัวข้อใน DocRecipient
//           }
//         });
//       });

//       await Promise.all(recipientUpdates);
//     }

//     res.status(200).json({ updatedDoc });
//   } catch (err) {
//     next(err);
//   }
// };



exports.updateDocument = async (req, res, next) => {
  try {
    const { docId } = req.params;
    const content = req.body;

    const existingDoc = await prisma.doc.findUnique({ where: { id: parseInt(docId) } });
    if (!existingDoc) {
      return res.status(404).send('ไม่พบเอกสารที่ระบุ');
    }

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

    const updatedDoc = await prisma.doc.update({
      where: { id: parseInt(docId) },
      data: {
        docNumber: content.docNumber || existingDoc.docNumber,
        docHeader: content.docHeader || existingDoc.docHeader,
        docInfo: content.docInfo || existingDoc.docInfo,
        contentPDF: content.contentPDF || existingDoc.contentPDF,
        supportingDocuments: content.supportingDocuments || existingDoc.supportingDocuments
      }
    });

    let newRecipients = [];

    if (content.recipients && Array.isArray(content.recipients)) {
      // ลบ recipients เดิมทั้งหมด
      await prisma.docRecipient.deleteMany({
        where: { docId: parseInt(docId) }
      });

      // เพิ่ม recipients ใหม่
      const recipientUpdates = content.recipients.map(async recipient => {
        const recipientId = parseInt(recipient.recipientId);
        const step = parseInt(recipient.step) || 1;
        const topic = recipient.topic || 'APPROVE';

        if (isNaN(recipientId)) {
          throw new Error(`Invalid recipient ID: ${recipient.recipientId}`);
        }

        const newRecipient = await prisma.docRecipient.create({
          data: {
            docId: parseInt(docId),
            recipientId: recipientId,
            status: recipient.status || 'PENDING',
            step: step,
            topic: topic // จัดเก็บหัวข้อใน DocRecipient
          }
        });

        newRecipients.push(newRecipient);

        return newRecipient;
      });

      await Promise.all(recipientUpdates);
    }

    // ส่งอีเมลแจ้งเตือนผู้รับเอกสาร
    const sender = await prisma.user.findUnique({ where: { id: existingDoc.senderId } });
    newRecipients.forEach(async (recipient) => {
      const user = await prisma.user.findUnique({ where: { id: recipient.recipientId } });
      await sendEmail(
        user.email,
        'เอกสารถูกอัปเดต',
        docId,
        recipient.recipientId,
        updatedDoc.docNumber,
        updatedDoc.docHeader,
        updatedDoc.docInfo,
        updatedDoc.contentPDF,
        updatedDoc.supportingDocuments,
        `${sender.firstName} ${sender.lastName}`,
        sender.department,
        recipient.step,
        newRecipients.length,
        recipient.topic,
        [] // previousApprovedSteps should be fetched if needed
      );
    });

    res.status(200).json({ updatedDoc });
  } catch (err) {
    next(err);
  }
};
