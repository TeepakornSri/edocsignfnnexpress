const nodemailer = require('nodemailer');
require('dotenv').config();

const sendEmail = async (recipientEmail, subject, docId, recipientId, docNumber, docHeader, docInfo, contentPDF, supportingDocuments, senderName, senderDepartment, currentStep, totalSteps, topic, previousApprovedSteps) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASSWORD
    }
  });

  const baseURL = process.env.APP_BASE_URL || 'http://localhost:5173';

  const approveLink = `${baseURL}/approve/${docId}/${recipientId}/approve`;
  const rejectLink = `${baseURL}/approve/${docId}/${recipientId}/reject`;

  let supportingDocumentsLink = '';
  if (supportingDocuments) {
    supportingDocumentsLink = `
      <tr>
        <td style="padding-bottom: 16px;">
          <strong>เอกสารประกอบการพิจารณา:</strong>
          <a href="${supportingDocuments}" style="color: #1D4ED8; text-decoration: none;">ดาวน์โหลดเอกสารประกอบ</a>
        </td>
      </tr>
    `;
  }

  let previousStepsInfo = '';
  if (previousApprovedSteps && previousApprovedSteps.length > 0) {
    previousStepsInfo = `
      <tr>
        <td style="padding-bottom: 16px;">
          <strong>ขั้นตอนที่อนุมัติแล้ว:</strong>
          <ul>
            ${previousApprovedSteps.map(step => `<li>Step ${step.step}: ${step.name}</li>`).join('')}
          </ul>
        </td>
      </tr>
    `;
  }

  const mailOptions = {
    from: process.env.EMAIL,
    to: recipientEmail,
    subject: subject,
    html: `
      <table style="width: 100%; padding: 16px; border-collapse: collapse;">
        <tr>
          <td style="padding-bottom: 16px;">
            กรุณาอนุมัติเอกสารที่หมายเลข ${docNumber} โดยคลิกที่ลิงก์ด้านล่าง:
          </td>
        </tr>
        <tr>
          <td style="padding-bottom: 16px;">
            <strong style="color: #1D4ED8;">ผู้ส่ง:</strong> ${senderName}
          </td>
        </tr>
        <tr>
          <td style="padding-bottom: 16px;">
            <strong style="color: #1D4ED8;">แผนก:</strong> ${senderDepartment}
          </td>
        </tr>
        <tr>
          <td style="padding-bottom: 16px;">
            <strong style="color: #1D4ED8;">หัวข้อ:</strong> ${topic}
          </td>
        </tr>
        <tr>
          <td style="padding-bottom: 16px;">
            <strong style="color: #1D4ED8;">หัวข้อเอกสาร:</strong> ${docHeader}
          </td>
        </tr>
        <tr>
          <td style="padding-bottom: 16px;">
            <strong style="color: #1D4ED8;">ข้อมูลเอกสาร:</strong> ${docInfo}
          </td>
        </tr>
        <tr>
          <td style="padding-bottom: 16px;">
            <strong>เอกสารการขออนุมัติ:</strong>
            <a href="${contentPDF}" style="color: #1D4ED8; text-decoration: none;">ดาวน์โหลดเอกสารการขออนุมัติ</a>
          </td>
        </tr>
        ${supportingDocumentsLink}
        ${previousStepsInfo}
        <tr>
          <td style="padding-bottom: 16px;">
            <strong style="color: #1D4ED8;">สถานะ:</strong> Step ${currentStep} of ${totalSteps}
          </td>
        </tr>
        <tr>
          <td style="padding-bottom: 16px;">
            <a href="${approveLink}" style="display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; margin-right: 10px;">อนุมัติ</a>
            <a href="${rejectLink}" style="display: inline-block; padding: 10px 20px; background-color: #f44336; color: white; text-decoration: none;">ปฏิเสธ</a>
          </td>
        </tr>
      </table>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.response);
    return info.response;
  } catch (error) {
    console.error('Error occurred while sending email:', error.message);
    throw new Error('Email sending failed');
  }
};

module.exports = sendEmail;
