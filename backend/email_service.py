import asyncio
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_SMTP_HOST = "smtp.gmail.com"
_SMTP_PORT = 587


def _send_smtp(to_email: str, subject: str, html_body: str) -> None:
    """Synchronous SMTP send — called via asyncio.to_thread so it doesn't block FastAPI."""
    username = os.getenv("MAIL_USERNAME", "")
    password = os.getenv("MAIL_PASSWORD", "")

    if not username or not password:
        raise RuntimeError(
            "Email credentials not configured. "
            "Set MAIL_USERNAME and MAIL_PASSWORD in backend/.env"
        )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = username
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(username, password)
        server.sendmail(username, to_email, msg.as_string())


async def send_reset_email(to_email: str, reset_link: str) -> None:
    """Send a password-reset email to the user."""
    subject = "TelloLearn — Password Reset Request"
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:40px;margin:0;">
      <div style="max-width:480px;margin:auto;background:#1e293b;padding:32px;
                  border-radius:12px;border:1px solid #334155;">

        <h2 style="color:#3b82f6;margin:0 0 4px;">🚁 TelloLearn</h2>
        <h3 style="color:#f1f5f9;margin:0 0 20px;font-weight:600;">Password Reset Request</h3>

        <p style="color:#94a3b8;line-height:1.6;margin:0 0 24px;">
          We received a request to reset the password for your TelloLearn account.<br>
          Click the button below to set a new password.
        </p>

        <a href="{reset_link}"
           style="display:inline-block;background:#3b82f6;color:#ffffff;
                  padding:13px 28px;border-radius:8px;text-decoration:none;
                  font-weight:bold;font-size:15px;letter-spacing:0.3px;">
          Reset My Password
        </a>

        <p style="color:#64748b;font-size:13px;margin:28px 0 0;line-height:1.6;">
          This link expires in <strong style="color:#94a3b8;">1 hour</strong>.<br>
          If you did not request a password reset, you can safely ignore this email —
          your password will not change.
        </p>

        <hr style="border:none;border-top:1px solid #334155;margin:28px 0 20px;">
        <p style="color:#475569;font-size:12px;margin:0;">
          TelloLearn &middot; Drone Learning Platform
        </p>
      </div>
    </body>
    </html>
    """

    logger.info(f"[EMAIL] Sending password reset email to {to_email}")
    await asyncio.to_thread(_send_smtp, to_email, subject, html_body)
    logger.info(f"[EMAIL] Password reset email delivered to {to_email}")
