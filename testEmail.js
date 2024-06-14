const sendEmail = require('./src/utils/sendmail');

const testEmail = async () => {
  const recipientEmail = 'teepakorn.sriaree@gmail.com'; // เปลี่ยนเป็นอีเมลของคุณ
  const subject = 'Test Email';
  const html = '<p>This is a test email</p>';

  try {
    const response = await sendEmail(recipientEmail, subject, html);
    console.log('Test email sent successfully:', response);
  } catch (error) {
    console.error('Failed to send test email:', error.message);
  }
};

testEmail();