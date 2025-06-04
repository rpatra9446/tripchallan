import nodemailer from 'nodemailer';

// Configure nodemailer with SMTP details from environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'alphabetsoftware.in',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE !== 'false', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'cbums@alphabetsoftware.in',
    pass: process.env.SMTP_PASS || 'w3u0btgYoY7x^Eba8',
  },
});

// Email template for session verification
export const sendVerificationEmail = async ({
  sessionId,
  sessionDetails,
  companyEmail,
  guardName,
  verificationDetails,
  sealDetails,
  timestamp
}: {
  sessionId: string;
  sessionDetails: any;
  companyEmail: string;
  guardName: string;
  verificationDetails: any;
  sealDetails: any;
  timestamp: string;
}) => {
  // Format verification results
  const formatVerificationResults = (verificationDetails: any) => {
    if (!verificationDetails || !verificationDetails.fieldVerifications) {
      return '<p>No verification details available</p>';
    }

    const fields = Object.entries(verificationDetails.fieldVerifications);
    
    return `
    <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
      <tr style="background-color: #f2f2f2;">
        <th>Field</th>
        <th>Operator Value</th>
        <th>Guard Value</th>
        <th>Status</th>
        <th>Comment</th>
      </tr>
      ${fields.map(([field, data]: [string, any]) => {
        const matches = data.matches === true;
        return `
          <tr style="background-color: ${matches ? '#e8f5e9' : '#ffebee'}">
            <td>${formatFieldName(field)}</td>
            <td>${data.operatorValue || 'N/A'}</td>
            <td>${data.guardValue || 'Not provided'}</td>
            <td style="color: ${matches ? 'green' : 'red'}">${matches ? '✅ Match' : '❌ Mismatch'}</td>
            <td>${data.comment || '-'}</td>
          </tr>
        `;
      }).join('')}
    </table>
    `;
  };

  // Format seal details
  const formatSealDetails = (sealDetails: any) => {
    if (!sealDetails) {
      return '<p>No seal details available</p>';
    }

    return `
    <div style="margin-bottom: 20px;">
      <h3>Seal Information</h3>
      <p><strong>Seal ID:</strong> ${sealDetails.barcode || 'N/A'}</p>
      <p><strong>Verified:</strong> ${sealDetails.verified ? 'Yes' : 'No'}</p>
      ${sealDetails.verified ? `<p><strong>Verified At:</strong> ${new Date(sealDetails.scannedAt || timestamp).toLocaleString()}</p>` : ''}
      ${sealDetails.verified ? `<p><strong>Verified By:</strong> ${sealDetails.verifiedBy?.name || guardName || 'Unknown'}</p>` : ''}
    </div>
    `;
  };

  // Format session details
  const formatSessionDetails = (sessionDetails: any) => {
    return `
    <div style="margin-bottom: 20px;">
      <h3>Session Details</h3>
      <p><strong>Source:</strong> ${sessionDetails.source || 'N/A'}</p>
      <p><strong>Destination:</strong> ${sessionDetails.destination || 'N/A'}</p>
      <p><strong>Status:</strong> ${sessionDetails.status || 'N/A'}</p>
      <p><strong>Created At:</strong> ${new Date(sessionDetails.createdAt).toLocaleString()}</p>
      ${sessionDetails.tripDetails?.vehicleNumber ? `<p><strong>Vehicle Number:</strong> ${sessionDetails.tripDetails.vehicleNumber}</p>` : ''}
      ${sessionDetails.tripDetails?.driverName ? `<p><strong>Driver Name:</strong> ${sessionDetails.tripDetails.driverName}</p>` : ''}
      ${sessionDetails.tripDetails?.materialName ? `<p><strong>Material:</strong> ${sessionDetails.tripDetails.materialName}</p>` : ''}
    </div>
    `;
  };

  // Format field names (convert from camelCase to Title Case)
  const formatFieldName = (field: string) => {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };

  // Create email HTML content
  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Session Verification Confirmation</title>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 800px; margin: 0 auto; padding: 20px; }
      .header { background-color: #1976d2; color: white; padding: 10px 20px; text-align: center; }
      .content { padding: 20px; border: 1px solid #ddd; }
      .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th { background-color: #f2f2f2; text-align: left; }
      td, th { padding: 8px; border: 1px solid #ddd; }
      .success { color: green; }
      .error { color: red; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Session Verification Confirmation</h1>
      </div>
      <div class="content">
        <p>This is to confirm that a session has been verified by a guard.</p>
        
        <h2>Verification Summary</h2>
        <p><strong>Session ID:</strong> ${sessionId}</p>
        <p><strong>Verified By:</strong> ${guardName}</p>
        <p><strong>Verification Time:</strong> ${new Date(timestamp).toLocaleString()}</p>
        
        ${formatSessionDetails(sessionDetails)}
        
        ${formatSealDetails(sealDetails)}
        
        <h3>Verification Details</h3>
        ${formatVerificationResults(verificationDetails)}
        
        <p style="margin-top: 20px;">
          <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://tripchallan-mu.vercel.app'}/dashboard/sessions/${sessionId}" style="background-color: #1976d2; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px;">
            View Session Details
          </a>
        </p>
      </div>
      <div class="footer">
        <p>This is an automated message. Please do not reply to this email.</p>
        <p>&copy; ${new Date().getFullYear()} CBUMS. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
  `;

  try {
    // Skip email sending if disabled in environment
    if (process.env.DISABLE_EMAIL_SENDING === 'true') {
      console.log('[EMAIL] Email sending is disabled by environment variable');
      return { success: true, messageId: 'email-disabled' };
    }
    
    // Send email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"CBUMS System" <cbums@alphabetsoftware.in>',
      to: companyEmail,
      subject: `Session Verification Confirmation - ${sessionId}`,
      html: htmlContent,
    });

    console.log('[EMAIL] Verification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL] Error sending verification email:', error);
    // Return success: false but don't throw an error to prevent API failure
    return { success: false, error };
  }
}; 