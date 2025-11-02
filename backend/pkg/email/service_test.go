package email

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewEmailService_Resend(t *testing.T) {
	config := Config{
		Provider:     ProviderResend,
		FromEmail:    "test@example.com",
		FromName:     "Test App",
		ResendAPIKey: "re_test_key",
	}

	service, err := NewEmailService(config)
	require.NoError(t, err)
	require.NotNil(t, service)
	assert.NotNil(t, service.resendClient)
	assert.Nil(t, service.smtpDialer)
}

func TestNewEmailService_MailHog(t *testing.T) {
	config := Config{
		Provider:  ProviderMailHog,
		FromEmail: "test@example.com",
		FromName:  "Test App",
		SMTPHost:  "localhost",
		SMTPPort:  1025,
	}

	service, err := NewEmailService(config)
	require.NoError(t, err)
	require.NotNil(t, service)
	assert.Nil(t, service.resendClient)
	assert.NotNil(t, service.smtpDialer)
	assert.Equal(t, "localhost", service.smtpDialer.Host)
	assert.Equal(t, 1025, service.smtpDialer.Port)
}

func TestNewEmailService_SMTP(t *testing.T) {
	config := Config{
		Provider:     ProviderSMTP,
		FromEmail:    "test@example.com",
		FromName:     "Test App",
		SMTPHost:     "smtp.example.com",
		SMTPPort:     587,
		SMTPUsername: "user",
		SMTPPassword: "pass",
		SMTPUseTLS:   true,
	}

	service, err := NewEmailService(config)
	require.NoError(t, err)
	require.NotNil(t, service)
	assert.NotNil(t, service.smtpDialer)
	assert.Equal(t, "smtp.example.com", service.smtpDialer.Host)
	assert.Equal(t, 587, service.smtpDialer.Port)
	assert.Equal(t, "user", service.smtpDialer.Username)
	assert.Equal(t, "pass", service.smtpDialer.Password)
}

func TestNewEmailService_MissingResendAPIKey(t *testing.T) {
	config := Config{
		Provider:  ProviderResend,
		FromEmail: "test@example.com",
		// ResendAPIKey is missing
	}

	service, err := NewEmailService(config)
	require.Error(t, err)
	assert.Nil(t, service)
	assert.Contains(t, err.Error(), "resend API key is required")
}

func TestNewEmailService_MissingSMTPHost(t *testing.T) {
	config := Config{
		Provider:  ProviderMailHog,
		FromEmail: "test@example.com",
		// SMTPHost is missing
	}

	service, err := NewEmailService(config)
	require.Error(t, err)
	assert.Nil(t, service)
	assert.Contains(t, err.Error(), "SMTP host is required")
}

func TestNewEmailService_UnsupportedProvider(t *testing.T) {
	config := Config{
		Provider:  EmailProvider("unsupported"),
		FromEmail: "test@example.com",
	}

	service, err := NewEmailService(config)
	require.Error(t, err)
	assert.Nil(t, service)
	assert.Contains(t, err.Error(), "unsupported email provider")
}

func TestNewEmailService_DefaultSMTPPort(t *testing.T) {
	config := Config{
		Provider:  ProviderMailHog,
		FromEmail: "test@example.com",
		SMTPHost:  "localhost",
		// SMTPPort is 0 (should default to 1025 for MailHog)
	}

	service, err := NewEmailService(config)
	require.NoError(t, err)
	assert.Equal(t, 1025, service.smtpDialer.Port)
}

func TestEmailService_RenderPasswordResetTemplate(t *testing.T) {
	service := &EmailService{
		config: Config{
			FromEmail: "test@example.com",
			FromName:  "Test App",
		},
	}

	resetURL := "https://example.com/reset?token=abc123"
	html := service.renderPasswordResetTemplate(resetURL)

	// Verify template contains key elements
	assert.Contains(t, html, "Reset Your Password")
	assert.Contains(t, html, resetURL)
	assert.Contains(t, html, "This link expires in 1 hour")
	assert.Contains(t, html, "ActionPhase")
}

