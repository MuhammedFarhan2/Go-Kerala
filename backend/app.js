const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT) || 3000;
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || '').trim();
const APPLE_CLIENT_ID = String(process.env.APPLE_CLIENT_ID || '').trim();
const GMAIL_USER = String(process.env.GMAIL_USER || '').trim();
const GMAIL_APP_PASSWORD = String(process.env.GMAIL_APP_PASSWORD || '').trim();
const OTP_FROM_EMAIL = String(process.env.OTP_FROM_EMAIL || GMAIL_USER || '').trim();
const TWILIO_ACCOUNT_SID = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
const TWILIO_AUTH_TOKEN = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
const TWILIO_FROM_NUMBER = String(process.env.TWILIO_FROM_NUMBER || '').trim();
const TWILIO_WHATSAPP_FROM_NUMBER = String(process.env.TWILIO_WHATSAPP_FROM_NUMBER || process.env.TWILIO_WHATSAPP_FROM || '').trim();
const PROJECT_ROOT = path.join(__dirname, '..');
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');
const UPLOADS_DIR = path.join(FRONTEND_DIR, 'uploads');
const PERSISTENT_ROOT = String(
  process.env.VECT_DATA_DIR ||
  process.env.DATA_DIR ||
  process.env.RENDER_DISK_ROOT ||
  ''
).trim();
const DATA_DIR = PERSISTENT_ROOT
  ? path.resolve(PERSISTENT_ROOT, 'vect-data')
  : path.join(__dirname, 'data');
const VECT_OWN_DB_PATH = path.join(DATA_DIR, 'vect-own-submissions.json');
const VECT_OWN_SESSION_COOKIE = 'vect_own_session';
const VECT_OWN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const VECT_OWN_PASSWORD = String(process.env.VECT_OWN_PASSWORD || 'vectown1234').trim();
const VECT_OWN_GOOGLE_EMAIL = String(process.env.VECT_OWN_GOOGLE_EMAIL || 'vectmovers@gmail.com').trim().toLowerCase();
const VECT_OWN_SESSION_HEADER = 'x-vect-own-session';
const VECT_OWN_SELECTION_WHATSAPP_MESSAGE = String(
  process.env.VECT_OWN_SELECTION_WHATSAPP_MESSAGE ||
  'Congratulation you have selected as a member of VECT Movers. For continue fffffff'
).trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (error) {
  console.error('Data directory creation error:', error);
}

let googleOAuthClient = null;
let appleKeysCache = null;
let mailTransporter = null;
const profilePhotoSessions = new Map();
const otpSessions = new Map();
const vectOwnSessions = new Map();
let vectOwnSubmissions = null;
const PROFILE_PHOTO_SESSION_TTL_MS = 30 * 60 * 1000;
const APPLE_KEYS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const OTP_TTL_MS = 5 * 60 * 1000;
const VECT_OWN_STATUSES = new Set(['pending', 'accepted', 'rejected', 'updated']);

function getGoogleOAuthClient() {
  if (!GOOGLE_CLIENT_ID) {
    return null;
  }

  if (googleOAuthClient) {
    return googleOAuthClient;
  }

  try {
    const { OAuth2Client } = require('google-auth-library');
    googleOAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID);
    return googleOAuthClient;
  } catch (error) {
    return null;
  }
}

function getMailTransporter() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return null;
  }

  if (mailTransporter) {
    return mailTransporter;
  }

  try {
    const nodemailer = require('nodemailer');
    mailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD
      }
    });
    return mailTransporter;
  } catch (error) {
    return null;
  }
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function normalizePhoneNumber(value) {
  const trimmed = String(value || '').trim();

  if (!trimmed) {
    return '';
  }

  const hasPlusPrefix = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (!digitsOnly) {
    return '';
  }

  if (!hasPlusPrefix && digitsOnly.length === 10) {
    return '+91' + digitsOnly;
  }

  return (hasPlusPrefix ? '+' : '') + digitsOnly;
}

function isPhoneNumber(value) {
  const normalized = normalizePhoneNumber(value);
  return /^\+?[1-9]\d{9,14}$/.test(normalized);
}

function parseContact(rawValue) {
  const raw = String(rawValue || '').trim();

  if (!raw) {
    return { type: 'unknown', normalized: '' };
  }

  if (isEmail(raw)) {
    return {
      type: 'email',
      normalized: raw.toLowerCase()
    };
  }

  if (isPhoneNumber(raw)) {
    return {
      type: 'phone',
      normalized: normalizePhoneNumber(raw)
    };
  }

  return { type: 'unknown', normalized: raw };
}

function normalizeContact(value) {
  const parsed = parseContact(value);
  return parsed.normalized;
}

function cleanupOtpSessions() {
  const now = Date.now();
  otpSessions.forEach(function (session, key) {
    if (!session || !session.expiresAt || now > session.expiresAt) {
      otpSessions.delete(key);
    }
  });
}

function generateOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function sendOtpEmail(contact, otpCode) {
  const transporter = getMailTransporter();

  if (!transporter || !OTP_FROM_EMAIL) {
    throw new Error('Email OTP is not configured on the server.');
  }

  await transporter.sendMail({
    from: OTP_FROM_EMAIL,
    to: contact,
    subject: 'VECT MOVERS verification code',
    text: 'Your VECT MOVERS verification code is ' + otpCode + '. It expires in 5 minutes.'
  });
}

async function sendOtpSms(contact, otpCode) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    throw new Error('SMS OTP is not configured on the server.');
  }

  const authHeader = Buffer.from(TWILIO_ACCOUNT_SID + ':' + TWILIO_AUTH_TOKEN).toString('base64');
  const body = new URLSearchParams({
    To: contact,
    From: TWILIO_FROM_NUMBER,
    Body: 'Your VECT MOVERS verification code is ' + otpCode + '. It expires in 5 minutes.'
  });
  const twilioResponse = await fetch(
    'https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(TWILIO_ACCOUNT_SID) + '/Messages.json',
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    }
  );

  if (!twilioResponse.ok) {
    let errorMessage = 'Unable to send SMS OTP.';

    try {
      const responseData = await twilioResponse.json();
      if (responseData && responseData.message) {
        errorMessage = String(responseData.message);
      }
    } catch (error) {
      try {
        const responseText = await twilioResponse.text();
        if (responseText) {
          errorMessage = responseText;
        }
      } catch (nestedError) {
        // Keep default error message.
      }
    }

    throw new Error(errorMessage);
  }
}

