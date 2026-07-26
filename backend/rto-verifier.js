const cheerio = require('cheerio');

const PARIVAHAN_BASE = 'https://parivahan.gov.in/rcdlstatus';
const PARIVAHAN_POST = 'https://parivahan.gov.in/rcdlstatus/vahan/rcDlHome.xhtml';
const REQUEST_TIMEOUT = 15000;

function extractViewState(html) {
  const match = html.match(/name="javax\.faces\.ViewState"\s+value="([^"]+)"/i);
  return match ? match[1] : '';
}

function extractFirstButtonId(html) {
  const $ = cheerio.load(html);
  const btn = $('button[id^="form_rcdl:j_idt"]').first();
  return btn.attr('id') || '';
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

  if (!/^[A-Z]{2}\d{2}\d{4,15}$/.test(cleaned)) {
    return { verified: false, error: 'Invalid DL number format (expected: MH0220110012345)', formatValid: false };
  }

  let browser;
  try {
    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      timeout: 30000
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    await page.goto(PARIVAHAN_BASE + '/?pur_cd=102', { waitUntil: 'networkidle2', timeout: 30000 });

    await page.waitForSelector('input[id*="tf_reg_no1"]', { timeout: 15000 });
    await page.click('input[id*="tf_reg_no1"]', { clickCount: 3 });
    await page.type('input[id*="tf_reg_no1"]', cleaned, { delay: 20 });
    await page.waitForTimeout(300);

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
      await page.keyboard.press('Enter');
    }

    try {
      await page.waitForSelector('table, span:has-text("does not exist"), span:has-text("No Record")', { timeout: 20000 });
    } catch (_) {}
    await page.waitForTimeout(2000);

    var pageText = await page.evaluate(function () { return document.body.innerText; });

    if (pageText.includes('does not exist') || pageText.includes('No Record')) {
      return { verified: false, found: false, error: 'No record found in RTO database', formatValid: true };
    }

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
      error: hasData ? '' : 'Could not parse RTO response from browser',
      formatValid: true
    };
  } catch (err) {
    return {
      verified: false,
      found: false,
      error: 'Unable to reach RTO portal via browser.',
      formatValid: true,
      manualUrl: PARIVAHAN_BASE + '/?pur_cd=102',
      systemError: err.message
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
  if (!/^[A-Z]{2}\d{2}\d{4,15}$/.test(cleaned)) {
    return { verified: false, error: 'Invalid DL number format (expected: MH0220110012345)', formatValid: false };
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
  params.append('form_rcdl:tf_reg_no1', dlNumber);
  params.append('form_rcdl:tf_reg_no2', '');
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
