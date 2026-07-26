const cheerio = require('cheerio');
const Tesseract = require('tesseract.js');

const PARIVAHAN_BASE = 'https://parivahan.gov.in/rcdlstatus';
const PARIVAHAN_POST = 'https://parivahan.gov.in/rcdlstatus/vahan/rcstatus.xhtml';
const REQUEST_TIMEOUT = 15000;

function delay(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

function extractViewState(html) {
  var match = html.match(/name="(?:jakarta|javax)\.faces\.ViewState"\s+value="([^"]+)"/i);
  if (match) return match[1];
  match = html.match(/ViewState[^>]+value="([^"]+)"/);
  return match ? match[1] : '';
}

function extractFirstButtonId(html) {
  var $ = cheerio.load(html);
  var btn = $('button[id^="form_rcdl:j_idt"], button[id*="form_rcdl"], input[type="submit"][id*="form_rcdl"]').first();
  if (btn.attr('id')) return btn.attr('id');
  btn = $('button:contains("Search"), input[value="Search"]').first();
  if (btn.attr('id')) return btn.attr('id');
  return '';
}

function extractCookies(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    const cookies = response.headers.getSetCookie();
    return cookies.map(c => c.split(';')[0]).join('; ');
  }
  const cookieStr = response.headers.get('set-cookie');
  if (!cookieStr) return '';
  return cookieStr.split(',').map(function (c) {
    return c.trim().split(';')[0];
  }).join('; ');
}

function parseJSFPartialResponse(xmlText) {
  const updateMatch = xmlText.match(/<update[^>]*id="([^"]+)"[^>]*>[\s\S]*?<!\[CDATA\[([\s\S]*?)\]\]>[\s\S]*?<\/update>/);
  if (updateMatch) {
    return updateMatch[2];
  }
  const altMatch = xmlText.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return altMatch ? altMatch[1] : xmlText;
}