function formatWhatsappAddress(value) {
  const normalized = normalizePhoneNumber(value);

  if (!normalized) {
    return '';
  }

  return 'whatsapp:' + normalized;
}

async function sendWhatsAppMessage(contact, messageText) {
  const whatsappFrom = String(TWILIO_WHATSAPP_FROM_NUMBER || '').trim();
  const toAddress = formatWhatsappAddress(contact);
  const fromAddress = /^whatsapp:/i.test(whatsappFrom) ? whatsappFrom : formatWhatsappAddress(whatsappFrom);

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !fromAddress) {
    throw new Error('WhatsApp messaging is not configured on the server.');
  }

  if (!toAddress) {
    throw new Error('A valid WhatsApp number is required.');
  }

  const authHeader = Buffer.from(TWILIO_ACCOUNT_SID + ':' + TWILIO_AUTH_TOKEN).toString('base64');
  const body = new URLSearchParams({
    To: toAddress,
    From: fromAddress,
    Body: String(messageText || '').trim()
  });

  const twilioResponse = await fetch(
    'https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(TWILIO_ACCOUNT_SID) + '/Messages.json',
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    }
  );

  if (!twilioResponse.ok) {
    let errorMessage = 'Unable to send WhatsApp message.';

    try {
      const responseData = await twilioResponse.json();
      if (responseData && responseData.message) {
        errorMessage = String(responseData.message);
      }
    } catch (error) {
      try {
        const responseText = await twilioResponse.text();
        if (responseText) {
          errorMessage = responseText;
        }
      } catch (nestedError) {
        // Keep default error message.
      }
    }

    throw new Error(errorMessage);
  }
}

function decodeBase64Url(input) {
  const normalized = String(input || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64');
}

function parseJwt(token) {
  const tokenParts = String(token || '').split('.');

  if (tokenParts.length !== 3) {
    throw new Error('Invalid token format.');
  }

  return {
    header: JSON.parse(decodeBase64Url(tokenParts[0]).toString('utf8')),
    payload: JSON.parse(decodeBase64Url(tokenParts[1]).toString('utf8')),
    signingInput: tokenParts[0] + '.' + tokenParts[1],
    signature: decodeBase64Url(tokenParts[2])
  };
}

async function getAppleSigningKeys() {
  const now = Date.now();

  if (appleKeysCache && now - appleKeysCache.fetchedAt < APPLE_KEYS_CACHE_TTL_MS) {
    return appleKeysCache.keys;
  }

  const appleResponse = await fetch('https://appleid.apple.com/auth/keys');

  if (!appleResponse.ok) {
    throw new Error('Unable to download Apple signing keys.');
  }

  const appleData = await appleResponse.json();
  const keys = Array.isArray(appleData && appleData.keys) ? appleData.keys : [];

  if (!keys.length) {
    throw new Error('Apple signing keys are missing.');
  }

  appleKeysCache = {
    fetchedAt: now,
    keys: keys
  };

  return keys;
}

async function verifyAppleIdentityToken(identityToken) {
  if (!APPLE_CLIENT_ID) {
    throw new Error('Apple sign-in is not configured on the server.');
  }

  const parsedToken = parseJwt(identityToken);
  const header = parsedToken.header || {};
  const payload = parsedToken.payload || {};

  if (header.alg !== 'ES256' || !header.kid) {
    throw new Error('Unsupported Apple token header.');
  }

  const appleKeys = await getAppleSigningKeys();
  const signingKey = appleKeys.find(function (key) {
    return key && key.kid === header.kid && key.kty === 'EC';
  });

  if (!signingKey) {
    throw new Error('Matching Apple signing key was not found.');
  }

  const publicKey = crypto.createPublicKey({
    key: signingKey,
    format: 'jwk'
  });
  const isSignatureValid = crypto.verify(
    'sha256',
    Buffer.from(parsedToken.signingInput, 'utf8'),
    {
      key: publicKey,
      dsaEncoding: 'ieee-p1363'
    },
    parsedToken.signature
  );

  if (!isSignatureValid) {
    throw new Error('Apple token signature is invalid.');
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const issuer = String(payload.iss || '').trim();
  const audience = payload.aud;
  const audienceMatches = Array.isArray(audience)
    ? audience.includes(APPLE_CLIENT_ID)
    : String(audience || '').trim() === APPLE_CLIENT_ID;

  if (issuer !== 'https://appleid.apple.com') {
    throw new Error('Apple token issuer is invalid.');
  }

  if (!audienceMatches) {
    throw new Error('Apple token audience is invalid.');
  }

  if (!payload.exp || Number(payload.exp) <= nowInSeconds) {
    throw new Error('Apple token has expired.');
  }

  return payload;
}

function sendJson(response, statusCode, payload, extraHeaders) {
  response.writeHead(statusCode, Object.assign({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Vect-Own-Session',
    'Content-Type': 'application/json; charset=utf-8'
  }, extraHeaders || {}));
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Vect-Own-Session',
    'Content-Type': 'text/plain; charset=utf-8'
  });
  response.end(message);
}

function handleHealthCheck(response) {
  sendJson(response, 200, {
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString()
  });
}

function sendFile(response, filePath) {
  fs.readFile(filePath, function (error, data) {
    if (error) {
      sendText(response, error.code === 'ENOENT' ? 404 : 500, error.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[extension] || 'application/octet-stream'
    });
    response.end(data);
  });
}

function readJsonFile(filePath, fallbackValue) {
  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    return fallbackValue;
  }
}

