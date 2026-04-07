const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');

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

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
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

function getSafePath(urlPathname) {
  const normalizedPath = decodeURIComponent(urlPathname === '/' ? '/index.html' : urlPathname);
  const fullPath = path.normalize(path.join(ROOT_DIR, normalizedPath));

  if (!fullPath.startsWith(ROOT_DIR)) {
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

const server = http.createServer(function (request, response) {
  const requestUrl = new URL(request.url, 'http://' + request.headers.host);

  if (request.method === 'POST' && requestUrl.pathname === '/api/upload-heavy-licence') {
    handleUpload(request, response);
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
