import nodemailer from 'nodemailer';

// Create transporter
let transporter = null;

export function initEmailService() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_USER || !SMTP_PASS) {
    console.log('Email service disabled - SMTP credentials not configured');
    return false;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(SMTP_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  // Verify connection
  transporter.verify((error, success) => {
    if (error) {
      console.error('Email service error:', error.message);
    } else {
      console.log('Email service ready');
    }
  });

  return true;
}

export async function sendEmail({ to, subject, text, html }) {
  if (!transporter) {
    console.log('Email not sent - service not configured');
    return false;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  try {
    const info = await transporter.sendMail({
      from: `"RidersOS" <${from}>`,
      to,
      subject,
      text,
      html,
    });
    console.log('Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error.message);
    return false;
  }
}

// Email templates
export const emailTemplates = {
  connectionRequest: (fromName, toName, message) => ({
    subject: `${fromName} wants to connect with you on RidersOS`,
    text: `Hi ${toName},\n\n${fromName} has sent you a connection request on RidersOS.\n\n${message ? `Message: "${message}"\n\n` : ''}Log in to RidersOS to accept or decline this request.\n\nBest regards,\nThe RidersOS Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1B4332; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">RidersOS</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #1B4332;">New Connection Request</h2>
          <p>Hi ${toName},</p>
          <p><strong>${fromName}</strong> has sent you a connection request on RidersOS.</p>
          ${message ? `<p style="background: white; padding: 15px; border-left: 4px solid #1B4332; margin: 20px 0;"><em>"${message}"</em></p>` : ''}
          <p>Log in to RidersOS to accept or decline this request.</p>
          <a href="${process.env.FRONTEND_URL}/Dashboard" style="display: inline-block; background: #1B4332; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">View Request</a>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>Best regards,<br>The RidersOS Team</p>
        </div>
      </div>
    `,
  }),

  sessionScheduled: (riderName, trainerName, sessionDate, sessionType) => ({
    subject: `Training session scheduled - ${sessionDate}`,
    text: `Hi ${riderName},\n\n${trainerName} has scheduled a ${sessionType} session with you on ${sessionDate}.\n\nLog in to RidersOS to view the details.\n\nBest regards,\nThe RidersOS Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1B4332; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">RidersOS</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #1B4332;">Session Scheduled</h2>
          <p>Hi ${riderName},</p>
          <p><strong>${trainerName}</strong> has scheduled a training session with you:</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Type:</strong> ${sessionType}</p>
            <p><strong>Date:</strong> ${sessionDate}</p>
          </div>
          <a href="${process.env.FRONTEND_URL}/RiderProfile" style="display: inline-block; background: #1B4332; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">View Session</a>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>Best regards,<br>The RidersOS Team</p>
        </div>
      </div>
    `,
  }),

  sessionUpdated: (riderName, trainerName, sessionDate, changes) => ({
    subject: `Training session updated - ${sessionDate}`,
    text: `Hi ${riderName},\n\n${trainerName} has updated your training session on ${sessionDate}.\n\n${changes}\n\nLog in to RidersOS to view the details.\n\nBest regards,\nThe RidersOS Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1B4332; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">RidersOS</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #1B4332;">Session Updated</h2>
          <p>Hi ${riderName},</p>
          <p><strong>${trainerName}</strong> has updated your training session on <strong>${sessionDate}</strong>.</p>
          <p>${changes}</p>
          <a href="${process.env.FRONTEND_URL}/RiderProfile" style="display: inline-block; background: #1B4332; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">View Session</a>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>Best regards,<br>The RidersOS Team</p>
        </div>
      </div>
    `,
  }),

  sessionCancelled: (riderName, trainerName, sessionDate) => ({
    subject: `Training session cancelled - ${sessionDate}`,
    text: `Hi ${riderName},\n\nYour training session with ${trainerName} on ${sessionDate} has been cancelled.\n\nPlease contact your trainer if you have any questions.\n\nBest regards,\nThe RidersOS Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1B4332; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">RidersOS</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #dc2626;">Session Cancelled</h2>
          <p>Hi ${riderName},</p>
          <p>Your training session with <strong>${trainerName}</strong> on <strong>${sessionDate}</strong> has been cancelled.</p>
          <p>Please contact your trainer if you have any questions.</p>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>Best regards,<br>The RidersOS Team</p>
        </div>
      </div>
    `,
  }),

  paymentRequest: (riderName, trainerName, amount, currency, month) => ({
    subject: `Payment request from ${trainerName} - ${month}`,
    text: `Hi ${riderName},\n\n${trainerName} has requested payment for ${month}.\n\nAmount: ${currency} ${amount}\n\nLog in to RidersOS to view the details and make payment arrangements.\n\nBest regards,\nThe RidersOS Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1B4332; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">RidersOS</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #1B4332;">Payment Request</h2>
          <p>Hi ${riderName},</p>
          <p><strong>${trainerName}</strong> has requested payment for <strong>${month}</strong>.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="font-size: 24px; font-weight: bold; color: #1B4332; margin: 0;">${currency} ${amount}</p>
          </div>
          <a href="${process.env.FRONTEND_URL}/RiderProfile" style="display: inline-block; background: #1B4332; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">View Details</a>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>Best regards,<br>The RidersOS Team</p>
        </div>
      </div>
    `,
  }),

  horseCareReminder: (ownerName, horseName, eventType, dueDate) => ({
    subject: `Reminder: ${eventType} due for ${horseName}`,
    text: `Hi ${ownerName},\n\nThis is a reminder that ${horseName} has a ${eventType} appointment due on ${dueDate}.\n\nLog in to RidersOS to view and manage your horse's care schedule.\n\nBest regards,\nThe RidersOS Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1B4332; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">RidersOS</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #1B4332;">Horse Care Reminder</h2>
          <p>Hi ${ownerName},</p>
          <p>This is a reminder that <strong>${horseName}</strong> has a care appointment coming up:</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Type:</strong> ${eventType}</p>
            <p><strong>Due Date:</strong> ${dueDate}</p>
          </div>
          <a href="${process.env.FRONTEND_URL}/MyHorses" style="display: inline-block; background: #1B4332; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">View Schedule</a>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>Best regards,<br>The RidersOS Team</p>
        </div>
      </div>
    `,
  }),

  guardianInvite: (guardianName, minorName, minorEmail) => ({
    subject: `${guardianName} has added you as a minor on RidersOS`,
    text: `Hi ${minorName},\n\n${guardianName} has set up a guardian relationship with you on RidersOS.\n\nThis means ${guardianName} can view your training sessions and horse activities.\n\nLog in to RidersOS to view your profile.\n\nBest regards,\nThe RidersOS Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1B4332; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">RidersOS</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #1B4332;">Guardian Relationship Created</h2>
          <p>Hi ${minorName},</p>
          <p><strong>${guardianName}</strong> has set up a guardian relationship with you on RidersOS.</p>
          <p>This means ${guardianName} can view your training sessions and horse activities.</p>
          <a href="${process.env.FRONTEND_URL}/Dashboard" style="display: inline-block; background: #1B4332; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">Go to Dashboard</a>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>Best regards,<br>The RidersOS Team</p>
        </div>
      </div>
    `,
  }),

  trainerInvite: (trainerName, riderEmail) => ({
    subject: `${trainerName} wants to connect with you on RidersOS`,
    text: `Hi,\n\n${trainerName} wants to add you as a rider on RidersOS.\n\nRidersOS is a platform for managing horse riding training, scheduling sessions, and tracking progress.\n\nIf you don't have an account yet, sign up at ${process.env.FRONTEND_URL} and then accept the connection request.\n\nBest regards,\nThe RidersOS Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1B4332; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">RidersOS</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #1B4332;">You've Been Invited!</h2>
          <p>Hi,</p>
          <p><strong>${trainerName}</strong> wants to add you as a rider on RidersOS.</p>
          <p>RidersOS is a platform for managing horse riding training, scheduling sessions, and tracking progress.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>What you can do on RidersOS:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>View your training schedule</li>
              <li>Track your riding progress</li>
              <li>Manage your horses</li>
              <li>Communicate with your trainer</li>
            </ul>
          </div>
          <a href="${process.env.FRONTEND_URL}" style="display: inline-block; background: #1B4332; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">Sign Up / Log In</a>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>Best regards,<br>The RidersOS Team</p>
        </div>
      </div>
    `,
  }),

  stableTrainerInvite: (stableName, trainerEmail) => ({
    subject: `${stableName} wants to add you as a trainer`,
    text: `Hi,\n\n${stableName} would like to add you as a trainer on RidersOS.\n\nLog in to RidersOS to accept or decline this request.\n\nBest regards,\nThe RidersOS Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1B4332; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">RidersOS</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #1B4332;">Trainer Invitation</h2>
          <p>Hi,</p>
          <p><strong>${stableName}</strong> would like to add you as a trainer on RidersOS.</p>
          <p>Log in to RidersOS to accept or decline this request.</p>
          <a href="${process.env.FRONTEND_URL}/Dashboard" style="display: inline-block; background: #1B4332; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px;">View Request</a>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>Best regards,<br>The RidersOS Team</p>
        </div>
      </div>
    `,
  }),
};