function writeJsonFile(filePath, value) {
  const tempPath = filePath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2));
  fs.renameSync(tempPath, filePath);
}

function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function normalizeSupabaseSubmissionRow(row) {
  const safeRow = row && typeof row === 'object' ? row : {};
  return {
    id: String(safeRow.id || '').trim(),
    createdAt: Number(safeRow.created_at || 0) || 0,
    updatedAt: Number(safeRow.updated_at || 0) || 0,
    ownerUpdatedAt: safeRow.owner_updated_at ? String(safeRow.owner_updated_at) : '',
    status: String(safeRow.status || 'pending').trim().toLowerCase(),
    reviewNote: String(safeRow.review_note || '').trim(),
    reviewedBy: String(safeRow.reviewed_by || '').trim(),
    reviewedAt: String(safeRow.reviewed_at || '').trim(),
    whatsappNumber: String(safeRow.whatsapp_number || '').trim(),
    fields: safeRow.fields && typeof safeRow.fields === 'object' ? safeRow.fields : {}
  };
}

function serializeSubmissionForSupabase(submission) {
  const safeSubmission = submission && typeof submission === 'object' ? submission : {};
  return {
    id: String(safeSubmission.id || '').trim(),
    created_at: Number(safeSubmission.createdAt || 0) || 0,
    updated_at: Number(safeSubmission.updatedAt || 0) || 0,
    owner_updated_at: safeSubmission.ownerUpdatedAt ? String(safeSubmission.ownerUpdatedAt) : null,
    status: String(safeSubmission.status || 'pending').trim().toLowerCase(),
    review_note: String(safeSubmission.reviewNote || '').trim(),
    reviewed_by: String(safeSubmission.reviewedBy || '').trim(),
    reviewed_at: String(safeSubmission.reviewedAt || '').trim(),
    whatsapp_number: String(safeSubmission.whatsappNumber || '').trim(),
    fields: safeSubmission.fields && typeof safeSubmission.fields === 'object' ? safeSubmission.fields : {}
  };
}

async function supabaseRequest(pathName, options) {
  const response = await fetch(SUPABASE_URL + pathName, Object.assign({
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY
    }
  }, options || {}));

  if (!response.ok) {
    let errorMessage = 'Supabase request failed.';

    try {
      const payload = await response.json();
      errorMessage = String(
        (payload && (payload.message || payload.error_description || payload.error)) ||
        errorMessage
      );
    } catch (error) {
      try {
        const text = await response.text();
        if (text) {
          errorMessage = text;
        }
      } catch (nestedError) {
        // Keep default message.
      }
    }

    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function listVectOwnSubmissions() {
  if (!hasSupabaseConfig()) {
    return loadVectOwnSubmissions();
  }

  const rows = await supabaseRequest(
    '/rest/v1/submissions?select=*&order=created_at.desc',
    {
      headers: {
        Accept: 'application/json'
      }
    }
  );

  return Array.isArray(rows) ? rows.map(normalizeSupabaseSubmissionRow) : [];
}

async function getSubmissionByIdAsync(submissionId) {
  if (!hasSupabaseConfig()) {
    return getSubmissionById(submissionId);
  }

  const safeId = String(submissionId || '').trim();

  if (!safeId) {
    return null;
  }

  const rows = await supabaseRequest(
    '/rest/v1/submissions?id=eq.' + encodeURIComponent(safeId) + '&select=*',
    {
      headers: {
        Accept: 'application/json'
      }
    }
  );

  return Array.isArray(rows) && rows.length ? normalizeSupabaseSubmissionRow(rows[0]) : null;
}

async function createSubmissionRecord(submission) {
  if (!hasSupabaseConfig()) {
    // Fallback to local file storage when Supabase is not configured
    try {
      const submissions = loadVectOwnSubmissions();
      submissions.unshift(submission);
      persistVectOwnSubmissions();
      return submission;
    } catch (error) {
      console.error('File storage error:', error);
      sendJson(response, 500, { success: false, error: 'Unable to save submission to local storage.' });
      return;
    }
  }

  if (!hasSupabaseConfig()) {
    try {
      const submissions = loadVectOwnSubmissions();
      submissions.unshift(submission);
      persistVectOwnSubmissions();
      return submission;
    } catch (error) {
      console.error('File storage error:', error);
      sendJson(response, 500, { success: false, error: 'Unable to save submission to local storage.' });
      return;
    }
  }

  const rows = await supabaseRequest('/rest/v1/submissions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify([serializeSubmissionForSupabase(submission)])
  });

  return Array.isArray(rows) && rows.length ? normalizeSupabaseSubmissionRow(rows[0]) : submission;
}

async function updateSubmissionRecord(submission) {
  if (!hasSupabaseConfig()) {
    const submissions = loadVectOwnSubmissions();
    const submissionIndex = submissions.findIndex(function (item) {
      return item && item.id === submission.id;
    });

    if (submissionIndex === -1) {
      submissions.unshift(submission);
    } else {
      submissions[submissionIndex] = submission;
    }

    persistVectOwnSubmissions();
    return submission;
  }

  const safeId = String(submission && submission.id || '').trim();
  const rows = await supabaseRequest('/rest/v1/submissions?id=eq.' + encodeURIComponent(safeId), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(serializeSubmissionForSupabase(submission))
  });

  return Array.isArray(rows) && rows.length ? normalizeSupabaseSubmissionRow(rows[0]) : submission;
}

async function deleteSubmissionRecord(submissionId) {
  const safeId = String(submissionId || '').trim();

  if (!safeId) {
    return false;
  }

  if (!hasSupabaseConfig()) {
    const submissions = loadVectOwnSubmissions();
    const nextSubmissions = submissions.filter(function (item) {
      return !item || item.id !== safeId;
    });

    if (nextSubmissions.length !== submissions.length) {
      vectOwnSubmissions = nextSubmissions;
      persistVectOwnSubmissions();
      return true;
    }

    return false;
  }

  await supabaseRequest('/rest/v1/submissions?id=eq.' + encodeURIComponent(safeId), {
    method: 'DELETE'
  });

  return true;
}

