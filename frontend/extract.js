const fs = require('fs');
const ownerHtml = fs.readFileSync('owner.html', 'utf8');

const panelRegex = /<div class="owner-auth-panel">[\s\S]*?<\/div>\s*<\/section>/;
const match = ownerHtml.match(panelRegex);
if(match) {
  let panelHtml = match[0].replace('</section>', '').trim();
  let indexHtml = fs.readFileSync('index.html', 'utf8');
  const iframeRegex = /<iframe src="owner\.html\?mode=login&embed=true"[\s\S]*?<\/iframe>/;
  indexHtml = indexHtml.replace(iframeRegex, panelHtml);
  
  if (!indexHtml.includes('<script src="auth.js">')) {
    indexHtml = indexHtml.replace('</body>', '  <script src="https://accounts.google.com/gsi/client" async defer></script>\n  <script src="auth.js"></script>\n</body>');
  }
  if (!indexHtml.includes('name="google-signin-client_id"')) {
    indexHtml = indexHtml.replace('</head>', '  <meta name="google-signin-client_id" content="743689462629-ogfmkvkp39jsk49piia08ffsmsrh8qus.apps.googleusercontent.com">\n  <meta name="api-base-url" content="https://go-kerala-backend.onrender.com">\n</head>');
  }

  fs.writeFileSync('index.html', indexHtml);
  console.log('Replaced iframe with auth panel in index.html');
}

const scriptRegex = /<script>\s*\(function \(\) \{\s*const SHARED_BANNER_STORAGE_KEY([\s\S]*?)syncAuthMode\(\);\s*if \(window\.Swiper\) \{[\s\S]*?\}\)\(\);\s*<\/script>/;
const scriptMatch = ownerHtml.match(scriptRegex);

if (scriptMatch) {
  let scriptContent = `(function () {\n  const SHARED_BANNER_STORAGE_KEY` + scriptMatch[1] + `syncAuthMode();\n\n  if (window.Swiper) {\n    const ownerBannerNode = document.getElementById('ownerBanner');\n    if (ownerBannerNode) {\n      new Swiper(ownerBannerNode, {\n        loop: true,\n        speed: 700,\n        autoplay: {\n          delay: 3000,\n          disableOnInteraction: false\n        },\n        slidesPerView: 1,\n        pagination: {\n          el: '.owner-auth-banner-pagination',\n          clickable: true\n        }\n      });\n    }\n  }\n\n  window.addEventListener('load', function () {\n    initializeGoogleAuth();\n  });\n})();`;
  
  scriptContent = scriptContent.replace(/subtitleText\.innerHTML = ([\s\S]*?);/g, `
    subtitleText.innerHTML = isEmailReview
      ? 'Enter your updated email address to continue.'
      : isLogin
      ? 'Need an account? <a href="#" class="owner-auth-inline-link" data-owner-auth-switch-link>Create account</a>'
      : 'Already have an account? <a href="#" class="owner-auth-inline-link" data-owner-auth-switch-link>Log in</a>';

    const switchLink = subtitleText.querySelector('[data-owner-auth-switch-link]');
    if (switchLink) {
      switchLink.addEventListener('click', function(e) {
        e.preventDefault();
        authMode = isLogin ? 'register' : 'login';
        syncAuthMode();
        initializeGoogleAuth();
      });
    }
  `);

  scriptContent = scriptContent.replace(/\(window\.top \|\| window\)\.location\.href/g, 'window.location.href');

  fs.writeFileSync('auth.js', scriptContent);
  console.log('Created auth.js');
}

let newOwnerHtml = ownerHtml.replace(scriptRegex, '<script src="auth.js"></script>');
fs.writeFileSync('owner.html', newOwnerHtml);
console.log('Updated owner.html');