function extractTableData(htmlContent) {
  const $ = cheerio.load(htmlContent);
  const data = {};

  $('table tr').each(function () {
    const tds = $(this).find('td');
    if (tds.length === 2) {
      const key = $(tds[0]).text().replace(':', '').trim();
      const val = $(tds[1]).text().trim();
      if (key && val) {
        data[key] = val;
      }
    }
    if (tds.length === 4) {
      const key1 = $(tds[0]).text().replace(':', '').trim();
      const val1 = $(tds[1]).text().trim();
      const key2 = $(tds[2]).text().replace(':', '').trim();
      const val2 = $(tds[3]).text().trim();
      if (key1 && val1) data[key1] = val1;
      if (key2 && val2) data[key2] = val2;
    }
  });

  return data;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(function () {
    controller.abort();
  }, timeoutMs || REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, Object.assign({}, options, {
      signal: controller.signal
    }));
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function verifyDrivingLicenseWithBrowser(dlNumber) {
  const cleaned = String(dlNumber || '').replace(/[\s-]/g, '').toUpperCase().trim();

  if (!cleaned) {
    return { verified: false, error: 'No DL number provided', formatValid: false };
  }

  if (!/^[A-Z]{2}\d{2}\d{4,15}$/.test(cleaned) && !/^[A-Z]{2}\d{5,13}$/.test(cleaned)) {
    return { verified: false, error: 'Invalid DL number format (expected: MH0220110012345 or MC5518528)', formatValid: false };
  }

  let browser;
  try {
    const puppeteer = require('puppeteer-core');
    const chromium = require('@sparticuz/chromium');
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: 'new',
      timeout: 45000
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    try {
      await page.goto(PARIVAHAN_BASE + '/?pur_cd=102', { waitUntil: 'networkidle2', timeout: 45000 });
    } catch (navErr) {
      var pageContent = await page.evaluate(function () { return document.body ? document.body.innerText.substring(0, 2000) : 'no body'; }).catch(function () { return 'page unavailable'; });
      var pageUrl = page.url();
      return { verified: false, found: false, error: 'Parivahan navigation failed', formatValid: true, systemError: 'URL=' + pageUrl + ' Body=' + pageContent };
    }

    // Wait for the DL number input field (new ID: tf_dlNO)
    var dlInputFound = false;
    try {
      await page.waitForSelector('input[id*="tf_dlNO"], input[id*="tf_reg_no1"], input[placeholder*="Driving Licence"]', { timeout: 15000 });
      dlInputFound = true;
    } catch (_) {}
    if (!dlInputFound) {
      var pageContent = await page.evaluate(function () { return document.body ? document.body.innerHTML.substring(0, 3000) : 'no body'; }).catch(function () { return 'page unavailable'; });
      var pageUrl = page.url();
      return { verified: false, found: false, error: 'Parivahan form input not found', formatValid: true, systemError: 'URL=' + pageUrl + ' HTML=' + pageContent.replace(/\s+/g, ' ').trim() };
    }

    // Type DL number
    await page.click('input[id*="tf_dlNO"], input[id*="tf_reg_no1"], input[placeholder*="Driving Licence"]', { clickCount: 3 });
    await page.type('input[id*="tf_dlNO"], input[id*="tf_reg_no1"], input[placeholder*="Driving Licence"]', cleaned, { delay: 20 });
    await delay(300);

    // Solve captcha: retry with clean parameters until Tesseract can read it
    var captchaText = '';
    for (var captchaAttempt = 0; captchaAttempt < 5; captchaAttempt++) {
      try {
        // Reload captcha with clean parameters (no noise, no distortion, no background)
        var reloaded = await page.evaluate(function () {
          var img = document.querySelector('img[src*="DispplayCaptcha"]');
          if (!img) return false;
          var src = img.src;
          src = src.replace(/noise_cd=\d+/g, 'noise_cd=0');
          src = src.replace(/gimp_cd=\d+/g, 'gimp_cd=0');
          src = src.replace(/bkgp_cd=\d+/g, 'bkgp_cd=0');
          img.src = src;
          return true;
        });
        if (!reloaded) break;

        await delay(800);

        // Capture captcha via canvas
        var captchaBase64 = await page.evaluate(function () {
          var img = document.querySelector('img[src*="DispplayCaptcha"]');
          if (!img) return null;
          var canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 200;
          canvas.height = img.naturalHeight || img.height || 60;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          return canvas.toDataURL('image/png');
        });

        if (captchaBase64) {
          var result = await Tesseract.recognize(captchaBase64, 'eng', {
            tessedit_pageseg_mode: 7
          });
          captchaText = (result.data.text || '').replace(/\s/g, '').replace(/[^A-Za-z0-9]/g, '').substring(0, 6);
          if (captchaText && captchaText.length >= 4) {
            break; // Successfully read captcha
          }
        }
      } catch (_) {}
      captchaText = '';
      await delay(500);
    }

    if (captchaText) {
      try {
        var captchaInput = await page.$('input[id*="CaptchaID"]');
        if (captchaInput) {
          await captchaInput.type(captchaText.toUpperCase(), { delay: 15 });
        }
      } catch (_) {}
    }

    await delay(200);

    // Click search button
    var clicked = false;
    try {
      var btns = await page.$$('button');
      for (var b = 0; b < btns.length; b++) {
        var txt = await page.evaluate(function (el) { return (el.textContent || '').toLowerCase(); }, btns[b]);
        if (txt.includes('search')) {
          await btns[b].click();
          clicked = true;
          break;
        }
      }
    } catch (_) {}
    if (!clicked) {
      try {
        await page.keyboard.press('Enter');
      } catch (_) {}
    }

    // Wait for result table or error message
    try {
      await page.waitForSelector('table, span[id*="rcdl_pnl"]', { timeout: 25000 });
    } catch (_) {}
    await delay(3000);

    var pageText = await page.evaluate(function () { return document.body.innerText; });

    if (pageText.includes('does not exist') || pageText.includes('No Record') || pageText.includes('not found') || pageText.includes('SORRY')) {
      return { verified: false, found: false, error: 'No record found in RTO database', formatValid: true };
    }

    // Parse result table
    var tableData = {};
    var tableHtml = await page.evaluate(function () {
      var tables = document.querySelectorAll('table');
      if (!tables.length) return '';
      var html = '';
      for (var t = 0; t < tables.length; t++) {
        html += tables[t].outerHTML;
      }
      return html;
    });

    if (tableHtml) {
      var $ = cheerio.load('<div>' + tableHtml + '</div>');
      $('table tr').each(function () {
        var tds = $(this).find('td');
        if (tds.length === 2) {
          var key = $(tds[0]).text().replace(':', '').trim();
          var val = $(tds[1]).text().trim();
          if (key && val) tableData[key] = val;
        }
        if (tds.length === 4) {
          var k1 = $(tds[0]).text().replace(':', '').trim();
          var v1 = $(tds[1]).text().trim();
          var k2 = $(tds[2]).text().replace(':', '').trim();
          var v2 = $(tds[3]).text().trim();
          if (k1 && v1) tableData[k1] = v1;
          if (k2 && v2) tableData[k2] = v2;
        }
      });
    }

    var hasData = Object.keys(tableData).length > 0;
    return {
      verified: hasData,
      found: hasData,
      details: hasData ? tableData : null,
      captchaUsed: !!captchaText,
      error: hasData ? '' : 'Could not parse RTO response from browser',
      formatValid: true
    };
  } catch (err) {
    var errorMsg = err.message;
    if (browser) {
      try {
        var pages = await browser.pages();
        if (pages.length > 0) {
          var p = pages[0];
          var html = await p.evaluate(function () { return (document.body ? document.body.innerHTML : '') || ''; }).catch(function () { return ''; });
          if (html) errorMsg += ' PAGE_HTML=' + html.replace(/\s+/g, ' ').substring(0, 3000);
        }
      } catch (_) {}
    }
    return {
      verified: false,
      found: false,
      error: 'Unable to reach RTO portal via browser.',
      formatValid: true,
      manualUrl: PARIVAHAN_BASE + '/?pur_cd=102',
      systemError: errorMsg
    };
  } finally {
    if (browser) try { await browser.close(); } catch (_) {}
  }
}

async function verifyDrivingLicenseHttp(dlNumber) {
  const cleaned = String(dlNumber || '').replace(/[\s-]/g, '').toUpperCase().trim();
  if (!cleaned) {
    return { verified: false, error: 'No DL number provided', formatValid: false };
  }
  if (!/^[A-Z]{2}\d{2}\d{4,15}$/.test(cleaned) && !/^[A-Z]{2}\d{5,13}$/.test(cleaned)) {
    return { verified: false, error: 'Invalid DL number format (expected: MH0220110012345 or MC5518528)', formatValid: false };
  }
  try {
    const result = await checkParivahanHttp(cleaned);
    return Object.assign({ formatValid: true }, result);
  } catch (err) {
    return {
      verified: false, error: 'Unable to reach RTO portal. Please verify manually.',
      formatValid: true, manualUrl: PARIVAHAN_BASE + '/?pur_cd=102', systemError: err.message
    };
  }
}

async function verifyDrivingLicense(dlNumber) {
  var browserResult = null;
  try {
    browserResult = await verifyDrivingLicenseWithBrowser(dlNumber);
  } catch (_) {}

  if (browserResult && browserResult.found) {
    return browserResult;
  }

  try {
    var httpResult = await verifyDrivingLicenseHttp(dlNumber);
    if (httpResult && (httpResult.found || httpResult.systemError)) {
      return httpResult;
    }
    if (browserResult) return browserResult;
    return httpResult;
  } catch (err) {
    if (browserResult) return browserResult;
    return {
      verified: false,
      error: 'Unable to reach RTO portal. Please verify manually.',
      formatValid: true,
      manualUrl: PARIVAHAN_BASE + '/?pur_cd=102',
      systemError: err.message
    };
  }
}

async function verifyVehicleRegistration(regNumber) {
  const cleaned = String(regNumber || '').replace(/[\s-]/g, '').toUpperCase().trim();

  if (!cleaned) {
    return { verified: false, error: 'No registration number provided', formatValid: false };
  }

  const match = cleaned.match(/^([A-Z]{2}\d{1,2}[A-Z]{0,3})(\d{1,4})$/);
  if (!match) {
    return {
      verified: false,
      error: 'Invalid vehicle number format (e.g. KL07AB1234)',
      formatValid: false
    };
  }

  try {
    const result = await checkParivahanRC(match[1], match[2]);
    return Object.assign({ formatValid: true }, result);
  } catch (err) {
    return {
      verified: false,
      error: 'Unable to reach RTO portal. Please verify manually.',
      formatValid: true,
      manualUrl: PARIVAHAN_BASE + '/?pur_cd=102',
      systemError: err.message
    };
  }
}

async function checkParivahanHttp(dlNumber) {
  const initialRes = await fetchWithTimeout(PARIVAHAN_BASE + '/?pur_cd=102', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!initialRes.ok) {
    throw new Error('RTO portal returned status ' + initialRes.status);
  }

  const initialHtml = await initialRes.text();
  const viewState = extractViewState(initialHtml);
  const firstButtonId = extractFirstButtonId(initialHtml);
  const cookies = extractCookies(initialRes);
  const formAction = initialHtml.match(/action="(\/rcdlstatus\/[^"]+)"/);
  const jsessionid = formAction ? (formAction[1].match(/jsessionid=([^?;]+)/) || ['',''])[1] : '';

  if (!viewState || !firstButtonId) {
    var htmlPreview = initialHtml.substring(0, 1500).replace(/\s+/g, ' ').trim();
    throw new Error('Could not initialize RTO portal session. HTML: ' + htmlPreview);
  }

  // Solve captcha with retry: request clean captcha, OCR, retry if fails
  var captchaCode = '';
  for (var c = 0; c < 5; c++) {
    try {
      var captchaUrl = PARIVAHAN_BASE + '/DispplayCaptcha' + (jsessionid ? ';jsessionid=' + jsessionid : '')
        + '?txtp_cd=1&bkgp_cd=0&noise_cd=0&gimp_cd=0&txtp_length=5';
      var captchaRes = await fetchWithTimeout(captchaUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Cookie': cookies,
          'Referer': PARIVAHAN_BASE + '/?pur_cd=102'
        }
      });
      var captchaBuf = Buffer.from(await captchaRes.arrayBuffer());

      var ocrResult = await Tesseract.recognize(captchaBuf, 'eng', {
        tessedit_pageseg_mode: 7
      });
      var readText = (ocrResult.data.text || '').replace(/\s/g, '').replace(/[^A-Za-z0-9]/g, '').substring(0, 6);
      if (readText && readText.length >= 4) {
        captchaCode = readText.toUpperCase();
        break;
      }
    } catch (_) {}
  }

  if (!captchaCode) {
    throw new Error('Could not read verification code after multiple attempts');
  }

  var params = new URLSearchParams();
  params.append('javax.faces.partial.ajax', 'true');
  params.append('javax.faces.source', firstButtonId);
  params.append('javax.faces.partial.execute', '@all');
  params.append('javax.faces.partial.render', 'form_rcdl:pnl_show form_rcdl:pg_show form_rcdl:rcdl_pnl');
  params.append(firstButtonId, firstButtonId);
  params.append('form_rcdl', 'form_rcdl');
  params.append('form_rcdl:tf_dlNO', dlNumber);
  params.append('form_rcdl:tf_dob_input', '');
  params.append('form_rcdl:j_idt68:CaptchaID', captchaCode);
  params.append('javax.faces.ViewState', viewState);

  var postUrl = 'https://parivahan.gov.in' + actionPath;
  if (jsessionid) postUrl += ';jsessionid=' + jsessionid;

  const postRes = await fetchWithTimeout(postUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Faces-Request': 'partial/ajax',
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/xml, text/xml, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.5',
      'Origin': 'https://parivahan.gov.in'
    },
    body: params.toString()
  });

  const responseText = await postRes.text();

  if (responseText.includes('does not exist') || responseText.includes('No Record') || responseText.includes('SORRY')) {
    return {
      verified: false,
      found: false,
      error: 'No record found in RTO database',
      raw: responseText.substring(0, 500)
    };
  }

  const resultHtml = parseJSFPartialResponse(responseText);
  const tableData = extractTableData(resultHtml);

  const hasData = Object.keys(tableData).length > 0;

  return {
    verified: hasData,
    found: hasData,
    details: hasData ? tableData : null,
    captchaUsed: !!captchaCode,
    error: hasData ? '' : 'Could not parse RTO response'
  };
}

