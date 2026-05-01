import { Redis } from '@upstash/redis';
import crypto from 'crypto';
const kv = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function sendEmail(to, magicLink) {
  // Use SendGrid API
  const apiKey = process.env.EMAIL_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@baseball-app.com';

  const emailContent = `
Click this link to sign in to your Baseball App:

${magicLink}

This link expires in 15 minutes. If you didn't request this link, you can safely ignore this email.
`;

  return fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: to }],
        },
      ],
      from: { email: fromAddress },
      subject: 'Sign in to Baseball App',
      content: [
        {
          type: 'text/plain',
          value: emailContent,
        },
      ],
    }),
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Generate magic link token
    const token = generateToken();
    const tokenKey = `email_token:${token}`;
    const tokenData = {
      email: email,
      createdAt: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
    };

    // Store token in Redis (15 min TTL)
    await kv.set(tokenKey, JSON.stringify(tokenData), { ex: 15 * 60 });

    // Generate magic link using request headers (like github.js)
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const appUrl = `${protocol}://${host}`;
    const magicLink = `${appUrl}/api/auth/email-verify?token=${token}`;

    // Send email
    const sendRes = await sendEmail(email, magicLink);

    if (!sendRes.ok) {
      console.error('SendGrid error:', sendRes.status, await sendRes.text());
      return res.status(500).json({ error: 'Failed to send email' });
    }

    res.status(200).json({ ok: true, message: 'Check your email for a sign-in link' });
  } catch (err) {
    console.error('Email request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
