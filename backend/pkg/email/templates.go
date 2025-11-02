package email

import "fmt"

// Base HTML template for all emails
const baseTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .container {
            background-color: #ffffff;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 40px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            color: #4F46E5;
            margin-bottom: 10px;
        }
        .content {
            margin-bottom: 30px;
        }
        .button {
            display: inline-block;
            background-color: #4F46E5;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 6px;
            font-weight: 500;
            margin: 20px 0;
        }
        .button:hover {
            background-color: #4338CA;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            color: #666;
            font-size: 14px;
        }
        .warning {
            background-color: #FEF2F2;
            border-left: 4px solid #EF4444;
            padding: 15px;
            margin: 20px 0;
        }
        .info {
            background-color: #EFF6FF;
            border-left: 4px solid #3B82F6;
            padding: 15px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">ActionPhase</div>
        </div>
        <div class="content">
            %s
        </div>
        <div class="footer">
            <p>This email was sent from ActionPhase. If you didn't request this, please ignore this email.</p>
            <p>&copy; 2025 ActionPhase. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`

// renderPasswordResetTemplate renders the password reset email template
func (s *EmailService) renderPasswordResetTemplate(resetURL string) string {
	content := fmt.Sprintf(`
        <h2>Reset Your Password</h2>
        <p>We received a request to reset your password. Click the button below to choose a new password:</p>
        <p style="text-align: center;">
            <a href="%s" class="button">Reset Password</a>
        </p>
        <div class="info">
            <strong>This link expires in 1 hour.</strong>
        </div>
        <p>If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.</p>
        <p style="color: #666; font-size: 14px;">Or copy and paste this URL into your browser: <br>%s</p>
    `, resetURL, resetURL)

	return fmt.Sprintf(baseTemplate, content)
}

// renderEmailVerificationTemplate renders the email verification template
func (s *EmailService) renderEmailVerificationTemplate(verifyURL string) string {
	content := fmt.Sprintf(`
        <h2>Verify Your Email Address</h2>
        <p>Welcome to ActionPhase! To get started, please verify your email address by clicking the button below:</p>
        <p style="text-align: center;">
            <a href="%s" class="button">Verify Email Address</a>
        </p>
        <div class="info">
            <strong>This link expires in 1 hour.</strong>
        </div>
        <p>Once verified, you'll be able to:</p>
        <ul>
            <li>Create and join games</li>
            <li>Create characters</li>
            <li>Post messages and interact with other players</li>
        </ul>
        <p style="color: #666; font-size: 14px;">Or copy and paste this URL into your browser: <br>%s</p>
    `, verifyURL, verifyURL)

	return fmt.Sprintf(baseTemplate, content)
}

// renderPasswordChangedTemplate renders the password changed notification template
func (s *EmailService) renderPasswordChangedTemplate() string {
	content := `
        <h2>Your Password Has Been Changed</h2>
        <p>This email confirms that your ActionPhase password was successfully changed.</p>
        <div class="warning">
            <strong>Didn't change your password?</strong><br>
            If you did not make this change, your account may have been compromised. Please contact our support team immediately.
        </div>
        <p>If you changed your password, you can safely ignore this email.</p>
    `

	return fmt.Sprintf(baseTemplate, content)
}

// renderEmailChangedTemplate renders the email changed notification template
func (s *EmailService) renderEmailChangedTemplate(newEmail string) string {
	content := fmt.Sprintf(`
        <h2>Your Email Address Has Been Changed</h2>
        <p>This email confirms that your ActionPhase email address was changed to:</p>
        <p style="background-color: #F3F4F6; padding: 15px; border-radius: 6px; font-family: monospace;">
            %s
        </p>
        <div class="warning">
            <strong>Didn't change your email?</strong><br>
            If you did not make this change, your account may have been compromised. Please contact our support team immediately.
        </div>
        <p>If you changed your email address, you can safely ignore this email.</p>
    `, newEmail)

	return fmt.Sprintf(baseTemplate, content)
}

// renderAccountDeletionTemplate renders the account deletion scheduled template
func (s *EmailService) renderAccountDeletionTemplate(scheduledDate string) string {
	content := fmt.Sprintf(`
        <h2>Account Deletion Scheduled</h2>
        <p>Your ActionPhase account has been scheduled for deletion on:</p>
        <p style="background-color: #FEF2F2; padding: 15px; border-radius: 6px; text-align: center; font-size: 18px; font-weight: 600; color: #EF4444;">
            %s
        </p>
        <div class="info">
            <strong>Changed your mind?</strong><br>
            You can cancel this deletion at any time before the scheduled date by logging into your account and going to Settings → Danger Zone.
        </div>
        <p>After the scheduled date, your account and all associated data will be permanently deleted and cannot be recovered.</p>
        <p><strong>What will be deleted:</strong></p>
        <ul>
            <li>Your user profile and account information</li>
            <li>All characters you've created</li>
            <li>All messages and posts</li>
            <li>Games you've created (GM)</li>
        </ul>
    `, scheduledDate)

	return fmt.Sprintf(baseTemplate, content)
}
