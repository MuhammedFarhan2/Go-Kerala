const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT) || 3000;
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || '').trim();
const PROJECT_ROOT = path.join(__dirname, '..');
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');
const UPLOADS_DIR = path.join(FRONTEND_DIR, 'uploads');

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

let googleOAuthClient = null;

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

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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

function readJsonBody(request) {
  return new Promise(function (resolve, reject) {
    let body = '';

    request.on('data', function (chunk) {
      body += chunk;

      if (body.length > 1024 * 1024) {
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
  const fullPath = path.normalize(path.join(FRONTEND_DIR, normalizedPath));

  if (!fullPath.startsWith(FRONTEND_DIR)) {
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

const server = http.createServer(function (request, response) {
  const requestUrl = new URL(request.url, 'http://' + request.headers.host);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    response.end();
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/auth/google') {
    handleGoogleAuth(request, response);
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
  console.log('Saath server running at http://' + HOST + ':' + PORT);
});
