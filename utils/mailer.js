const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const sendMail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: `"Complaint Portal" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error('❌ Email sending failed:', err.message);
    // Non-critical — don't throw, just log
  }
};

const statusUpdateEmail = (complaint, newStatus) => {
  const statusColors = {
    open: '#EF9F27',
    'in-progress': '#378ADD',
    resolved: '#639922',
    rejected: '#E24B4A',
  };
  const color = statusColors[newStatus] || '#888';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1D9E75; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Complaint Portal</h1>
      </div>
      <div style="padding: 24px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #333;">Your complaint status has been updated.</p>
        <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 8px; color: #555;"><strong>Complaint:</strong> ${complaint.title}</p>
          <p style="margin: 0 0 8px; color: #555;"><strong>Category:</strong> ${complaint.category}</p>
          <p style="margin: 0; color: #555;">
            <strong>New Status:</strong>
            <span style="background: ${color}; color: white; padding: 2px 10px; border-radius: 12px; font-size: 13px; margin-left: 6px;">${newStatus.toUpperCase()}</span>
          </p>
        </div>
        ${complaint.timeline.length > 0
          ? `<p style="color: #555;"><strong>Note:</strong> ${complaint.timeline[complaint.timeline.length - 1].note || 'No additional notes.'}</p>`
          : ''}
        <p style="color: #888; font-size: 13px; margin-top: 24px;">
          You can track your complaint at any time by logging into the Complaint Portal.
        </p>
      </div>
    </div>
  `;
};

module.exports = { sendMail, statusUpdateEmail };
