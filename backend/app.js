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
const PROJECT_ROOT = path.join(__dirname, '..');
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');
const UPLOADS_DIR = path.join(FRONTEND_DIR, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const VECT_OWN_DB_PATH = path.join(DATA_DIR, 'vect-own-submissions.json');
const VECT_OWN_SESSION_COOKIE = 'vect_own_session';
const VECT_OWN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const VECT_OWN_PASSWORD = String(process.env.VECT_OWN_PASSWORD || 'vectown1234').trim();
const VECT_OWN_SESSION_HEADER = 'x-vect-own-session';

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
fs.mkdirSync(DATA_DIR, { recursive: true });

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
const VECT_OWN_STATUSES = new Set(['pending', 'accepted', 'rejected']);

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
    /owner-account-created/i
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
    const MAX_JSON_BODY_SIZE = 12 * 1024 * 1024;

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

      if (buffer.length > 2 * 1024 * 1024) {
        sendJson(response, 400, { error: 'Image size must be 2MB or less.' });
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

  const submissions = loadVectOwnSubmissions();
  submissions.unshift(submission);
  persistVectOwnSubmissions();

  sendJson(response, 200, {
    success: true,
    submission: serializeSubmissionForList(submission)
  });
}

function handleVectOwnSubmissionList(requestUrl, request, response) {
  const session = requireVectOwnSession(request, response);

  if (!session) {
    return;
  }

  const statusFilter = String(requestUrl.searchParams.get('status') || '').trim().toLowerCase();
  const submissions = loadVectOwnSubmissions();
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

function handleVectOwnSubmissionDetail(requestUrl, request, response) {
  const session = requireVectOwnSession(request, response);

  if (!session) {
    return;
  }

  const submissionId = String(requestUrl.pathname.split('/').pop() || '').trim();
  const submission = getSubmissionById(submissionId);

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
  const submission = getSubmissionById(submissionId);

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

  submission.status = nextStatus;
  submission.reviewNote = reviewNote;
  submission.reviewedBy = session.role || 'owner';
  submission.reviewedAt = new Date().toISOString();
  submission.updatedAt = Date.now();

  persistVectOwnSubmissions();

  sendJson(response, 200, {
    success: true,
    submission: serializeSubmissionForList(submission)
  });
}

const server = http.createServer(function (request, response) {
  const requestUrl = new URL(request.url, 'http://' + request.headers.host);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Vect-Own-Session'
    });
    response.end();
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

  if (request.method === 'POST' && requestUrl.pathname === '/api/submissions') {
    handlePublicSubmissionCreate(request, response);
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
