const Tesseract = require('tesseract.js');
const REQUEST_TIMEOUT = 60000;

let worker = null;
let workerReady = false;
let workerInitPromise = null;

function dataUrlToBuffer(dataUrl) {
  var matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) return null;
  return Buffer.from(matches[2], 'base64');
}

async function getWorker() {
  if (workerReady && worker) return worker;
  if (workerInitPromise) return workerInitPromise;
  workerInitPromise = (async function () {
    try {
      worker = await Tesseract.createWorker('eng', 1, {
        logger: function (info) { if (info.status === 'recognizing text') { /* progress */ } }
      });
      workerReady = true;
      return worker;
    } catch (err) {
      workerReady = false;
      worker = null;
      workerInitPromise = null;
      throw err;
    }
  })();
  return workerInitPromise;
}

async function extractTextFromImage(imageInput) {
  var input = imageInput;
  if (typeof imageInput === 'string' && /^data:image\//.test(imageInput)) {
    var buf = dataUrlToBuffer(imageInput);
    if (buf) input = buf;
  }
  const tessWorker = await getWorker();
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT);
  try {
    const result = await tessWorker.recognize(input);
    return result.data.text || '';
  } finally {
    clearTimeout(timer);
  }
}

function extractDLNumber(text) {
  const cleaned = text.replace(/[^A-Za-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  const candidates = cleaned.split(' ');
  for (var i = 0; i < candidates.length; i++) {
    var raw = candidates[i].toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (/^[A-Z]{2}\d{2}\d{4,15}$/.test(raw)) {
      return raw;
    }
  }
  var fullCleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  var matches = fullCleaned.match(/[A-Z]{2}\d{2}\d{4,15}/g);
  if (matches && matches.length) {
    return matches[0];
  }
  return '';
}

async function extractDLFromImage(imageInput) {
  var text = '';
  try {
    text = await extractTextFromImage(imageInput);
  } catch (err) {
    return { success: false, error: 'OCR failed: ' + (err.message || 'Unknown error'), text: '' };
  }
  if (!text.trim()) {
    return { success: false, error: 'No text could be read from the image. Make sure the licence photo is clear.', text: '' };
  }
  var dlNumber = extractDLNumber(text);
  if (!dlNumber) {
    return {
      success: false,
      error: 'Could not find a driving licence number in the photo. Raw OCR text: ' + text.substring(0, 300),
      text: text.substring(0, 500)
    };
  }
  return { success: true, dlNumber: dlNumber, text: text.substring(0, 500) };
}

module.exports = { extractDLFromImage, extractTextFromImage, extractDLNumber };