function loadVectOwnSubmissions() {
  if (vectOwnSubmissions) {
    return vectOwnSubmissions;
  }

  const saved = readJsonFile(VECT_OWN_DB_PATH, []);
  vectOwnSubmissions = Array.isArray(saved) ? saved : [];
  return vectOwnSubmissions;
}

function persistVectOwnSubmissions() {
  writeJsonFile(VECT_OWN_DB_PATH, loadVectOwnSubmissions());
}

function cleanupVectOwnSessions() {
  const now = Date.now();

  vectOwnSessions.forEach(function (session, token) {
    if (!session || !session.expiresAt || now > session.expiresAt) {
      vectOwnSessions.delete(token);
    }
  });
}

function parseCookies(request) {
  const cookieHeader = String(request.headers.cookie || '');
  const cookies = {};

  cookieHeader.split(';').forEach(function (pair) {
    const index = pair.indexOf('=');

    if (index === -1) {
      return;
    }

    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();

    if (key) {
      cookies[key] = decodeURIComponent(value);
    }
  });

  return cookies;
}

function buildCookieHeader(name, value, options) {
  const parts = [name + '=' + encodeURIComponent(value)];
  const config = options || {};

  parts.push('Path=' + (config.path || '/'));
  parts.push('SameSite=' + (config.sameSite || 'Lax'));

  if (config.httpOnly !== false) {
    parts.push('HttpOnly');
  }

  if (config.maxAge !== undefined && config.maxAge !== null) {
    parts.push('Max-Age=' + Math.floor(config.maxAge / 1000));
  }

  if (config.secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function getVectOwnSession(request) {
  cleanupVectOwnSessions();

  const cookies = parseCookies(request);
  const headerToken = String(request.headers[VECT_OWN_SESSION_HEADER] || '').trim();
  const cookieToken = String(cookies[VECT_OWN_SESSION_COOKIE] || '').trim();
  const token = headerToken || cookieToken;

  if (!token) {
    return null;
  }

  const session = vectOwnSessions.get(token);

  if (!session || Date.now() > session.expiresAt) {
    vectOwnSessions.delete(token);
    return null;
  }

  return Object.assign({
    token: token
  }, session);
}

function requireVectOwnSession(request, response) {
  const session = getVectOwnSession(request);

  if (!session) {
    sendJson(response, 401, { success: false, error: 'Owner login required.' });
    return null;
  }

  return session;
}

function cleanSubmissionValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    return value.map(cleanSubmissionValue);
  }

  if (typeof value === 'object') {
    const cleaned = {};

    Object.keys(value).forEach(function (key) {
      cleaned[key] = cleanSubmissionValue(value[key]);
    });

    return cleaned;
  }

  return String(value);
}

function normalizeSubmissionFields(fields) {
  const safeFields = {};
  const inputFields = fields && typeof fields === 'object' ? fields : {};
  const excludedPatterns = [
    /password/i,
    /authenticated/i,
    /api-base-url/i,
    /owner-login-/i,
    /owner-account-created/i,
    /owner-review-/i,
    /owner-final-submission-done-allowed/i,
    /owner-last-page/i,
    /owner-form-backup/i
  ];

  Object.keys(inputFields).forEach(function (key) {
    if (excludedPatterns.some(function (pattern) {
      return pattern.test(key);
    })) {
      return;
    }

    safeFields[key] = cleanSubmissionValue(inputFields[key]);
  });

  return safeFields;
}

function summarizeSubmissionFields(fields, whatsappNumber) {
  const safeFields = fields && typeof fields === 'object' ? fields : {};
  const categories = safeFields['owner-categories'];
  const districts = safeFields['owner-districts'];
  const parsedCategories = Array.isArray(categories) ? categories : tryParseJsonArray(categories);
  const parsedDistricts = Array.isArray(districts) ? districts : tryParseJsonArray(districts);

  return {
    companyName: String(safeFields['owner-company-name'] || safeFields['owner-name'] || safeFields['owner-company'] || '').trim(),
    ownerName: String(safeFields['owner-name'] || [safeFields['owner-first-name'], safeFields['owner-last-name']].filter(Boolean).join(' ')).trim(),
    email: String(safeFields['owner-email'] || '').trim(),
    phone: String(whatsappNumber || safeFields['owner-whatsapp-number'] || '').trim(),
    whatsappNumber: String(whatsappNumber || safeFields['owner-whatsapp-number'] || '').trim(),
    categories: parsedCategories,
    districts: parsedDistricts,
    documents: {
      heavyLicence: Boolean(safeFields['owner-heavy-licence-photo-name-1'] || safeFields['owner-heavy-licence-photo-name-2']),
      aadhaar: Boolean(safeFields['owner-aadhaar-photo-name']),
      profilePhoto: Boolean(safeFields['owner-profile-photo'])
    }
  };
}

function tryParseJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  const rawValue = String(value || '').trim();

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function serializeSubmissionForList(submission) {
  return {
    id: submission.id,
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
    status: submission.status,
    reviewedAt: submission.reviewedAt || '',
    reviewedBy: submission.reviewedBy || '',
    reviewNote: submission.reviewNote || '',
    summary: summarizeSubmissionFields(submission.fields || {}, submission.whatsappNumber)
  };
}

function getSubmissionById(submissionId) {
  const submissions = loadVectOwnSubmissions();
  return submissions.find(function (submission) {
    return submission && submission.id === submissionId;
  }) || null;
}

function cleanupProfilePhotoSessions() {
  const now = Date.now();

  profilePhotoSessions.forEach(function (session, token) {
    if (!session || now - session.createdAt > PROFILE_PHOTO_SESSION_TTL_MS) {
      profilePhotoSessions.delete(token);
    }
  });
}