async function checkParivahanRC(regPart1, regPart2) {
  const initialRes = await fetchWithTimeout(PARIVAHAN_BASE + '/?pur_cd=102', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!initialRes.ok) {
    throw new Error('RTO portal returned status ' + initialRes.status);
  }

  const initialHtml = await initialRes.text();
  const viewState = extractViewState(initialHtml);
  const firstButtonId = extractFirstButtonId(initialHtml);
  const cookies = extractCookies(initialRes);

  if (!viewState || !firstButtonId) {
    throw new Error('Could not initialize RTO portal session');
  }

  const params = new URLSearchParams();
  params.append('javax.faces.partial.ajax', 'true');
  params.append('javax.faces.source', firstButtonId);
  params.append('javax.faces.partial.execute', '@all');
  params.append('javax.faces.partial.render', 'form_rcdl:pnl_show form_rcdl:pg_show form_rcdl:rcdl_pnl');
  params.append(firstButtonId, firstButtonId);
  params.append('form_rcdl', 'form_rcdl');
  params.append('form_rcdl:tf_reg_no1', regPart1);
  params.append('form_rcdl:tf_reg_no2', regPart2);
  params.append('javax.faces.ViewState', viewState);

  const postRes = await fetchWithTimeout(PARIVAHAN_POST, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Faces-Request': 'partial/ajax',
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/xml, text/xml, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.5',
      'Origin': 'https://parivahan.gov.in'
    },
    body: params.toString()
  });

  const responseText = await postRes.text();

  if (responseText.includes('does not exist') || responseText.includes('No Record')) {
    return {
      verified: false,
      found: false,
      error: 'No record found in RTO database',
      raw: responseText.substring(0, 500)
    };
  }

  const resultHtml = parseJSFPartialResponse(responseText);
  const tableData = extractTableData(resultHtml);

  const hasData = Object.keys(tableData).length > 0;

  return {
    verified: hasData,
    found: hasData,
    details: hasData ? tableData : null,
    error: hasData ? '' : 'Could not parse RTO response'
  };
}

