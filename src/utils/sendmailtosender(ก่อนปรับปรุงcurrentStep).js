const nodemailer = require('nodemailer');
require('dotenv').config();

const sendNotificationToSender = async (recipientEmail, docNumber, docHeader, docInfo, contentPDF, supportingDocuments, senderDepartment, currentStep, totalSteps, topic, previousApprovedSteps, status) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASSWORD
    }
  });

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
          <ul style="margin: 0; padding: 0; list-style-type: none;">
            ${previousApprovedSteps.map(step => `<li style="margin-bottom: 8px;">Step ${step.step}: ${step.name} :${step.department}</li>`).join('')}
          </ul>
        </td>
      </tr>
    `;
  }

  let uniqueContent = '';
  if (currentStep === 1) {
    uniqueContent = '<p>คุณกำลังอยู่ในขั้นตอนที่ 1 ของเอกสารนี้.</p>';
  } else if (currentStep === totalSteps) {
    uniqueContent = '<p>การอนุมัติของคุณเป็นขั้นตอนสุดท้ายในกระบวนการ.</p>';
  } else {
    uniqueContent = `<p>คุณกำลังอยู่ในขั้นตอนที่ ${currentStep} ของเอกสารนี้.</p>`;
  }

  let statusMessage;
  if (status === 'APPROVED' && currentStep !== totalSteps) {
    statusMessage = `กำลังดำเนินการในขั้นตอนที่ ${currentStep} ของทั้งหมด ${totalSteps} ขั้นตอน:`;
  } else if (status === 'APPROVED' && currentStep === totalSteps) {
    statusMessage = 'เอกสารของคุณได้รับการอนุมัติแล้ว';
  } else if (status === 'REJECT') {
    statusMessage = 'เอกสารถูกปฏิเสธแล้ว';
  } else {
    statusMessage = 'สถานะไม่ทราบ';
  }

  const mailOptions = {
    from: process.env.EMAIL,
    to: recipientEmail,
    subject: 'การแจ้งเตือนการอนุมัติเอกสาร',
    html: `
      <div style="background-color: #f9f9f9; padding: 16px; font-family: Arial, sans-serif;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding-bottom: 16px;">
              ${statusMessage}
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
          ${(status !== 'APPROVED' || currentStep !== totalSteps) && status !== 'REJECT' ? `
          <tr>
            <td style="padding-bottom: 16px;">
              <strong style="color: #1D4ED8;">สถานะ:</strong> Step ${currentStep} of ${totalSteps}
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding-bottom: 16px;">
              ${uniqueContent}
            </td>
          </tr>
        </table>
      </div>
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

module.exports = sendNotificationToSender;