function readJsonBody(request) {
  return new Promise(function (resolve, reject) {
    let body = '';
    const MAX_JSON_BODY_SIZE = 20 * 1024 * 1024;

    request.on('data', function (chunk) {
      body += chunk;

      if (body.length > MAX_JSON_BODY_SIZE) {
        reject(new Error('Payload too large.'));
        request.destroy();
      }
    });

    request.on('end', function () {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error('Invalid JSON payload.'));
      }
    });

    request.on('error', reject);
  });
}

function getSafePath(urlPathname) {
  const normalizedPath = decodeURIComponent(urlPathname === '/' ? '/index.html' : urlPathname);
  let fullPath = path.normalize(path.join(FRONTEND_DIR, normalizedPath));

  if (!fullPath.startsWith(FRONTEND_DIR)) {
    return null;
  }

  try {
    const fileStat = fs.existsSync(fullPath) ? fs.statSync(fullPath) : null;

    if (fileStat && fileStat.isDirectory()) {
      fullPath = path.join(fullPath, 'index.html');
    }
  } catch (error) {
    return null;
  }

  return fullPath;
}

function handleUpload(request, response) {
  let body = '';

  request.on('data', function (chunk) {
    body += chunk;

    if (body.length > 3 * 1024 * 1024) {
      request.destroy();
    }
  });

  request.on('end', function () {
    let payload;

    try {
      payload = JSON.parse(body);
    } catch (error) {
      sendJson(response, 400, { error: 'Invalid JSON payload.' });
      return;
    }

    const fileName = String(payload.fileName || '').trim();
    const mimeType = String(payload.mimeType || '').trim();
    const data = String(payload.data || '');
    const allowedTypes = ['image/jpeg', 'image/png'];

    if (!fileName || !allowedTypes.includes(mimeType) || !data) {
      sendJson(response, 400, { error: 'Invalid upload data.' });
      return;
    }

    try {
      const buffer = Buffer.from(data, 'base64');

      if (buffer.length > 5 * 1024 * 1024) {
        sendJson(response, 400, { error: 'Image size must be 5MB or less.' });
        return;
      }

      const extension = mimeType === 'image/png' ? '.png' : '.jpg';
      const safeBaseName = path.basename(fileName, path.extname(fileName)).replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 40) || 'licence-photo';
      const finalFileName = safeBaseName + '-' + Date.now() + extension;
      const outputPath = path.join(UPLOADS_DIR, finalFileName);

      fs.writeFileSync(outputPath, buffer);

      sendJson(response, 200, {
        success: true,
        fileName: finalFileName,
        fileUrl: '/uploads/' + finalFileName,
        viewUrl: '/owner-uploaded-photo.html?file=' + encodeURIComponent(finalFileName)
      });
    } catch (error) {
      sendJson(response, 500, { error: 'Unable to save file.' });
    }
  });
}

function handleUploadDelete(requestUrl, response) {
  const rawFileName = String(requestUrl.searchParams.get('file') || '').trim();
  const safeFileName = path.basename(rawFileName);

  if (!safeFileName || safeFileName !== rawFileName) {
    sendJson(response, 400, { error: 'Invalid file name.' });
    return;
  }

  const targetPath = path.join(UPLOADS_DIR, safeFileName);

  if (!targetPath.startsWith(UPLOADS_DIR)) {
    sendJson(response, 403, { error: 'Forbidden.' });
    return;
  }

  fs.rm(targetPath, {
    force: true,
    maxRetries: 5,
    retryDelay: 150
  }, function (error) {
    if (error && error.code !== 'ENOENT') {
      sendJson(response, 500, { error: 'Unable to delete file.', code: error.code || 'UNKNOWN' });
      return;
    }

    sendJson(response, 200, { success: true });
  });
}

async function handleGoogleAuth(request, response) {
  if (!GOOGLE_CLIENT_ID) {
    sendJson(response, 500, {
      error: 'Google sign-in is not configured on the server.'
    });
    return;
  }

  const oauthClient = getGoogleOAuthClient();

  if (!oauthClient) {
    sendJson(response, 500, {
      error: 'Google auth library is missing. Run npm install in backend.'
    });
    return;
  }

  let payload;

  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Invalid request body.' });
    return;
  }

  const credential = String(payload.credential || '').trim();

  if (!credential) {
    sendJson(response, 400, { error: 'Missing Google credential.' });
    return;
  }

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });
    const googlePayload = ticket.getPayload() || {};
    const fullName = String(googlePayload.name || '').trim();
    const splitName = fullName ? fullName.split(/\s+/) : [];
    const firstName = String(googlePayload.given_name || splitName[0] || '').trim();
    const lastName = String(googlePayload.family_name || splitName.slice(1).join(' ') || '').trim();
    const email = String(googlePayload.email || '').trim();

    sendJson(response, 200, {
      success: true,
      user: {
        firstName: firstName,
        lastName: lastName,
        email: email,
        name: [firstName, lastName].filter(Boolean).join(' ').trim() || fullName
      }
    });
  } catch (error) {
    sendJson(response, 401, { error: 'Google account verification failed.' });
  }
}

async function handleAppleAuth(request, response) {
  if (!APPLE_CLIENT_ID) {
    sendJson(response, 500, {
      error: 'Apple sign-in is not configured on the server.'
    });
    return;
  }

  let payload;

  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Invalid request body.' });
    return;
  }

  const identityToken = String(payload.idToken || '').trim();
  const appleUser = payload.user && typeof payload.user === 'object' ? payload.user : {};
  const appleName = appleUser.name && typeof appleUser.name === 'object' ? appleUser.name : {};

  if (!identityToken) {
    sendJson(response, 400, { error: 'Missing Apple identity token.' });
    return;
  }

  try {
    const applePayload = await verifyAppleIdentityToken(identityToken);
    const email = String(applePayload.email || appleUser.email || '').trim();
    const firstName = String(appleName.firstName || '').trim();
    const lastName = String(appleName.lastName || '').trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

    sendJson(response, 200, {
      success: true,
      user: {
        firstName: firstName,
        lastName: lastName,
        email: email,
        name: fullName || email || 'Apple user'
      }
    });
  } catch (error) {
    sendJson(response, 401, {
      error: error.message || 'Apple account verification failed.'
    });
  }
}