function extractStructuredDetails(tableData) {
  if (!tableData || typeof tableData !== 'object') {
    return null;
  }

  var fieldMap = {
    'Owner Name': 'name',
    'Name of Owner': 'name',
    'Name': 'name',
    'Date of Birth': 'dob',
    'DOB': 'dob',
    'Licence Validity': 'issueDate',
    'Valid From': 'issueDate',
    'Valid Upto': 'expiryDate',
    'Valid Till': 'expiryDate',
    'Licence Status': 'status',
    'Status': 'status',
    'COV': 'vehicleClasses',
    'Class of Vehicle': 'vehicleClasses',
    'Class of Vehicles': 'vehicleClasses',
    'Issuing Authority': 'issuingAuthority',
    'RTO': 'issuingAuthority',
    'DL Number': 'dlNumber',
    'Licence No': 'dlNumber',
    'Hazardous Valid Till': 'hazardousValidTill',
    'Badge Details': 'badgeDetails',
    'Transport Vehicle': 'transportVehicle'
  };

  var result = {};
  Object.keys(tableData).forEach(function (key) {
    var normalizedKey = fieldMap[key] || null;
    if (normalizedKey) {
      if (normalizedKey === 'vehicleClasses') {
        if (!result.vehicleClasses) result.vehicleClasses = [];
        result.vehicleClasses.push(tableData[key]);
      } else {
        result[normalizedKey] = tableData[key];
      }
    }
  });

  if (result.vehicleClasses && Array.isArray(result.vehicleClasses)) {
    result.vehicleClasses = result.vehicleClasses.filter(Boolean);
  }

  return Object.keys(result).length > 0 ? result : null;
}

module.exports = {
  verifyDrivingLicense,
  verifyVehicleRegistration,
  extractStructuredDetails
};
