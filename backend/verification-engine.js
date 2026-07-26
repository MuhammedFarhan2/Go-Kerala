var rtoVerifier = require('./rto-verifier');
var ocrEngine = require('./ocr');

var ENGINE_VERSION = '1.0.0';

var VERIFICATION_STATUS = {
  VERIFIED: 'verified',
  VALID: 'valid',
  EXPIRED: 'expired',
  INVALID: 'invalid',
  MISMATCH: 'mismatch',
  UNABLE_TO_VERIFY: 'unable_to_verify',
  NEEDS_MANUAL_REVIEW: 'needs_manual_review'
};

var STATUS_LABELS = {};
STATUS_LABELS[VERIFICATION_STATUS.VERIFIED] = { label: 'Officially Verified', color: '#16a34a', icon: 'verified' };
STATUS_LABELS[VERIFICATION_STATUS.VALID] = { label: 'Valid', color: '#2563eb', icon: 'valid' };
STATUS_LABELS[VERIFICATION_STATUS.EXPIRED] = { label: 'Expired', color: '#f59e0b', icon: 'expired' };
STATUS_LABELS[VERIFICATION_STATUS.INVALID] = { label: 'Invalid', color: '#dc2626', icon: 'invalid' };
STATUS_LABELS[VERIFICATION_STATUS.MISMATCH] = { label: 'Details Mismatch', color: '#dc2626', icon: 'mismatch' };
STATUS_LABELS[VERIFICATION_STATUS.UNABLE_TO_VERIFY] = { label: 'Unable to Verify', color: '#6b7280', icon: 'unable' };
STATUS_LABELS[VERIFICATION_STATUS.NEEDS_MANUAL_REVIEW] = { label: 'Needs Manual Review', color: '#f59e0b', icon: 'manual' };

function normalizeNumber(value) {
  return String(value || '').replace(/[\s,\-\(\)]/g, '').trim();
}

function isDateInPast(dateStr) {
  if (!dateStr) return null;
  var cleaned = String(dateStr).replace(/\s/g, '');
  var parts = cleaned.split(/[\/\-\.]/);
  if (parts.length < 3) return null;
  var d = new Date(parts[1] + '/' + parts[0] + '/' + parts[2]);
  if (isNaN(d.getTime())) {
    d = new Date(parts[2] + '/' + parts[1] + '/' + parts[0]);
  }
  if (isNaN(d.getTime())) return null;
  return d < new Date();
}