async function handleRequestOtp(request, response) {
  cleanupOtpSessions();

  let payload;

  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Invalid request body.' });
    return;
  }

  const contact = String(payload.contact || '').trim();
  const normalizedContact = normalizeContact(contact);

  if (!contact) {
    sendJson(response, 400, { error: 'Email is required.' });
    return;
  }

  if (!isEmail(normalizedContact)) {
    sendJson(response, 400, { error: 'Please enter a valid email address.' });
    return;
  }

  const otpCode = generateOtp();
  const now = Date.now();

  otpSessions.set(normalizedContact, {
    otpCode: otpCode,
    createdAt: now,
    expiresAt: now + OTP_TTL_MS
  });

  try {
    await sendOtpEmail(normalizedContact, otpCode);
    sendJson(response, 200, {
      success: true,
      contact: normalizedContact
    });
  } catch (error) {
    otpSessions.delete(normalizedContact);
    sendJson(response, 500, {
      error: error.message || 'Unable to send OTP email.'
    });
  }
}

async function handleVerifyOtp(request, response) {
  cleanupOtpSessions();

  let payload;

  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Invalid request body.' });
    return;
  }

  const contact = normalizeContact(payload.contact || '');
  const otpCode = String(payload.code || '').trim();

  if (!contact || !otpCode) {
    sendJson(response, 400, { error: 'Contact and OTP code are required.' });
    return;
  }

  const session = otpSessions.get(contact);

  if (!session) {
    sendJson(response, 404, { error: 'OTP session not found or expired.' });
    return;
  }

  if (Date.now() > session.expiresAt) {
    otpSessions.delete(contact);
    sendJson(response, 410, { error: 'OTP code expired. Request a new code.' });
    return;
  }

  if (session.otpCode !== otpCode) {
    sendJson(response, 401, { error: 'Invalid OTP code.' });
    return;
  }

  otpSessions.delete(contact);

  sendJson(response, 200, {
    success: true,
    verified: true,
    contact: contact
  });
}

function handleCreateProfilePhotoSession(response) {
  cleanupProfilePhotoSessions();

  const token = crypto.randomBytes(18).toString('hex');

  profilePhotoSessions.set(token, {
    createdAt: Date.now(),
    status: 'pending'
  });

  sendJson(response, 200, {
    success: true,
    token: token,
    status: 'pending'
  });
}

function handleGetProfilePhotoSession(requestUrl, response) {
  cleanupProfilePhotoSessions();

  const token = String(requestUrl.searchParams.get('token') || '').trim();

  if (!token) {
    sendJson(response, 400, { error: 'Missing token.' });
    return;
  }

  const session = profilePhotoSessions.get(token);

  if (!session) {
    sendJson(response, 404, { error: 'Session not found.' });
    return;
  }

  sendJson(response, 200, {
    success: true,
    token: token,
    status: session.status
  });
}

async function handleCompleteProfilePhotoSession(request, response) {
  cleanupProfilePhotoSessions();

  let payload;

  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Invalid request body.' });
    return;
  }

  const token = String(payload.token || '').trim();

  if (!token) {
    sendJson(response, 400, { error: 'Missing token.' });
    return;
  }

  const session = profilePhotoSessions.get(token);

  if (!session) {
    sendJson(response, 404, { error: 'Session not found.' });
    return;
  }

  session.status = 'completed';
  session.completedAt = Date.now();
  profilePhotoSessions.set(token, session);

  sendJson(response, 200, {
    success: true,
    token: token,
    status: session.status
  });
}

async function handleVectOwnLogin(request, response) {
  let payload;

  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendJson(response, 400, { success: false, error: error.message || 'Invalid request body.' });
    return;
  }

  const password = String(payload.password || '').trim();

  if (!password) {
    sendJson(response, 400, { success: false, error: 'Password is required.' });
    return;
  }

  if (!VECT_OWN_PASSWORD || password !== VECT_OWN_PASSWORD) {
    sendJson(response, 401, { success: false, error: 'Incorrect password.' });
    return;
  }

  const token = crypto.randomBytes(24).toString('hex');
  const now = Date.now();
  const session = {
    role: 'owner',
    createdAt: now,
    expiresAt: now + VECT_OWN_SESSION_TTL_MS
  };

  vectOwnSessions.set(token, session);

  sendJson(
    response,
    200,
    {
      success: true,
      authenticated: true,
      token: token,
      role: session.role,
      expiresAt: session.expiresAt
    },
    {
      'Set-Cookie': buildCookieHeader(VECT_OWN_SESSION_COOKIE, token, {
        path: '/vect-own',
        maxAge: VECT_OWN_SESSION_TTL_MS,
        sameSite: 'Lax',
        httpOnly: true
      })
    }
  );
}

async function handleVectOwnGoogleLogin(request, response) {
  if (!GOOGLE_CLIENT_ID) {
    sendJson(response, 500, { success: false, error: 'Google sign-in is not configured on the server.' });
    return;
  }

  const oauthClient = getGoogleOAuthClient();

  if (!oauthClient) {
    sendJson(response, 500, { success: false, error: 'Google auth library is missing. Run npm install in backend.' });
    return;
  }

  let payload;

  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendJson(response, 400, { success: false, error: error.message || 'Invalid request body.' });
    return;
  }

  const credential = String(payload.credential || '').trim();

  if (!credential) {
    sendJson(response, 400, { success: false, error: 'Missing Google credential.' });
    return;
  }

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });
    const googlePayload = ticket.getPayload() || {};
    const email = String(googlePayload.email || '').trim().toLowerCase();

    if (!email) {
      sendJson(response, 401, { success: false, error: 'Google account email is missing.' });
      return;
    }

    if (VECT_OWN_GOOGLE_EMAIL && email !== VECT_OWN_GOOGLE_EMAIL) {
      sendJson(response, 403, { success: false, error: 'Only vectmovers@gmail.com can access Vect Own.' });
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    const session = {
      role: 'owner',
      email: email,
      createdAt: now,
      expiresAt: now + VECT_OWN_SESSION_TTL_MS
    };

    vectOwnSessions.set(token, session);

    sendJson(
      response,
      200,
      {
        success: true,
        authenticated: true,
        token: token,
        role: session.role,
        email: email,
        expiresAt: session.expiresAt
      },
      {
        'Set-Cookie': buildCookieHeader(VECT_OWN_SESSION_COOKIE, token, {
          path: '/vect-own',
          maxAge: VECT_OWN_SESSION_TTL_MS,
          sameSite: 'Lax',
          httpOnly: true
        })
      }
    );
  } catch (error) {
    sendJson(response, 401, { success: false, error: 'Google account verification failed.' });
  }
}

