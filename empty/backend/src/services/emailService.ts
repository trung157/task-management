import nodemailer from 'nodemailer';
import config from '../config/config';
import { logger } from '../utils/logger';

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    if (!config.email) {
      logger.warn('Email configuration not found. Email features will be disabled.');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.password,
        },
      });

      logger.info('Email service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
    }
  }

  /**
   * Send email verification email
   */
  public async sendVerificationEmail(
    email: string,
    name: string,
    token: string
  ): Promise<void> {
    if (!this.transporter) {
      logger.warn('Email service not available. Skipping verification email.');
      return;
    }

    const verificationUrl = `${config.app.frontendUrl}/verify-email?token=${token}`;

    const mailOptions = {
      from: config.email!.from,
      to: email,
      subject: 'Verify Your Email - TaskFlow',
      html: this.getVerificationEmailTemplate(name, verificationUrl),
      text: `Hi ${name},\n\nPlease verify your email address by clicking the following link:\n${verificationUrl}\n\nIf you didn't create an account, please ignore this email.\n\nBest regards,\nTaskFlow Team`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Verification email sent successfully', { email });
    } catch (error) {
      logger.error('Failed to send verification email:', error);
      throw new Error('Failed to send verification email');
    }
  }

  /**
   * Send password reset email
   */
  public async sendPasswordResetEmail(
    email: string,
    name: string,
    token: string
  ): Promise<void> {
    if (!this.transporter) {
      logger.warn('Email service not available. Skipping password reset email.');
      return;
    }

    const resetUrl = `${config.app.frontendUrl}/reset-password?token=${token}`;

    const mailOptions = {
      from: config.email!.from,
      to: email,
      subject: 'Reset Your Password - TaskFlow',
      html: this.getPasswordResetEmailTemplate(name, resetUrl),
      text: `Hi ${name},\n\nYou requested a password reset. Click the following link to reset your password:\n${resetUrl}\n\nIf you didn't request this, please ignore this email.\n\nThis link will expire in 1 hour.\n\nBest regards,\nTaskFlow Team`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Password reset email sent successfully', { email });
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Send welcome email
   */
  public async sendWelcomeEmail(email: string, name: string): Promise<void> {
    if (!this.transporter) {
      logger.warn('Email service not available. Skipping welcome email.');
      return;
    }

    const mailOptions = {
      from: config.email!.from,
      to: email,
      subject: 'Welcome to TaskFlow!',
      html: this.getWelcomeEmailTemplate(name),
      text: `Hi ${name},\n\nWelcome to TaskFlow! We're excited to have you on board.\n\nStart managing your tasks efficiently with our powerful features.\n\nBest regards,\nTaskFlow Team`,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Welcome email sent successfully', { email });
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      // Don't throw error for welcome email failure
    }
  }

  /**
   * Send generic notification email
   */
  public async sendGenericEmail(
    email: string,
    name: string,
    subject: string,
    htmlContent: string,
    type: string
  ): Promise<void> {
    if (!this.transporter) {
      logger.warn('Email service not available. Skipping generic email.');
      return;
    }

    const mailOptions = {
      from: config.email!.from,
      to: email,
      subject: subject,
      html: htmlContent,
      text: this.stripHtml(htmlContent),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info('Generic email sent successfully', { email, type });
    } catch (error) {
      logger.error('Failed to send generic email:', error);
      throw new Error('Failed to send notification email');
    }
  }

  /**
   * Strip HTML tags for text version
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  /**
   * Email verification template
   */
  private getVerificationEmailTemplate(name: string, verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify Your Email</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>TaskFlow</h1>
          </div>
          <h2>Verify Your Email Address</h2>
          <p>Hi ${name},</p>
          <p>Thank you for signing up for TaskFlow! Please verify your email address by clicking the button below:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" class="button">Verify Email</a>
          </p>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">${verificationUrl}</p>
          <p>If you didn't create an account with TaskFlow, please ignore this email.</p>
          <div class="footer">
            <p>Best regards,<br>The TaskFlow Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Password reset email template
   */
  private getPasswordResetEmailTemplate(name: string, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Your Password</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
          .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>TaskFlow</h1>
          </div>
          <h2>Reset Your Password</h2>
          <p>Hi ${name},</p>
          <p>You requested a password reset for your TaskFlow account. Click the button below to reset your password:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </p>
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">${resetUrl}</p>
          <div class="warning">
            <strong>Important:</strong> This link will expire in 1 hour for security reasons.
          </div>
          <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
          <div class="footer">
            <p>Best regards,<br>The TaskFlow Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Welcome email template
   */
  private getWelcomeEmailTemplate(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to TaskFlow</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
          .features { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>TaskFlow</h1>
          </div>
          <h2>Welcome to TaskFlow!</h2>
          <p>Hi ${name},</p>
          <p>Welcome to TaskFlow! We're excited to have you on board. TaskFlow is designed to help you manage your tasks efficiently and boost your productivity.</p>
          <div class="features">
            <h3>Get Started:</h3>
            <ul>
              <li>Create and organize your tasks</li>
              <li>Set priorities and due dates</li>
              <li>Track your progress</li>
              <li>Collaborate with team members</li>
              <li>Use tags to categorize tasks</li>
            </ul>
          </div>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${config.app.frontendUrl}" class="button">Get Started</a>
          </p>
          <p>If you have any questions or need help, don't hesitate to reach out to our support team.</p>
          <div class="footer">
            <p>Best regards,<br>The TaskFlow Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