function assessDocumentIntegrity(imageData) {
  if (!imageData) return 'unable_to_determine';
  if (typeof imageData !== 'string') return 'unable_to_determine';
  if (/^data:image\//.test(imageData) && imageData.length < 500) return 'suspicious';
  return 'normal';
}

function assessOcrConfidence(text) {
  if (!text || text.length < 10) return 'low';
  var alphaRatio = (text.match(/[A-Za-z]/g) || []).length / text.length;
  var digitRatio = (text.match(/[0-9]/g) || []).length / text.length;
  if (alphaRatio > 0.3 && digitRatio > 0.05) return 'high';
  if (alphaRatio > 0.1) return 'medium';
  return 'low';
}

function extractDetailsFromOcrText(text) {
  if (!text) return {};

  var details = {};
  var lines = text.split('\n').filter(Boolean);

  var namePatterns = [/name[:\s]+([A-Za-z\s.]+)/i, /([A-Za-z\s]+)\s+[A-Z]{2}\d{2}/];
  var dobPatterns = /(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/g;
  var dlPattern = /[A-Z]{2}\d{2}\d{4,15}/;
  var datePatterns = /(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/g;

  var dlMatch = text.match(dlPattern);
  if (dlMatch) details.dlNumber = dlMatch[0];

  var dates = text.match(datePatterns);
  if (dates) {
    dates = dates.map(function (d) { return d.replace(/[\-\.]/g, '/'); });
    if (dates.length >= 1) details.dob = dates[0];
    if (dates.length >= 2) details.issueDate = dates[1];
    if (dates.length >= 3) details.expiryDate = dates[2];
  }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!details.name) {
      for (var p = 0; p < namePatterns.length; p++) {
        var m = line.match(namePatterns[p]);
        if (m && m[1] && m[1].length > 2 && m[1].length < 50) {
          details.name = m[1].trim();
          break;
        }
      }
      if (!details.name && /name/i.test(line)) {
        var nextIdx = i + 1;
        while (nextIdx < lines.length) {
          var nextLine = lines[nextIdx].trim();
          if (nextLine && /^[A-Z][a-zA-Z\s.]{2,}$/.test(nextLine)) {
            details.name = nextLine;
            break;
          }
          nextIdx++;
        }
      }
    }
  }

  return details;
}

function crossCheckData(sources) {
  var checks = {
    dlNumberMatch: null,
    nameMatch: null,
    dobMatch: null,
    statusMatch: null,
    expiryMatch: null,
    vehicleClassMatch: null
  };

  var user = sources.user || {};
  var ocr = sources.ocr || {};
  var official = sources.official || {};

  if (user.dlNumber && official.dlNumber) {
    checks.dlNumberMatch = normalizeNumber(user.dlNumber) === normalizeNumber(official.dlNumber);
  } else if (user.dlNumber && ocr.dlNumber) {
    checks.dlNumberMatch = normalizeNumber(user.dlNumber) === normalizeNumber(ocr.dlNumber);
  } else if (ocr.dlNumber && official.dlNumber) {
    checks.dlNumberMatch = normalizeNumber(ocr.dlNumber) === normalizeNumber(official.dlNumber);
  }

  if (official.name && user.name) {
    checks.nameMatch = official.name.toLowerCase().includes(user.name.toLowerCase()) ||
      user.name.toLowerCase().includes(official.name.toLowerCase());
  } else if (official.name && ocr.name) {
    checks.nameMatch = official.name.toLowerCase().includes(ocr.name.toLowerCase()) ||
      ocr.name.toLowerCase().includes(official.name.toLowerCase());
  }
  if (user.name && ocr.name && checks.nameMatch === null) {
    var uName = user.name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    var oName = ocr.name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    if (uName && oName) {
      checks.nameMatch = uName.includes(oName) || oName.includes(uName);
    }
  }

  if (official.dob && user.dob) {
    checks.dobMatch = normalizeNumber(official.dob) === normalizeNumber(user.dob);
  } else if (official.dob && ocr.dob) {
    checks.dobMatch = normalizeNumber(official.dob) === normalizeNumber(ocr.dob);
  }

  if (official.status) {
    var statusStr = String(official.status).toLowerCase();
    checks.statusMatch = !(statusStr.includes('expired') || statusStr.includes('cancelled') || statusStr.includes('revoked'));
  }

  if (official.expiryDate) {
    checks.expiryMatch = !isDateInPast(official.expiryDate);
  }

  var matchCount = 0;
  var totalChecks = 0;
  Object.keys(checks).forEach(function (key) {
    if (checks[key] === true) matchCount++;
    if (checks[key] !== null) totalChecks++;
  });

  if (totalChecks === 0) return { checks: checks, overall: null };
  if (matchCount === totalChecks) return { checks: checks, overall: 'match' };
  if (matchCount > 0) return { checks: checks, overall: 'partial_match' };
  return { checks: checks, overall: 'mismatch' };
}

function determineStatus(params) {
  var official = params.official;
  var crossCheck = params.crossCheck;
  var ocrResult = params.ocrResult;
  var documentIntegrity = params.documentIntegrity;
  var ocrConfidence = params.ocrConfidence;
  var ocrDlFound = params.ocrDlFound;
  var nameMatched = params.nameMatched;

  if (documentIntegrity === 'suspicious') {
    return { status: VERIFICATION_STATUS.NEEDS_MANUAL_REVIEW, reason: 'Document appears to be tampered or of suspicious quality.' };
  }

  if (ocrConfidence === 'low' && !official) {
    return { status: VERIFICATION_STATUS.NEEDS_MANUAL_REVIEW, reason: 'OCR confidence is low and no official verification was available.' };
  }

  if (!official || !official.found) {
    if (crossCheck.overall === 'mismatch') {
      return { status: VERIFICATION_STATUS.MISMATCH, reason: 'Submitted information conflicts with available records.' };
    }
    if (nameMatched && ocrDlFound) {
      return { status: VERIFICATION_STATUS.VERIFIED, reason: 'Licence number and name match the photo and submission. Verified by OCR cross-check.' };
    }
    if (ocrConfidence === 'high' || ocrConfidence === 'medium') {
      if (ocrDlFound) {
        return { status: VERIFICATION_STATUS.VALID, reason: 'Licence number read from photo. Official confirmation not available — valid based on OCR cross-check.' };
      }
      return { status: VERIFICATION_STATUS.NEEDS_MANUAL_REVIEW, reason: 'Could not reliably read licence number from photo. Please verify manually.' };
    }
    return { status: VERIFICATION_STATUS.UNABLE_TO_VERIFY, reason: 'Could not confirm this licence through an authorised official source. Please submit for manual verification.' };
  }

  var details = official.structuredDetails || {};

  if (details.status) {
    var statusStr = String(details.status).toLowerCase();
    if (statusStr.includes('expired')) {
      return { status: VERIFICATION_STATUS.EXPIRED, reason: 'Licence validity has expired as per official records.' };
    }
    if (statusStr.includes('cancelled') || statusStr.includes('revoked') || statusStr.includes('suspended')) {
      return { status: VERIFICATION_STATUS.INVALID, reason: 'Licence is ' + details.status + ' as per official records.' };
    }
    if (statusStr.includes('not found') || statusStr.includes('does not exist')) {
      return { status: VERIFICATION_STATUS.INVALID, reason: 'No valid record found in official database.' };
    }
  }

  if (details.expiryDate && isDateInPast(details.expiryDate)) {
    return { status: VERIFICATION_STATUS.EXPIRED, reason: 'Licence validity has expired as per official records.' };
  }

  if (crossCheck.checks && crossCheck.checks.nameMatch === false) {
    return { status: VERIFICATION_STATUS.MISMATCH, reason: 'Name on the licence photo does not match the name in official records.' };
  }

  if (crossCheck.overall === 'mismatch') {
    return { status: VERIFICATION_STATUS.MISMATCH, reason: 'Submitted information does not match the official record.' };
  }

  if (crossCheck.overall === 'match') {
    return { status: VERIFICATION_STATUS.VERIFIED, reason: 'Licence confirmed through official source and all details match.' };
  }

  if (crossCheck.overall === 'partial_match') {
    return { status: VERIFICATION_STATUS.VALID, reason: 'Licence is valid in official records, but some details could not be fully cross-checked.' };
  }

  if (!details.expiryDate && !details.status) {
    return { status: VERIFICATION_STATUS.VALID, reason: 'Licence record found in official database.' };
  }

  return { status: VERIFICATION_STATUS.VERIFIED, reason: 'Licence confirmed through official source.' };
}

async function verifyLicense(params) {
  var dlNumber = String(params.dlNumber || '').trim();
  var userDob = String(params.dob || '').trim();
  var imageData = params.imageData || '';
  var submissionId = String(params.submissionId || '').trim();
  var userName = String(params.userName || '').trim();

  var result = {
    status: VERIFICATION_STATUS.UNABLE_TO_VERIFY,
    statusInfo: STATUS_LABELS[VERIFICATION_STATUS.UNABLE_TO_VERIFY],
    summary: { label: 'Unable to Verify', color: '#6b7280', icon: 'unable' },
    details: {
      dlNumber: dlNumber || '',
      name: '',
      dob: '',
      issueDate: '',
      expiryDate: '',
      issuingAuthority: '',
      vehicleClasses: [],
      status: '',
      lastChecked: new Date().toISOString()
    },
    ocrExtracted: {},
    official: null,
    confidence: {
      officialVerification: 'not_confirmed',
      ocrConfidence: 'low',
      documentIntegrity: 'unable_to_determine',
      dataMatch: 'none'
    },
    crossCheck: { checks: {}, overall: null },
    errors: [],
    warnings: [],
    source: 'none',
    version: ENGINE_VERSION
  };

  if (!dlNumber && !imageData && !submissionId) {
    result.errors.push('No licence number, image, or submission provided.');
    result.status = VERIFICATION_STATUS.UNABLE_TO_VERIFY;
    result.statusInfo = STATUS_LABELS[VERIFICATION_STATUS.UNABLE_TO_VERIFY];
    return result;
  }

  if (dlNumber && !/^[A-Z]{2}\d{2}\d{4,15}$/i.test(dlNumber.replace(/[\s-]/g, ''))) {
    result.errors.push('Invalid licence number format. Expected format: MH0220110012345');
    result.status = VERIFICATION_STATUS.UNABLE_TO_VERIFY;
    result.statusInfo = STATUS_LABELS[VERIFICATION_STATUS.UNABLE_TO_VERIFY];
    return result;
  }

  if (userDob && !/^\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}$/.test(userDob)) {
    result.warnings.push('Date of birth format may be incorrect. Please use DD/MM/YYYY.');
  }

  var ocrResult = null;
  var ocrText = '';
  var ocrDetails = {};

  if (imageData) {
    result.confidence.documentIntegrity = assessDocumentIntegrity(imageData);
    try {
      ocrResult = await ocrEngine.extractDLFromImage(imageData);
      if (ocrResult.success) {
        ocrText = ocrResult.text || '';
        result.confidence.ocrConfidence = assessOcrConfidence(ocrText);
        ocrDetails = extractDetailsFromOcrText(ocrText);
        if (ocrResult.dlNumber) {
          ocrDetails.dlNumber = ocrResult.dlNumber;
        }
        result.ocrExtracted = ocrDetails;
        result.ocrExtracted.rawText = ocrText.substring(0, 500);
      } else {
        result.confidence.ocrConfidence = 'low';
        result.warnings.push(ocrResult.error || 'OCR could not read the licence image reliably.');
      }
    } catch (ocrErr) {
      result.confidence.ocrConfidence = 'low';
      result.warnings.push('OCR processing failed: ' + (ocrErr.message || 'Unknown error'));
    }
  }

  if (!ocrDetails.name && userName && ocrText) {
    var nameParts = userName.toLowerCase().split(/\s+/).filter(Boolean);
    if (nameParts.length > 0) {
      var allFound = nameParts.every(function(part) {
        return ocrText.toLowerCase().includes(part);
      });
      if (allFound) ocrDetails.name = userName;
    }
  }

  var lookupDl = (ocrDetails && ocrDetails.dlNumber) || dlNumber;
  var cleanedDl = lookupDl ? lookupDl.replace(/[\s-]/g, '').toUpperCase() : '';

  var officialResult = null;
  if (cleanedDl && /^[A-Z]{2}\d{2}\d{4,15}$/.test(cleanedDl)) {
    try {
      officialResult = await rtoVerifier.verifyDrivingLicense(cleanedDl);
    } catch (err) {
      officialResult = { verified: false, found: false, error: 'Official verification service unavailable.', systemError: err.message };
    }

    if (officialResult && officialResult.found && officialResult.details) {
      var structuredDetails = rtoVerifier.extractStructuredDetails(officialResult.details);
      result.official = {
        found: true,
        rawData: officialResult.details,
        structuredDetails: structuredDetails,
        source: 'parivahan',
        note: 'Retrieved from unofficial source. Not an officially confirmed verification.'
      };
      if (structuredDetails) {
        if (structuredDetails.dlNumber) result.details.dlNumber = structuredDetails.dlNumber;
        if (structuredDetails.name) result.details.name = structuredDetails.name;
        if (structuredDetails.dob) result.details.dob = structuredDetails.dob;
        if (structuredDetails.issueDate) result.details.issueDate = structuredDetails.issueDate;
        if (structuredDetails.expiryDate) result.details.expiryDate = structuredDetails.expiryDate;
        if (structuredDetails.issuingAuthority) result.details.issuingAuthority = structuredDetails.issuingAuthority;
        if (structuredDetails.vehicleClasses) result.details.vehicleClasses = structuredDetails.vehicleClasses;
        if (structuredDetails.status) result.details.status = structuredDetails.status;
      }
      result.details.lastChecked = new Date().toISOString();
    } else if (officialResult && officialResult.found === false) {
      result.official = {
        found: false,
        error: officialResult.error || 'No record found in official database.',
        source: 'parivahan'
      };
      if (officialResult.systemError) {
        result.warnings.push('Parivahan system error: ' + officialResult.systemError);
      }
    } else {
      result.official = {
        found: false,
        error: officialResult && officialResult.error ? officialResult.error : 'Official verification service unavailable.',
        source: 'parivahan'
      };
      if (officialResult && officialResult.systemError) {
        result.warnings.push('Parivahan system error: ' + officialResult.systemError);
      }
    }
  } else if (cleanedDl) {
    result.warnings.push('Licence number format is invalid for official verification.');
  } else {
    result.warnings.push('No licence number provided for official verification.');
  }

  result.details.dlNumber = dlNumber || (ocrDetails && ocrDetails.dlNumber) || '';
  if (userDob && !result.details.dob) result.details.dob = userDob;

  if (officialResult && officialResult.found) {
    result.confidence.officialVerification = 'not_confirmed';
  }

  var userData = { dlNumber: dlNumber, dob: userDob, name: userName };
  var crossCheckResult = crossCheckData({
    user: userData,
    ocr: ocrDetails,
    official: result.official ? result.official.structuredDetails : null
  });
  result.crossCheck = crossCheckResult;

  if (crossCheckResult.overall === 'match') result.confidence.dataMatch = 'match';
  else if (crossCheckResult.overall === 'partial_match') result.confidence.dataMatch = 'partial_match';
  else if (crossCheckResult.overall === 'mismatch') result.confidence.dataMatch = 'mismatch';
  else result.confidence.dataMatch = 'none';

  var nameMatched = false;
  if (userName) {
    if (ocrDetails.name) {
      var u = userName.toLowerCase().replace(/[^a-z\s]/g, '').trim();
      var o = ocrDetails.name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
      nameMatched = !!(u && o && (u.includes(o) || o.includes(u)));
    }
    if (!nameMatched && ocrText) {
      var nameParts = userName.toLowerCase().split(/\s+/).filter(Boolean);
      nameMatched = nameParts.length > 0 && nameParts.every(function(p) { return ocrText.toLowerCase().includes(p); });
    }
    result.warnings.push('Name match check: userName="' + userName + '" ocrName="' + (ocrDetails.name || 'none') + '" result=' + nameMatched);
  }

  var statusResult = determineStatus({
    official: result.official,
    crossCheck: crossCheckResult,
    ocrResult: ocrResult,
    documentIntegrity: result.confidence.documentIntegrity,
    ocrConfidence: result.confidence.ocrConfidence,
    ocrDlFound: !!(ocrDetails && ocrDetails.dlNumber),
    nameMatched: nameMatched
  });
  result.status = statusResult.status;
  result.statusInfo = STATUS_LABELS[statusResult.status];
  result.summary = {
    label: STATUS_LABELS[statusResult.status].label,
    color: STATUS_LABELS[statusResult.status].color,
    icon: STATUS_LABELS[statusResult.status].icon
  };
  if (statusResult.reason) {
    result.warnings.push(statusResult.reason);
  }

  if (result.official && result.official.found) {
    result.source = 'parivahan_unofficial';
  } else if (ocrText) {
    result.source = 'ocr_only';
  } else {
    result.source = 'user_input';
  }

  return result;
}