function handleVectOwnLogout(request, response) {
  const cookies = parseCookies(request);
  const token = String(cookies[VECT_OWN_SESSION_COOKIE] || '').trim();

  if (token) {
    vectOwnSessions.delete(token);
  }

  sendJson(
    response,
    200,
    { success: true },
    {
      'Set-Cookie': buildCookieHeader(VECT_OWN_SESSION_COOKIE, '', {
        path: '/vect-own',
        maxAge: 0,
        sameSite: 'Lax',
        httpOnly: true
      })
    }
  );
}

function handleVectOwnMe(request, response) {
  const session = requireVectOwnSession(request, response);

  if (!session) {
    return;
  }

  sendJson(response, 200, {
    success: true,
    authenticated: true,
    role: session.role,
    expiresAt: session.expiresAt
  });
}

async function handlePublicSubmissionCreate(request, response) {
  let payload;

  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendJson(response, 400, { success: false, error: error.message || 'Invalid request body.' });
    return;
  }

  const fields = normalizeSubmissionFields(payload.fields || payload.storage || payload);
  const whatsappNumber = normalizePhoneNumber(payload.whatsappNumber || fields['owner-whatsapp-number'] || '');

  if (!whatsappNumber) {
    sendJson(response, 400, { success: false, error: 'WhatsApp number is required.' });
    return;
  }

  if (!isPhoneNumber(whatsappNumber)) {
    sendJson(response, 400, { success: false, error: 'Please provide a valid WhatsApp number.' });
    return;
  }

  const now = Date.now();
  const submission = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'pending',
    reviewNote: '',
    reviewedBy: '',
    reviewedAt: '',
    whatsappNumber: whatsappNumber,
    fields: Object.assign({}, fields, {
      'owner-whatsapp-number': whatsappNumber
    })
  };

  let savedSubmission;

  try {
    savedSubmission = await createSubmissionRecord(submission);
  } catch (error) {
    sendJson(response, 500, { success: false, error: error.message || 'Unable to save submission.' });
    return;
  }

  sendJson(response, 200, {
    success: true,
    submission: serializeSubmissionForList(savedSubmission)
  });
}

async function handlePublicSubmissionOwnerUpdate(requestUrl, request, response) {
  const pathParts = requestUrl.pathname.split('/').filter(Boolean);
  const submissionId = String(pathParts[2] || '').trim();
  let submission;

  try {
    submission = await getSubmissionByIdAsync(submissionId);
  } catch (error) {
    sendJson(response, 500, { success: false, error: error.message || 'Unable to load submission.' });
    return;
  }

  if (!submission) {
    sendJson(response, 404, { success: false, error: 'Submission not found.' });
    return;
  }

  let payload;

  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendJson(response, 400, { success: false, error: error.message || 'Invalid request body.' });
    return;
  }

  const fields = normalizeSubmissionFields(payload.fields || payload.storage || payload);
  const mergedFields = Object.assign({}, submission.fields || {}, fields);
  const nextWhatsappNumber = normalizePhoneNumber(
    payload.whatsappNumber ||
    mergedFields['owner-whatsapp-number'] ||
    submission.whatsappNumber ||
    ''
  );

  if (!nextWhatsappNumber) {
    sendJson(response, 400, { success: false, error: 'WhatsApp number is required.' });
    return;
  }

  if (!isPhoneNumber(nextWhatsappNumber)) {
    sendJson(response, 400, { success: false, error: 'Please provide a valid WhatsApp number.' });
    return;
  }

  submission.fields = Object.assign({}, mergedFields, {
    'owner-whatsapp-number': nextWhatsappNumber
  });
  submission.whatsappNumber = nextWhatsappNumber;
  submission.status = 'updated';
  submission.reviewNote = '';
  submission.reviewedBy = '';
  submission.reviewedAt = '';
  submission.updatedAt = Date.now();
  submission.ownerUpdatedAt = new Date().toISOString();

  let savedSubmission;

  try {
    savedSubmission = await updateSubmissionRecord(submission);
  } catch (error) {
    sendJson(response, 500, { success: false, error: error.message || 'Unable to update submission.' });
    return;
  }

  sendJson(response, 200, {
    success: true,
    submission: serializeSubmissionForList(savedSubmission)
  });
}

async function handleVectOwnSubmissionList(requestUrl, request, response) {
  const session = requireVectOwnSession(request, response);

  if (!session) {
    return;
  }

  const statusFilter = String(requestUrl.searchParams.get('status') || '').trim().toLowerCase();
  let submissions;

  try {
    submissions = await listVectOwnSubmissions();
  } catch (error) {
    sendJson(response, 500, { success: false, error: error.message || 'Unable to load submissions.' });
    return;
  }
  const filteredSubmissions = statusFilter && VECT_OWN_STATUSES.has(statusFilter)
    ? submissions.filter(function (submission) {
        return submission.status === statusFilter;
      })
    : submissions;

  sendJson(response, 200, {
    success: true,
    submissions: filteredSubmissions.map(serializeSubmissionForList)
  });
}