func TestEmailService_RenderEmailVerificationTemplate(t *testing.T) {
	service := &EmailService{
		config: Config{
			FromEmail: "test@example.com",
			FromName:  "Test App",
		},
	}

	verifyURL := "https://example.com/verify?token=xyz789"
	html := service.renderEmailVerificationTemplate(verifyURL)

	assert.Contains(t, html, "Verify Your Email Address")
	assert.Contains(t, html, verifyURL)
	assert.Contains(t, html, "This link expires in 1 hour")
	assert.Contains(t, html, "Create and join games")
}

func TestEmailService_RenderPasswordChangedTemplate(t *testing.T) {
	service := &EmailService{
		config: Config{
			FromEmail: "test@example.com",
			FromName:  "Test App",
		},
	}

	html := service.renderPasswordChangedTemplate()

	assert.Contains(t, html, "Your Password Has Been Changed")
	assert.Contains(t, html, "successfully changed")
	assert.Contains(t, html, "contact our support team immediately")
}

func TestEmailService_RenderEmailChangedTemplate(t *testing.T) {
	service := &EmailService{
		config: Config{
			FromEmail: "test@example.com",
			FromName:  "Test App",
		},
	}

	newEmail := "newemail@example.com"
	html := service.renderEmailChangedTemplate(newEmail)

	assert.Contains(t, html, "Your Email Address Has Been Changed")
	assert.Contains(t, html, newEmail)
	assert.Contains(t, html, "contact our support team immediately")
}

func TestEmailService_RenderAccountDeletionTemplate(t *testing.T) {
	service := &EmailService{
		config: Config{
			FromEmail: "test@example.com",
			FromName:  "Test App",
		},
	}

	scheduledDate := "January 15, 2025"
	html := service.renderAccountDeletionTemplate(scheduledDate)

	assert.Contains(t, html, "Account Deletion Scheduled")
	assert.Contains(t, html, scheduledDate)
	assert.Contains(t, html, "cancel this deletion")
	assert.Contains(t, html, "permanently deleted")
}

// TestEmailService_TemplateConsistency verifies all templates use the base template
func TestEmailService_TemplateConsistency(t *testing.T) {
	service := &EmailService{}

	templates := []string{
		service.renderPasswordResetTemplate("http://test.com"),
		service.renderEmailVerificationTemplate("http://test.com"),
		service.renderPasswordChangedTemplate(),
		service.renderEmailChangedTemplate("new@test.com"),
		service.renderAccountDeletionTemplate("January 1, 2025"),
	}

	for i, template := range templates {
		t.Run(string(rune('A'+i)), func(t *testing.T) {
			// All templates should include base template elements
			assert.Contains(t, template, "<!DOCTYPE html>")
			assert.Contains(t, template, "ActionPhase")
			assert.Contains(t, template, "2025 ActionPhase")
			assert.Contains(t, template, "font-family:")
		})
	}
}

func TestNewEmailServiceFromEnv(t *testing.T) {
	// Test with default environment (no env vars set)
	// Should default to MailHog
	service, err := NewEmailServiceFromEnv()
	require.NoError(t, err)
	require.NotNil(t, service)
	assert.Equal(t, ProviderMailHog, service.config.Provider)
	assert.Equal(t, "noreply@actionphase.com", service.config.FromEmail)
	assert.Equal(t, "ActionPhase", service.config.FromName)
	assert.Equal(t, "localhost", service.config.SMTPHost)

	// Note: Testing with actual env vars would require setting/unsetting them,
	// which can interfere with other tests. In production, use dependency injection
	// to pass config directly rather than relying on env vars in tests.
}

// Note: Integration tests for actual email sending would require a running

// Note: Integration tests for actual email sending would require a running
// SMTP server (like MailHog) and are better suited for integration test suite.
