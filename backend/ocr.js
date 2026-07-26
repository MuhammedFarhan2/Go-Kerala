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
  var lines = text.split('\n').filter(Boolean);
  var labelPatterns = [
    /licen[ce]+\s*(?:no|num|number|#)[:\s]*([A-Z]{2}\d{2}\d{4,15})/i,
    /dl\s*(?:no|num|number|#)[:\s]*([A-Z]{2}\d{2}\d{4,15})/i,
    /driving\s*licen[ce]+\s*(?:no|num|number|#)?[:\s]*([A-Z]{2}\d{2}\d{4,15})/i,
    /l\s*no[:\s]*([A-Z]{2}\d{2}\d{4,15})/i
  ];
  for (var li = 0; li < lines.length; li++) {
    var line = lines[li].trim();
    for (var pi = 0; pi < labelPatterns.length; pi++) {
      var m = line.match(labelPatterns[pi]);
      if (m && m[1]) return m[1];
    }
  }
  var cleaned = text.replace(/[^A-Za-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  var candidates = cleaned.split(' ');
  for (var ci = 0; ci < candidates.length; ci++) {
    var raw = candidates[ci].toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (/^[A-Z]{2}\d{2}\d{4,15}$/.test(raw)) {
      var cleanedDl = raw.replace(/[\s-]/g, '').toUpperCase();
      if (cleanedDl.length >= 12 && cleanedDl.length <= 16) return raw;
    }
  }
  var fullCleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  var matches = fullCleaned.match(/[A-Z]{2}\d{2}\d{4,15}/g);
  if (matches && matches.length) {
    for (var mi = 0; mi < matches.length; mi++) {
      if (matches[mi].length >= 12 && matches[mi].length <= 16) return matches[mi];
    }
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