async function handleVectOwnSubmissionDetail(requestUrl, request, response) {
  const session = requireVectOwnSession(request, response);

  if (!session) {
    return;
  }

  const submissionId = String(requestUrl.pathname.split('/').pop() || '').trim();
  let submission;

  try {
    submission = await getSubmissionByIdAsync(submissionId);
  } catch (error) {
    sendJson(response, 500, { success: false, error: error.message || 'Unable to load submission.' });
    return;
  }

  if (!submission) {
    sendJson(response, 404, { success: false, error: 'Submission not found.' });
    return;
  }

  sendJson(response, 200, {
    success: true,
    submission: submission
  });
}

async function handleVectOwnSubmissionUpdate(requestUrl, request, response) {
  const session = requireVectOwnSession(request, response);

  if (!session) {
    return;
  }

  const submissionId = String(requestUrl.pathname.split('/').pop() || '').trim();
  let submission;

  try {
    submission = await getSubmissionByIdAsync(submissionId);
  } catch (error) {
    sendJson(response, 500, { success: false, error: error.message || 'Unable to load submission.' });
    return;
  }

  if (!submission) {
    sendJson(response, 404, { success: false, error: 'Submission not found.' });
    return;
  }

  let payload;

  try {
    payload = await readJsonBody(request);
  } catch (error) {
    sendJson(response, 400, { success: false, error: error.message || 'Invalid request body.' });
    return;
  }

  const nextStatus = String(payload.status || '').trim().toLowerCase();
  const reviewNote = String(payload.reviewNote || '').trim();

  if (!VECT_OWN_STATUSES.has(nextStatus)) {
    sendJson(response, 400, { success: false, error: 'Invalid status.' });
    return;
  }

  const previousStatus = submission.status;
  submission.status = nextStatus;
  submission.reviewNote = reviewNote;
  submission.reviewedBy = session.role || 'owner';
  submission.reviewedAt = new Date().toISOString();
  submission.updatedAt = Date.now();

  let savedSubmission;

  try {
    savedSubmission = await updateSubmissionRecord(submission);
  } catch (error) {
    sendJson(response, 500, { success: false, error: error.message || 'Unable to update submission.' });
    return;
  }

  let notificationError = '';

  if (previousStatus !== 'accepted' && nextStatus === 'accepted') {
    try {
      await sendWhatsAppMessage(
        savedSubmission.whatsappNumber || (savedSubmission.fields && savedSubmission.fields['owner-whatsapp-number']) || '',
        VECT_OWN_SELECTION_WHATSAPP_MESSAGE
      );
    } catch (error) {
      notificationError = error && error.message ? String(error.message) : 'Unable to send WhatsApp message.';
    }
  }

  sendJson(response, 200, {
    success: true,
    submission: serializeSubmissionForList(savedSubmission),
    notificationError: notificationError
  });
}

async function handleVectOwnSubmissionDelete(requestUrl, request, response) {
  const session = requireVectOwnSession(request, response);

  if (!session) {
    return;
  }

  const submissionId = String(requestUrl.pathname.split('/').pop() || '').trim();

  if (!submissionId) {
    sendJson(response, 400, { success: false, error: 'Submission id is required.' });
    return;
  }

  try {
    const deleted = await deleteSubmissionRecord(submissionId);

    if (!deleted) {
      sendJson(response, 404, { success: false, error: 'Submission not found.' });
      return;
    }
  } catch (error) {
    sendJson(response, 500, { success: false, error: error.message || 'Unable to delete submission.' });
    return;
  }

  sendJson(response, 200, {
    success: true
  });
}

const server = http.createServer(function (request, response) {
  const requestUrl = new URL(request.url, 'http://' + request.headers.host);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Vect-Own-Session'
    });
    response.end();
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/health') {
    handleHealthCheck(response);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/auth/google') {
    handleGoogleAuth(request, response);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/auth/apple') {
    handleAppleAuth(request, response);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/auth/request-otp') {
    handleRequestOtp(request, response);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/auth/verify-otp') {
    handleVerifyOtp(request, response);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/profile-photo-session') {
    handleCreateProfilePhotoSession(response);
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/profile-photo-session') {
    handleGetProfilePhotoSession(requestUrl, response);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/profile-photo-session/complete') {
    handleCompleteProfilePhotoSession(request, response);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/vect-own/login') {
    handleVectOwnLogin(request, response);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/vect-own/login-google') {
    handleVectOwnGoogleLogin(request, response);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/vect-own/logout') {
    handleVectOwnLogout(request, response);
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/vect-own/me') {
    handleVectOwnMe(request, response);
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/api/vect-own/submissions') {
    handleVectOwnSubmissionList(requestUrl, request, response);
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname.startsWith('/api/vect-own/submissions/')) {
    handleVectOwnSubmissionDetail(requestUrl, request, response);
    return;
  }

  if (request.method === 'PATCH' && requestUrl.pathname.startsWith('/api/vect-own/submissions/')) {
    handleVectOwnSubmissionUpdate(requestUrl, request, response);
    return;
  }

  if (request.method === 'DELETE' && requestUrl.pathname.startsWith('/api/vect-own/submissions/')) {
    handleVectOwnSubmissionDelete(requestUrl, request, response);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/submissions') {
    handlePublicSubmissionCreate(request, response);
    return;
  }

  if (request.method === 'PATCH' && /^\/api\/submissions\/[^/]+\/owner-update$/.test(requestUrl.pathname)) {
    handlePublicSubmissionOwnerUpdate(requestUrl, request, response);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/upload-heavy-licence') {
    handleUpload(request, response);
    return;
  }

  if (request.method === 'DELETE' && requestUrl.pathname === '/api/upload-heavy-licence') {
    handleUploadDelete(requestUrl, response);
    return;
  }

  const safePath = getSafePath(requestUrl.pathname);

  if (!safePath) {
    sendText(response, 403, 'Forbidden');
    return;
  }

  sendFile(response, safePath);
});

server.listen(PORT, HOST, function () {
  console.log('VECT MOVERS server running at http://' + HOST + ':' + PORT);
});