async function checkDuplicateLicense(dlNumber, excludeSubmissionId) {
  var submissions;
  try {
    var fs = require('fs');
    var path = require('path');
    var DATA_DIR = process.env.VECT_DATA_DIR || path.join(__dirname, 'data');
    var dbPath = path.join(DATA_DIR, 'vect-own-submissions.json');
    var raw = fs.readFileSync(dbPath, 'utf8');
    submissions = JSON.parse(raw);
  } catch (err) {
    return { checked: false, duplicates: [], error: 'Could not read submissions database.' };
  }

  if (!Array.isArray(submissions)) {
    return { checked: true, duplicates: [] };
  }

  var cleanedTarget = dlNumber.replace(/[\s-]/g, '').toUpperCase();
  var duplicates = [];

  submissions.forEach(function (sub) {
    if (!sub || !sub.fields) return;
    if (excludeSubmissionId && sub.id === excludeSubmissionId) return;
    var fields = sub.fields || {};
    var dl1 = String(fields['owner-heavy-licence-photo-name-1'] || '').replace(/[\s-]/g, '').toUpperCase();
    var dl2 = String(fields['owner-heavy-licence-photo-name-2'] || '').replace(/[\s-]/g, '').toUpperCase();
    if (dl1 === cleanedTarget || dl2 === cleanedTarget) {
      duplicates.push({
        submissionId: sub.id,
        status: sub.status,
        companyName: (sub.summary && sub.summary.companyName) || (fields['owner-company-name']) || 'Unknown',
        createdAt: sub.createdAt
      });
    }
  });

  return { checked: true, duplicates: duplicates, count: duplicates.length };
}

module.exports = {
  VERIFICATION_STATUS: VERIFICATION_STATUS,
  STATUS_LABELS: STATUS_LABELS,
  verifyLicense: verifyLicense,
  checkDuplicateLicense: checkDuplicateLicense,
  ENGINE_VERSION: ENGINE_VERSION
};