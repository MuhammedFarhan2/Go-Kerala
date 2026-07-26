const OLLAMA_URL = 'http://127.0.0.1:11434';
const OLLAMA_MODEL = 'deepseek-coder';
const REQUEST_TIMEOUT = 60000;

async function analyzeSubmission(submission, rtoResults) {
  const aiAvailable = await checkOllama();

  if (!aiAvailable) {
    return generateBasicAnalysis(submission, rtoResults);
  }

  try {
    return await analyzeWithOllama(submission, rtoResults);
  } catch (err) {
    return generateBasicAnalysis(submission, rtoResults);
  }
}

async function checkOllama() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(function () {
      controller.abort();
    }, 3000);

    const res = await fetch(OLLAMA_URL + '/api/tags', {
      signal: controller.signal
    });

    clearTimeout(timer);
    return res.ok;
  } catch (err) {
    return false;
  }
}

async function analyzeWithOllama(submission, rtoResults) {
  const fields = submission && submission.fields ? submission.fields : {};
  const summary = submission && submission.summary ? submission.summary : {};

  const dlNumber = fields['owner-heavy-licence-photo-name-1'] ||
    fields['owner-heavy-licence-photo-name-2'] || 'Not provided';
  const ownerName = summary.ownerName || fields['owner-name'] || 'Not provided';
  const companyName = summary.companyName || fields['owner-company-name'] || 'Not provided';

  let rtoSummary = 'RTO verification was not performed.';
  if (rtoResults && rtoResults.dl) {
    rtoSummary = 'DL verification: ' + (rtoResults.dl.verified ? 'VERIFIED' : 'FAILED') +
      (rtoResults.dl.details ? ' | Name on DL: ' + (rtoResults.dl.details['Owner Name'] || rtoResults.dl.details['Owner name'] || 'N/A') : '') +
      (rtoResults.dl.error ? ' | Error: ' + rtoResults.dl.error : '');
  }

  const prompt = [
    'You are a document verification assistant for a vehicle rental platform called VECT Movers.',
    '',
    'An owner has submitted the following details for verification:',
    '- Company Name: ' + companyName,
    '- Owner Name: ' + ownerName,
    '- Driving License Number: ' + dlNumber,
    '',
    rtoSummary,
    '',
    'Based on the above information, provide a brief analysis in this exact JSON format:',
    '{',
    '  "recommendation": "accept" or "reject" or "manual_review",',
    '  "confidence": 0-100,',
    '  "reason": "one sentence explanation"',
    '}',
    '',
    'Return ONLY the JSON object, no other text.'
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(function () {
    controller.abort();
  }, REQUEST_TIMEOUT);

  try {
    const res = await fetch(OLLAMA_URL + '/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        options: { temperature: 0.1 }
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error('Ollama returned status ' + res.status);
    }

    const data = await res.json();
    const responseText = String(data.response || '').trim();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('Could not parse AI response');
  } catch (err) {
    if (err.name === 'AbortError') {
      return generateBasicAnalysis(submission, rtoResults);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function generateBasicAnalysis(submission, rtoResults) {
  const fields = submission && submission.fields ? submission.fields : {};
  const summary = submission && submission.summary ? submission.summary : {};

  const hasProfilePhoto = Boolean(
    summary.images && summary.images.profilePhotoUrl ||
    fields['owner-profile-photo-url'] ||
    fields['owner-profile-photo']
  );
  const hasAadhaar = Boolean(
    summary.images && summary.images.aadhaarPhotoUrl ||
    fields['owner-aadhaar-photo-url']
  );
  const hasLicence = Boolean(
    fields['owner-heavy-licence-photo-name-1'] ||
    fields['owner-heavy-licence-photo-name-2'] ||
    summary.documents && summary.documents.heavyLicence
  );
  const hasCompany = Boolean(
    summary.companyName || fields['owner-company-name']
  );

  let recommendation = 'manual_review';
  let reason = [];
  let confidence = 50;

  if (rtoResults && rtoResults.dl && rtoResults.dl.verified) {
    reason.push('DL verified against RTO database');
    confidence += 30;
  }

  if (rtoResults && rtoResults.dl && rtoResults.dl.verified === false && rtoResults.dl.found === false) {
    reason.push('DL not found in RTO database');
    recommendation = 'reject';
    confidence = 90;
  }

  if (hasCompany) reason.push('Company name provided');
  if (hasProfilePhoto) reason.push('Profile photo present');
  if (hasAadhaar) reason.push('Aadhaar uploaded');
  if (hasLicence) reason.push('Driving licence uploaded');

  const missingDocs = [];
  if (!hasLicence) missingDocs.push('driving licence');
  if (!hasAadhaar) missingDocs.push('aadhaar');
  if (!hasProfilePhoto) missingDocs.push('profile photo');
  if (!hasCompany) missingDocs.push('company name');

  if (missingDocs.length > 2) {
    recommendation = 'reject';
    confidence = Math.min(confidence, 30);
    reason.push('Missing critical documents: ' + missingDocs.join(', '));
  } else if (missingDocs.length > 0) {
    reason.push('Missing: ' + missingDocs.join(', '));
  } else if (confidence >= 70) {
    recommendation = 'accept';
  }

  return {
    recommendation: recommendation,
    confidence: Math.min(confidence, 100),
    reason: reason.join('. ') + '.'
  };
}

module.exports = {
  analyzeSubmission
};
