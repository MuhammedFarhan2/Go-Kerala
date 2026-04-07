(function () {
  const loader = document.getElementById('page-loader');
  const routeLinks = Array.from(document.querySelectorAll('a[href^="route.html"]'));
  const hasHomeBanner = Boolean(document.getElementById('flipBanner'));

  function showPageLoader() {
    if (loader) {
      loader.classList.add('is-active');
      loader.setAttribute('aria-hidden', 'false');
    }

    document.documentElement.classList.add('show-page-loader');
    sessionStorage.setItem('page-loader', 'on');
  }

  function hidePageLoader() {
    document.documentElement.classList.remove('show-page-loader');

    if (loader) {
      loader.classList.remove('is-active');
      loader.setAttribute('aria-hidden', 'true');
    }

    sessionStorage.removeItem('page-loader');
  }

  function waitForHomeBannerReady(callback) {
    if (!hasHomeBanner) {
      callback();
      return;
    }

    const bannerImages = Array.from(document.querySelectorAll('.banner-img'));
    const imagesReady = bannerImages.every(function (image) {
      return image.complete;
    });

    if (window.__homeBannerReady || imagesReady) {
      callback();
      return;
    }

    const handleReady = function () {
      callback();
    };

    window.addEventListener('home-banner-ready', handleReady, { once: true });

    window.setTimeout(function () {
      window.removeEventListener('home-banner-ready', handleReady);
      callback();
    }, 2500);
  }

  routeLinks.forEach(function (link) {
    link.addEventListener('click', function (event) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      showPageLoader();
    });
  });

  window.addEventListener('pageshow', function () {
    if (sessionStorage.getItem('page-loader') === 'on') {
      waitForHomeBannerReady(hidePageLoader);
    } else {
      hidePageLoader();
    }
  });

  window.addEventListener('load', function () {
    window.requestAnimationFrame(function () {
      waitForHomeBannerReady(hidePageLoader);
    });
  });

  window.addEventListener('pagehide', function () {
    sessionStorage.setItem('page-loader', 'on');
  });

  window.addEventListener('beforeunload', function () {
    sessionStorage.setItem('page-loader', 'on');
  });
})();

(function () {
  const accountBtn = document.getElementById('account-btn');
  const accountPanel = document.getElementById('account-panel');
  const backdrop = document.getElementById('account-backdrop');
  const header = document.querySelector('.header');

  function openPanel() {
    header.classList.add('panel-open');
    accountPanel.classList.add('is-open');
    accountPanel.setAttribute('aria-hidden', 'false');
    backdrop.classList.add('is-visible');
    backdrop.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closePanel() {
    header.classList.remove('panel-open');
    accountPanel.classList.remove('is-open');
    accountPanel.setAttribute('aria-hidden', 'true');
    backdrop.classList.remove('is-visible');
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  accountBtn.addEventListener('click', function () {
    if (accountPanel.classList.contains('is-open')) {
      closePanel();
    } else {
      openPanel();
    }
  });
  backdrop.addEventListener('click', closePanel);
})();

(function () {
  const toggles = Array.from(document.querySelectorAll('.route-dropdown-toggle'));
  const searchInputs = Array.from(document.querySelectorAll('.route-search-input'));
  const counterLabel = document.querySelector('[data-bus-counter-label]');
  const pageParams = new URLSearchParams(window.location.search);
  const routeScope = pageParams.get('scope');
  const fromFieldLabel = document.querySelector('[data-route-label="from"]');
  const toField = document.querySelector('[data-route-field="to"]');
  const fromInput = document.querySelector('[data-route-input="from"]');
  const toInput = document.querySelector('[data-route-input="to"]');
  const routeFromKey = 'route-location-from';
  const routeToKey = 'route-location-to';
  let suppressedToggle = null;
  const singleLocationScopes = new Set(['excavator', 'backhoe']);

  if (counterLabel) {
    if (routeScope === 'truck') {
      counterLabel.textContent = 'Closed Body Truck/Trucks';
    } else if (routeScope === 'open-truck') {
      counterLabel.textContent = 'Open Body Truck/Trucks';
    } else if (routeScope === 'excavator') {
      counterLabel.textContent = 'Excavator/Excavators';
    } else if (routeScope === 'backhoe') {
      counterLabel.textContent = 'Backhoe Loader/Backhoe Loaders';
    }
  }

  if (singleLocationScopes.has(routeScope)) {
    if (fromFieldLabel) {
      fromFieldLabel.textContent = 'Location';
    }

    if (fromInput) {
      fromInput.placeholder = 'Location';
      fromInput.setAttribute('aria-label', 'Location');
    }

    if (toField) {
      toField.hidden = true;
    }
  }

  if (routeScope) {
    sessionStorage.setItem('route-scope', routeScope);
  }

  const submitLink = document.querySelector('.route-select-btn');
  if (submitLink && routeScope) {
    submitLink.href = `submit.html?scope=${encodeURIComponent(routeScope)}`;
  }

  const touristData = [
    'Munnar, Idukki, Kerala',
    'Ooty, Tamil Nadu',
    'Araku Valley, Andhra Pradesh',
    'Thekkady, Kerala',
    'Kodaikanal, Tamil Nadu',
    'Nandi Hills, Karnataka',
    'Coonoor, Tamil Nadu',
    'Coorg, Karnataka',
    'Kumarakom, Kerala',
    'Ponmudi, Kerala',
    'Munnar, Kerala',
    'Wayanad, Kerala',
    'Chikmagalur, Karnataka',
    'Manali, Himachal Pradesh',
    'Shimla, Himachal Pradesh',
    'Darjeeling, West Bengal',
    'Taj Mahal, Uttar Pradesh',
    'Red Fort, Delhi',
    'Qutub Minar, Delhi',
    'Hampi, Karnataka',
    'Mysore Palace, Karnataka',
    'Ajanta Caves, Maharashtra',
    'Ellora Caves, Maharashtra',
    'Munnar, Kerala',
    'Wayanad, Kerala',
    'Varkala, Kerala',
    'Alleppey, Kerala',
    'Rameswaram, Tamil Nadu',
    'Chennai, Tamil Nadu',
    'Coorg, Karnataka',
    'Gokarna, Karnataka',
    'Bangalore, Karnataka',
    'Hyderabad, Telangana',
    'Charminar, Telangana',
    'Tirupati Temple, Andhra Pradesh',
    'Visakhapatnam, Andhra Pradesh',
    'Panaji, Goa',
    'Calangute Beach, Goa',
    'Mumbai, Maharashtra',
    'Udaipur, Rajasthan',
    'Jaipur, Rajasthan',
    'Jaisalmer Fort, Rajasthan',
    'Kashi Vishwanath Temple, Uttar Pradesh',
    'Dehradun, Uttarakhand',
    'Jim Corbett National Park, Uttarakhand',
    'Golden Temple, Punjab',
    'Srinagar, Jammu & Kashmir',
    'Gulmarg, Jammu & Kashmir',
    'Leh, Ladakh',
    'Kolkata, West Bengal',
    'Kaziranga National Park, Assam',
    'Shillong, Meghalaya',
    'Gangtok, Sikkim',
    'Itanagar, Arunachal Pradesh',
    'Aizawl, Mizoram',
    'Kohima, Nagaland',
    'Imphal, Manipur',
    'Agartala, Tripura',
    'Bhopal, Madhya Pradesh',
    'Khajuraho Temples, Madhya Pradesh',
    'Patna, Bihar',
    'Bodh Gaya, Bihar',
    'Ranchi, Jharkhand',
    'Raipur, Chhattisgarh',
    'Bhubaneswar, Odisha',
    'Puri, Odisha',
    'Ahmedabad, Gujarat',
    'Kutch, Gujarat',
    'Chandigarh, Chandigarh',
    'Andhra Pradesh',
    'Arunachal Pradesh',
    'Assam',
    'Bihar',
    'Chhattisgarh',
    'Goa',
    'Gujarat',
    'Haryana',
    'Himachal Pradesh',
    'Jharkhand',
    'Karnataka',
    'Kerala',
    'Madhya Pradesh',
    'Maharashtra',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Odisha',
    'Punjab',
    'Rajasthan',
    'Sikkim',
    'Tamil Nadu',
    'Telangana',
    'Tripura',
    'Uttar Pradesh',
    'Uttarakhand',
    'West Bengal',
    'Delhi',
    'Jammu and Kashmir',
    'Ladakh',
    'Puducherry'
  ];
  const districtData = Array.from(new Set([
    'Alangad, Paravur, Ernakulam',
    'Ala, Chengannur, Alappuzha',
    'Alappuzha',
    'Alappuzha, Ambalappuzha, Alappuzha',
    'Ambalappuzha, Alappuzha',
    'Amballur, Kanayannur, Ernakulam',
    'Aikaranad North, Kunnathunad, Ernakulam',
    'Aikaranad South, Kunnathunad, Ernakulam',
    'Arakapady, Kunnathunad, Ernakulam',
    'Arakuzha, Muvattupuzha, Ernakulam',
    'Arattupuzha, Karthikappally, Alappuzha',
    'Aryad South, Ambalappuzha, Alappuzha',
    'Arookutty, Cherthala, Alappuzha',
    'Aroor, Cherthala, Alappuzha',
    'Asamannoor, Kunnathunad, Ernakulam',
    'Aluva, Aluva, Ernakulam',
    'Angamaly, Aluva, Ernakulam',
    'Ayyampuzha, Aluva, Ernakulam',
    'Bharanikkavu, Mavelikkara, Alappuzha',
    'Champakkulam, Champakkulam, Alappuzha',
    'Chellanam, Kochi, Ernakulam',
    'Chelamattom, Kunnathunad, Ernakulam',
    'Cheppad, Karthikappally, Alappuzha',
    'Cheranallur, Kanayannur, Ernakulam',
    'Cherthala, Cherthala, Alappuzha',
    'Cherthala North, Cherthala, Alappuzha',
    'Cherthala South, Cherthala, Alappuzha',
    'Cheriyanad, Chengannur, Alappuzha',
    'Cherthala, Alappuzha',
    'Cheriyakadavu, Kochi, Ernakulam',
    'Cheruthana, Karthikappally, Alappuzha',
    'Chengamanad, Aluva, Ernakulam',
    'Chendamangalam, Paravur, Ernakulam',
    'Chengannur, Alappuzha',
    'Chengannur, Chengannur, Alappuzha',
    'Chennithala, Mavelikkara, Alappuzha',
    'Chingoli, Karthikappally, Alappuzha',
    'Choornikkara, Aluva, Ernakulam',
    'Chowwara, Aluva, Ernakulam',
    'Chunakkara, Mavelikkara, Alappuzha',
    'Edakkattuvayal, Kanayannur, Ernakulam',
    'Edathala, Aluva, Ernakulam',
    'Edathua, Champakkulam, Alappuzha',
    'Edavanakkad, Kochi, Ernakulam',
    'Elanji, Muvattupuzha, Ernakulam',
    'Elamkunnapuzha, Kochi, Ernakulam',
    'Enanalloor, Muvattupuzha, Ernakulam',
    'Ennakkad, Chengannur, Alappuzha',
    'Eloor, Paravur, Ernakulam',
    'Eramalloor, Kothamangalam, Ernakulam',
    'Ernakulam',
    'Ezhikkara, Paravur, Ernakulam',
    'Ezhupunna, Cherthala, Alappuzha',
    'Haripad, Karthikappally, Alappuzha',
    'Idukki',
    'Irapuram, Kunnathunad, Ernakulam',
    'Kadakkarappally, Cherthala, Alappuzha',
    'Kadamakkudy, Kanayannur, Ernakulam',
    'Kalady, Aluva, Ernakulam',
    'Kalarkode, Ambalappuzha, Alappuzha',
    'Kalavoor, Ambalappuzha, Alappuzha',
    'Kainakary North, Champakkulam, Alappuzha',
    'Kainakary South, Champakkulam, Alappuzha',
    'Kaippattur, Kanayannur, Ernakulam',
    'Kakkanad, Kanayannur, Ernakulam',
    'Kalamassery, Kanayannur, Ernakulam',
    'Kalloorkkad, Muvattupuzha, Ernakulam',
    'Kandalloor, Karthikappally, Alappuzha',
    'Kanayannur, Ernakulam',
    'Kannamangalam, Mavelikkara, Alappuzha',
    'Kannur',
    'Kanjikkuzhi, Cherthala, Alappuzha',
    'Karthikappally, Alappuzha',
    'Karthikappally, Karthikappally, Alappuzha',
    'Karukutty, Aluva, Ernakulam',
    'Karumady, Ambalappuzha, Alappuzha',
    'Karuvatta, Karthikappally, Alappuzha',
    'Kasaragod',
    'Kattanam, Mavelikkara, Alappuzha',
    'Kavalam, Champakkulam, Alappuzha',
    'Kayamkulam, Karthikappally, Alappuzha',
    'Kedamangalam, Paravur, Ernakulam',
    'Kedavoor, Kothamangalam, Ernakulam',
    'Keecherry, Kanayannur, Ernakulam',
    'Keerampara, Kothamangalam, Ernakulam',
    'Keerikkad, Karthikappally, Alappuzha',
    'Kizhakkambalam, Kunnathunad, Ernakulam',
    'Kizhakkumbhagom, Aluva, Ernakulam',
    'Kodamthuruth, Cherthala, Alappuzha',
    'Kodanad, Kunnathunad, Ernakulam',
    'Kochi, Ernakulam',
    'Kochi, Kanayannur, Ernakulam',
    'Kokkothamangalam, Cherthala, Alappuzha',
    'Kollam',
    'Kombanad, Kunnathunad, Ernakulam',
    'Komalapuram, Ambalappuzha, Alappuzha',
    'Koothattukulam, Muvattupuzha, Ernakulam',
    'Kothamangalam, Ernakulam',
    'Kothamangalam, Kothamangalam, Ernakulam',
    'Kottappady, Kothamangalam, Ernakulam',
    'Kottayam',
    'Kottuvally, Paravur, Ernakulam',
    'Koovappady, Kunnathunad, Ernakulam',
    'Kozhikode',
    'Krishnapuram, Karthikappally, Alappuzha',
    'Kulayettikara, Kanayannur, Ernakulam',
    'Kumbalam, Kanayannur, Ernakulam',
    'Kumbalangy, Kochi, Ernakulam',
    'Kumarapuram, Karthikappally, Alappuzha',
    'Kunnumma, Champakkulam, Alappuzha',
    'Kunnathunad, Ernakulam',
    'Kunnathunad, Kunnathunad, Ernakulam',
    'Kunnukara, Paravur, Ernakulam',
    'Kurattissery, Chengannur, Alappuzha',
    'Kureekkad, Kanayannur, Ernakulam',
    'Kuthiathode, Cherthala, Alappuzha',
    'Kuttamangalam, Kothamangalam, Ernakulam',
    'Kuttampuzha, Kothamangalam, Ernakulam',
    'Kuttanad, Alappuzha',
    'Kuzhuppilly, Kochi, Ernakulam',
    'Malayattoor, Aluva, Ernakulam',
    'Malappuram',
    'Manakunnam, Kanayannur, Ernakulam',
    'Maneed, Muvattupuzha, Ernakulam',
    'Manjalloor, Muvattupuzha, Ernakulam',
    'Manjapra, Aluva, Ernakulam',
    'Mannanchery, Ambalappuzha, Alappuzha',
    'Mannar, Chengannur, Alappuzha',
    'Maradu, Kanayannur, Ernakulam',
    'Marady, Muvattupuzha, Ernakulam',
    'Marampilly, Kunnathunad, Ernakulam',
    'Mararikkulam North, Cherthala, Alappuzha',
    'Mattoor, Aluva, Ernakulam',
    'Mavelikkara, Alappuzha',
    'Mavelikkara, Mavelikkara, Alappuzha',
    'Mazhuvannoor, Kunnathunad, Ernakulam',
    'Memury, Muvattupuzha, Ernakulam',
    'Moothakunnam, Paravur, Ernakulam',
    'Muhamma, Cherthala, Alappuzha',
    'Mulakuzha, Chengannur, Alappuzha',
    'Mulamthuruthy, Kanayannur, Ernakulam',
    'Mulavoor, Muvattupuzha, Ernakulam',
    'Mulavukad, Kanayannur, Ernakulam',
    'Mookkannoor, Aluva, Ernakulam',
    'Muthukulam, Karthikappally, Alappuzha',
    'Muttar, Champakkulam, Alappuzha',
    'Muvattupuzha, Ernakulam',
    'Muvattupuzha, Muvattupuzha, Ernakulam',
    'Nayarambalam, Kochi, Ernakulam',
    'Nedumbassery, Aluva, Ernakulam',
    'Nedumudi, Champakkulam, Alappuzha',
    'Neelamperoor, Champakkulam, Alappuzha',
    'Neriamangalam, Kothamangalam, Ernakulam',
    'Njarackal, Kochi, Ernakulam',
    'Noornad, Mavelikkara, Alappuzha',
    'Onakkoor, Muvattupuzha, Ernakulam',
    'Palakkad',
    'Palakkuzha, Muvattupuzha, Ernakulam',
    'Palamel, Mavelikkara, Alappuzha',
    'Pallippad, Karthikappally, Alappuzha',
    'Pallippuram, Cherthala, Alappuzha',
    'Pallippuram, Kochi, Ernakulam',
    'Pandanad, Chengannur, Alappuzha',
    'Panavally, Cherthala, Alappuzha',
    'Parakkadavu, Aluva, Ernakulam',
    'Paravur, Ernakulam',
    'Paravur, Paravur, Ernakulam',
    'Pathanamthitta',
    'Pathirappally, Ambalappuzha, Alappuzha',
    'Pathiyoor, Karthikappally, Alappuzha',
    'Pattanakkad, Cherthala, Alappuzha',
    'Pattimattom, Kunnathunad, Ernakulam',
    'Perumbalam, Cherthala, Alappuzha',
    'Perumbavoor, Kunnathunad, Ernakulam',
    'Perungala, Mavelikkara, Alappuzha',
    'Pindimana, Kothamangalam, Ernakulam',
    'Piravom, Muvattupuzha, Ernakulam',
    'Pothanikkad, Kothamangalam, Ernakulam',
    'Pulinkunnu, Champakkulam, Alappuzha',
    'Puliyoor, Chengannur, Alappuzha',
    'Punnapra, Ambalappuzha, Alappuzha',
    'Purakkad, Ambalappuzha, Alappuzha',
    'Puthencruz, Kunnathunad, Ernakulam',
    'Puthenvelikkara, Paravur, Ernakulam',
    'Puthuppally, Karthikappally, Alappuzha',
    'Puthuvype, Kochi, Ernakulam',
    'Ramamangalam, Muvattupuzha, Ernakulam',
    'Ramankary, Champakkulam, Alappuzha',
    'Rayamangalam, Kunnathunad, Ernakulam',
    'Thaikattussery, Cherthala, Alappuzha',
    'Thakazhy, Champakkulam, Alappuzha',
    'Thalavady, Champakkulam, Alappuzha',
    'Thamarakkulam, Mavelikkara, Alappuzha',
    'Thanneermukkam, Cherthala, Alappuzha',
    'Thazhakara, Mavelikkara, Alappuzha',
    'Thekkekara, Mavelikkara, Alappuzha',
    'Thekkumbhagom, Aluva, Ernakulam',
    'Thirumarady, Muvattupuzha, Ernakulam',
    'Thiruvananthapuram',
    'Thiruvanvandoor, Chengannur, Alappuzha',
    'Thiruvankulam, Kanayannur, Ernakulam',
    'Thiruvaniyoor, Kunnathunad, Ernakulam',
    'Thrikkakara North, Kanayannur, Ernakulam',
    'Thrikkariyoor, Kothamangalam, Ernakulam',
    'Thrikkunnapuzha, Karthikappally, Alappuzha',
    'Thriperumthura, Mavelikkara, Alappuzha',
    'Thrippunithura, Kanayannur, Ernakulam',
    'Thrissur',
    'Thuravoor, Aluva, Ernakulam',
    'Thuravoor Thekku, Cherthala, Alappuzha',
    'Vadakkekara, Paravur, Ernakulam',
    'Vadakkumbhagom, Aluva, Ernakulam',
    'Vadavukode, Kunnathunad, Ernakulam',
    'Valakam, Muvattupuzha, Ernakulam',
    'Vallikunnam, Mavelikkara, Alappuzha',
    'Varappetty, Kothamangalam, Ernakulam',
    'Varappuzha, Paravur, Ernakulam',
    'Vayalar, Cherthala, Alappuzha',
    'Vazhakkala, Kanayannur, Ernakulam',
    'Vazhakulam, Kunnathunad, Ernakulam',
    'Veeyapuram, Karthikappally, Alappuzha',
    'Veliyanad, Champakkulam, Alappuzha',
    'Velloorkunnam, Muvattupuzha, Ernakulam',
    'Vengola, Kunnathunad, Ernakulam',
    'Vengoor, Kunnathunad, Ernakulam',
    'Vengoor West, Kunnathunad, Ernakulam',
    'Venmony, Chengannur, Alappuzha',
    'Vettiyar, Mavelikkara, Alappuzha',
    'Devikulam, Idukki',
    'Peerumade, Idukki',
    'Thodupuzha, Idukki',
    'Udumbanchola, Idukki',
    'Anaviratty, Devikulam, Idukki',
    'Kannan Devan Hills, Devikulam, Idukki',
    'Kanthalloor, Devikulam, Idukki',
    'Keezhanthoor, Devikulam, Idukki',
    'Kottakamboor, Devikulam, Idukki',
    'Kunjithanny, Devikulam, Idukki',
    'Mankulam, Devikulam, Idukki',
    'Mannamkandam, Devikulam, Idukki',
    'Marayoor, Devikulam, Idukki',
    'Pallivasal, Devikulam, Idukki',
    'Vattavada, Devikulam, Idukki',
    'Vellathuval, Devikulam, Idukki',
    'Elappara, Peerumade, Idukki',
    'Kokkayar, Peerumade, Idukki',
    'Kumily, Peerumade, Idukki',
    'Manjumala, Peerumade, Idukki',
    'Mlappara, Peerumade, Idukki',
    'Peerumade, Peerumade, Idukki',
    'Periyar, Peerumade, Idukki',
    'Peruvanthanam, Peerumade, Idukki',
    'Upputhara, Peerumade, Idukki',
    'Vagamon, Peerumade, Idukki',
    'Alacode, Thodupuzha, Idukki',
    'Arakkulam, Thodupuzha, Idukki',
    'Elappally, Thodupuzha, Idukki',
    'Idukki, Thodupuzha, Idukki',
    'Kanjikuzhi, Thodupuzha, Idukki',
    'Karikkode, Thodupuzha, Idukki',
    'Karimannoor, Thodupuzha, Idukki',
    'Karimkunnam, Thodupuzha, Idukki',
    'Kodikulam, Thodupuzha, Idukki',
    'Kudayathoor, Thodupuzha, Idukki',
    'Kumaramangalam, Thodupuzha, Idukki',
    'Manakkad, Thodupuzha, Idukki',
    'Muttom, Thodupuzha, Idukki',
    'Neyyasseri, Thodupuzha, Idukki',
    'Purapuzha, Thodupuzha, Idukki',
    'Thodupuzha, Thodupuzha, Idukki',
    'Udumbannoor, Thodupuzha, Idukki',
    'Vannapuram, Thodupuzha, Idukki',
    'Velliyamattom, Thodupuzha, Idukki',
    'Anakkara, Udumbanchola, Idukki',
    'Anavilasam, Udumbanchola, Idukki',
    'Ayyappancoil, Udumbanchola, Idukki',
    'Baisonvally, Udumbanchola, Idukki',
    'Chakkupallam, Udumbanchola, Idukki',
    'Chathurangapara, Udumbanchola, Idukki',
    'Chinnakanal, Udumbanchola, Idukki',
    'Kalkoonthal, Udumbanchola, Idukki',
    'Kanthippara, Udumbanchola, Idukki',
    'Karunapuram, Udumbanchola, Idukki',
    'Kattappana, Udumbanchola, Idukki',
    'Konnathady, Udumbanchola, Idukki',
    'Pampadumpara, Udumbanchola, Idukki',
    'Parathodu, Udumbanchola, Idukki',
    'Poopara, Udumbanchola, Idukki',
    'Rajakkad, Udumbanchola, Idukki',
    'Rajakumari, Udumbanchola, Idukki',
    'Santhanpara, Udumbanchola, Idukki',
    'Thankamony, Udumbanchola, Idukki',
    'Udumbanchola, Udumbanchola, Idukki',
    'Upputhode, Udumbanchola, Idukki',
    'Vandanmedu, Udumbanchola, Idukki',
    'Vathikudy, Udumbanchola, Idukki',
    'Taliparamba, Kannur',
    'Thalassery, Kannur',
    'Ancharakandy, Kannur, Kannur',
    'Azhikode North, Kannur, Kannur',
    'Azhikode South, Kannur, Kannur',
    'Chala, Kannur, Kannur',
    'Chelora, Kannur, Kannur',
    'Cherukunnu, Kannur, Kannur',
    'Cheruthazham, Kannur, Kannur',
    'Chirakkal, Kannur, Kannur',
    'Elayavoor, Kannur, Kannur',
    'Ezhome, Kannur, Kannur',
    'Iriveri, Kannur, Kannur',
    'Kadachira, Kannur, Kannur',
    'Kadannappalli, Kannur, Kannur',
    'Kalliasseri, Kannur, Kannur',
    'Kanhirode, Kannur, Kannur',
    'Kannadiparamba, Kannur, Kannur',
    'Kannapuram, Kannur, Kannur',
    'Kannur, Kannur, Kannur',
    'Kannur Cantonment, Kannur, Kannur',
    'Kunhimangalam, Kannur, Kannur',
    'Madayi, Kannur, Kannur',
    'Mattool, Kannur, Kannur',
    'Mavilayi, Kannur, Kannur',
    'Munderi, Kannur, Kannur',
    'Muzhappilangad, Kannur, Kannur',
    'Narath, Kannur, Kannur',
    'Pallikkunnu, Kannur, Kannur',
    'Panapuzha, Kannur, Kannur',
    'Pappinisseri, Kannur, Kannur',
    'Peralassery, Kannur, Kannur',
    'Puzhathi, Kannur, Kannur',
    'Thottada, Kannur, Kannur',
    'Valapattanam, Kannur, Kannur',
    'Varam, Kannur, Kannur',
    'Alakode, Taliparamba, Kannur',
    'Alapadamba, Taliparamba, Kannur',
    'Cheleri, Taliparamba, Kannur',
    'Chengalai, Taliparamba, Kannur',
    'Chuzhali, Taliparamba, Kannur',
    'Eramam, Taliparamba, Kannur',
    'Eruvassy, Taliparamba, Kannur',
    'Irikkur, Taliparamba, Kannur',
    'Kalliad, Taliparamba, Kannur',
    'Kankole, Taliparamba, Kannur',
    'Karivellur, Taliparamba, Kannur',
    'Kayaralam, Taliparamba, Kannur',
    'Kolacherry, Taliparamba, Kannur',
    'Kooveri, Taliparamba, Kannur',
    'Kurumathur, Taliparamba, Kannur',
    'Kuttiattoor, Taliparamba, Kannur',
    'Kuttiyeri, Taliparamba, Kannur',
    'Kuttoor, Taliparamba, Kannur',
    'Malapattam, Taliparamba, Kannur',
    'Maniyoor, Taliparamba, Kannur',
    'Mayyil, Taliparamba, Kannur',
    'Nediyanga, Taliparamba, Kannur',
    'New Naduvil, Taliparamba, Kannur',
    'Nuchiyad, Taliparamba, Kannur',
    'Padiyoor, Taliparamba, Kannur',
    'Panniyoor, Taliparamba, Kannur',
    'Pariyaram, Taliparamba, Kannur',
    'Pattuvam, Taliparamba, Kannur',
    'Payyannur, Taliparamba, Kannur',
    'Payyavoor, Taliparamba, Kannur',
    'Peralam, Taliparamba, Kannur',
    'Peringome, Taliparamba, Kannur',
    'Perinthatta, Taliparamba, Kannur',
    'Pulingome, Taliparamba, Kannur',
    'Ramanthali, Taliparamba, Kannur',
    'Sreekandapuram, Taliparamba, Kannur',
    'Taliparamba, Taliparamba, Kannur',
    'Thimiri, Taliparamba, Kannur',
    'Thirumeni, Taliparamba, Kannur',
    'Vayakkara, Taliparamba, Kannur',
    'Vayathur, Taliparamba, Kannur',
    'Vellad, Taliparamba, Kannur',
    'Vellora, Taliparamba, Kannur',
    'Aralam, Thalassery, Kannur',
    'Ayyankunnu, Thalassery, Kannur',
    'Chavassery, Thalassery, Kannur',
    'Cheruvanchery, Thalassery, Kannur',
    'Chockli, Thalassery, Kannur',
    'Dharmadom, Thalassery, Kannur',
    'Eranholi, Thalassery, Kannur',
    'Eruvatti, Thalassery, Kannur',
    'Kadirur, Thalassery, Kannur',
    'Kandamkunnu, Thalassery, Kannur',
    'Kanichar, Thalassery, Kannur',
    'Kannavam, Thalassery, Kannur',
    'Keezhallur, Thalassery, Kannur',
    'Keezhur, Thalassery, Kannur',
    'Kelakam, Thalassery, Kannur',
    'Kolavelloor, Thalassery, Kannur',
    'Koloyad, Thalassery, Kannur',
    'Koodali, Thalassery, Kannur',
    'Koothuparamba, Thalassery, Kannur',
    'Kottayam-Malabar, Thalassery, Kannur',
    'Kottiyoor, Thalassery, Kannur',
    'Manantheri, Thalassery, Kannur',
    'Manathana, Thalassery, Kannur',
    'Mangattidam, Thalassery, Kannur',
    'Mattannur, Thalassery, Kannur',
    'Mokeri, Thalassery, Kannur',
    'Muzhakkunnu, Thalassery, Kannur',
    'New Mahe, Thalassery, Kannur',
    'Paduvilayi, Thalassery, Kannur',
    'Panniyannur, Thalassery, Kannur',
    'Panoor, Thalassery, Kannur',
    'Pathiriyad, Thalassery, Kannur',
    'Pattannur, Thalassery, Kannur',
    'Pattiom, Thalassery, Kannur',
    'Payam, Thalassery, Kannur',
    'Peringathur, Thalassery, Kannur',
    'Pinarayi, Thalassery, Kannur',
    'Puthoor, Thalassery, Kannur',
    'Sivapuram, Thalassery, Kannur',
    'Thalassery, Thalassery, Kannur',
    'Thillenkeri, Thalassery, Kannur',
    'Tholambra, Thalassery, Kannur',
    'Thrippangottur, Thalassery, Kannur',
    'Vekkalam, Thalassery, Kannur',
    'Vellarvelly, Thalassery, Kannur',
    'Vilamana, Thalassery, Kannur',
    'Hosdurg, Kasaragod',
    'Kasaragod, Kasaragod',
    'Ajanur, Hosdurg, Kasaragod',
    'Ambalathara, Hosdurg, Kasaragod',
    'Balal, Hosdurg, Kasaragod',
    'Bare, Hosdurg, Kasaragod',
    'Bellur, Hosdurg, Kasaragod',
    'Bheemanady, Hosdurg, Kasaragod',
    'Cheemeni, Hosdurg, Kasaragod',
    'Cheemeni II, Hosdurg, Kasaragod',
    'Cheruvathur, Hosdurg, Kasaragod',
    'Chithari, Hosdurg, Kasaragod',
    'Chittarikkal, Hosdurg, Kasaragod',
    'Kallar, Hosdurg, Kasaragod',
    'Kanhangad, Hosdurg, Kasaragod',
    'Karindalam, Hosdurg, Kasaragod',
    'Kayyur, Hosdurg, Kasaragod',
    'Keekan, Hosdurg, Kasaragod',
    'Kilayikode, Hosdurg, Kasaragod',
    'Kinanoor, Hosdurg, Kasaragod',
    'Kodakkad, Hosdurg, Kasaragod',
    'Kodom, Hosdurg, Kasaragod',
    'Madikai, Hosdurg, Kasaragod',
    'Maloth, Hosdurg, Kasaragod',
    'Maniyat, Hosdurg, Kasaragod',
    'Nileshwar, Hosdurg, Kasaragod',
    'North Thrikkaripur, Hosdurg, Kasaragod',
    'Padne, Hosdurg, Kasaragod',
    'Palavayal, Hosdurg, Kasaragod',
    'Pallikkara, Hosdurg, Kasaragod',
    'Pallikkara II, Hosdurg, Kasaragod',
    'Panathady, Hosdurg, Kasaragod',
    'Panayal, Hosdurg, Kasaragod',
    'Parappa, Hosdurg, Kasaragod',
    'Periya, Hosdurg, Kasaragod',
    'Perole, Hosdurg, Kasaragod',
    'Pilicode, Hosdurg, Kasaragod',
    'Pullur, Hosdurg, Kasaragod',
    'South Thrikkaripur, Hosdurg, Kasaragod',
    'Thayanur, Hosdurg, Kasaragod',
    'Thimiri, Hosdurg, Kasaragod',
    'Udinoor, Hosdurg, Kasaragod',
    'Udma, Hosdurg, Kasaragod',
    'West Eleri, Hosdurg, Kasaragod',
    'Adhur, Kasaragod, Kasaragod',
    'Adoor, Kasaragod, Kasaragod',
    'Angadimogaru, Kasaragod, Kasaragod',
    'Arikady, Kasaragod, Kasaragod',
    'Badaje, Kasaragod, Kasaragod',
    'Badiyadka, Kasaragod, Kasaragod',
    'Badoor, Kasaragod, Kasaragod',
    'Bandadka, Kasaragod, Kasaragod',
    'Bangra Manjeshwar, Kasaragod, Kasaragod',
    'Bayar, Kasaragod, Kasaragod',
    'Bedadka, Kasaragod, Kasaragod',
    'Bekoor, Kasaragod, Kasaragod',
    'Bela, Kasaragod, Kasaragod',
    'Bellur, Kasaragod, Kasaragod',
    'Bombrana, Kasaragod, Kasaragod',
    'Chemnad, Kasaragod, Kasaragod',
    'Chengala, Kasaragod, Kasaragod',
    'Chippar, Kasaragod, Kasaragod',
    'Delampady, Kasaragod, Kasaragod',
    'Edanad, Kasaragod, Kasaragod',
    'Enmakaje, Kasaragod, Kasaragod',
    'Heroor, Kasaragod, Kasaragod',
    'Hosabettu, Kasaragod, Kasaragod',
    'Ichilampady, Kasaragod, Kasaragod',
    'Ichilangod, Kasaragod, Kasaragod',
    'Kadambar, Kasaragod, Kasaragod',
    'Kaliyoor, Kasaragod, Kasaragod',
    'Kalnad, Kasaragod, Kasaragod',
    'Kannur, Kasaragod, Kasaragod',
    'Karadka, Kasaragod, Kasaragod',
    'Karivedakam, Kasaragod, Kasaragod',
    'Kasaragod, Kasaragod, Kasaragod',
    'Kattukukke, Kasaragod, Kasaragod',
    'Kayyar, Kasaragod, Kasaragod',
    'Kidoor, Kasaragod, Kasaragod',
    'Kodalamogaru, Kasaragod, Kasaragod',
    'Kodibail, Kasaragod, Kasaragod',
    'Koipady, Kasaragod, Kasaragod',
    'Kolathur, Kasaragod, Kasaragod',
    'Koliyoor, Kasaragod, Kasaragod',
    'Kubanoor, Kasaragod, Kasaragod',
    'Kudalmarkala, Kasaragod, Kasaragod',
    'Kudlu, Kasaragod, Kasaragod',
    'Kuloor, Kasaragod, Kasaragod',
    'Kumbadaje, Kasaragod, Kasaragod',
    'Kunjathur, Kasaragod, Kasaragod',
    'Kuttikole, Kasaragod, Kasaragod',
    'Madhur, Kasaragod, Kasaragod',
    'Maire, Kasaragod, Kasaragod',
    'Majibail, Kasaragod, Kasaragod',
    'Mangalpady, Kasaragod, Kasaragod',
    'Manjeshwar, Kasaragod, Kasaragod',
    'Meenja, Kasaragod, Kasaragod',
    'Mogral, Kasaragod, Kasaragod',
    'Moodambail, Kasaragod, Kasaragod',
    'Mugu, Kasaragod, Kasaragod',
    'Mulinja, Kasaragod, Kasaragod',
    'Muliyar, Kasaragod, Kasaragod',
    'Munnad, Kasaragod, Kasaragod',
    'Muttathody, Kasaragod, Kasaragod',
    'Nekraje, Kasaragod, Kasaragod',
    'Nettanige, Kasaragod, Kasaragod',
    'Nirchal, Kasaragod, Kasaragod',
    'Padre, Kasaragod, Kasaragod',
    'Pady, Kasaragod, Kasaragod',
    'Paivalike, Kasaragod, Kasaragod',
    'Pathur, Kasaragod, Kasaragod',
    'Patla, Kasaragod, Kasaragod',
    'Pavoor, Kasaragod, Kasaragod',
    'Perumbala, Kasaragod, Kasaragod',
    'Puthige, Kasaragod, Kasaragod',
    'Puthur, Kasaragod, Kasaragod',
    'Shiribagilu, Kasaragod, Kasaragod',
    'Shiriya, Kasaragod, Kasaragod',
    'Talikala, Kasaragod, Kasaragod',
    'Thekkil, Kasaragod, Kasaragod',
    'Ubrangala, Kasaragod, Kasaragod',
    'Ujarulvar, Kasaragod, Kasaragod',
    'Uppala, Kasaragod, Kasaragod',
    'Vorkady, Kasaragod, Kasaragod',
    'Karunagappally, Kollam',
    'Kollam, Kollam',
    'Kottarakkara, Kollam',
    'Kunnathur, Kollam',
    'Pathanapuram, Kollam',
    'Adinad, Karunagappally, Kollam',
    'Alappad, Karunagappally, Kollam',
    'Ayanivelikulangara, Karunagappally, Kollam',
    'Chavara, Karunagappally, Kollam',
    'Clappana, Karunagappally, Kollam',
    'Kallelibhagom, Karunagappally, Kollam',
    'Karunagappally, Karunagappally, Kollam',
    'Kollam, Karunagappally, Kollam',
    'Kulasekharapuram, Karunagappally, Kollam',
    'Neendakara, Karunagappally, Kollam',
    'Oachira, Karunagappally, Kollam',
    'Panmana, Karunagappally, Kollam',
    'Pavumba, Karunagappally, Kollam',
    'Thazhava, Karunagappally, Kollam',
    'Thekkumbhagom, Karunagappally, Kollam',
    'Thevalakkara, Karunagappally, Kollam',
    'Thodiyoor, Karunagappally, Kollam',
    'Vadakkumthala, Karunagappally, Kollam',
    'Adichanalloor, Kollam, Kollam',
    'Chirakkara, Kollam, Kollam',
    'Elampalloor, Kollam, Kollam',
    'Eravipuram, Kollam, Kollam',
    'Kalluvathukkal, Kollam, Kollam',
    'Kizhakkekallada, Kollam, Kollam',
    'Kottamkara, Kollam, Kollam',
    'Mayyanad, Kollam, Kollam',
    'Meenad, Kollam, Kollam',
    'Mulavana, Kollam, Kollam',
    'Mundrothuruth, Kollam, Kollam',
    'Nedumpana, Kollam, Kollam',
    'Pallimon, Kollam, Kollam',
    'Panayam, Kollam, Kollam',
    'Paravoor, Kollam, Kollam',
    'Parippally, Kollam, Kollam',
    'Perinad, Kollam, Kollam',
    'Poothakkulam, Kollam, Kollam',
    'Thazhuthala, Kollam, Kollam',
    'Thrikkadavoor, Kollam, Kollam',
    'Thrikkaruva, Kollam, Kollam',
    'Thrikkovilvattom, Kollam, Kollam',
    'Chadayamangalam, Kottarakkara, Kollam',
    'Chakkuvarakkal, Kottarakkara, Kollam',
    'Chithara, Kottarakkara, Kollam',
    'Elamad, Kottarakkara, Kollam',
    'Ezhukone, Kottarakkara, Kollam',
    'Ittiva, Kottarakkara, Kollam',
    'Kadakkal, Kottarakkara, Kollam',
    'Kalayapuram, Kottarakkara, Kollam',
    'Kareepra, Kottarakkara, Kollam',
    'Kottarakkara, Kottarakkara, Kollam',
    'Kottukkal, Kottarakkara, Kollam',
    'Kulakkada, Kottarakkara, Kollam',
    'Kummil, Kottarakkara, Kollam',
    'Mancode, Kottarakkara, Kollam',
    'Melila, Kottarakkara, Kollam',
    'Mylom, Kottarakkara, Kollam',
    'Neduvathoor, Kottarakkara, Kollam',
    'Nilamel, Kottarakkara, Kollam',
    'Odanavattam, Kottarakkara, Kollam',
    'Pavithreswaram, Kottarakkara, Kollam',
    'Pooyappally, Kottarakkara, Kollam',
    'Puthur, Kottarakkara, Kollam',
    'Ummannoor, Kottarakkara, Kollam',
    'Valakam, Kottarakkara, Kollam',
    'Velinalloor, Kottarakkara, Kollam',
    'Veliyam, Kottarakkara, Kollam',
    'Vettikkavala, Kottarakkara, Kollam',
    'Kunnathur, Kunnathur, Kollam',
    'Mynagappally, Kunnathur, Kollam',
    'Poruvazhy, Kunnathur, Kollam',
    'Sasthamkotta, Kunnathur, Kollam',
    'Sooranad North, Kunnathur, Kollam',
    'Sooranad South, Kunnathur, Kollam',
    'West Kallada, Kunnathur, Kollam',
    'Alayamon, Pathanapuram, Kollam',
    'Anchal, Pathanapuram, Kollam',
    'Arackal, Pathanapuram, Kollam',
    'Arienkavu, Pathanapuram, Kollam',
    'Ayiranalloor, Pathanapuram, Kollam',
    'Channappetta, Pathanapuram, Kollam',
    'Edamon, Pathanapuram, Kollam',
    'Edamulackal, Pathanapuram, Kollam',
    'Eroor, Pathanapuram, Kollam',
    'Karavaloor, Pathanapuram, Kollam',
    'Kulathupuzha, Pathanapuram, Kollam',
    'Pathanapuram, Pathanapuram, Kollam',
    'Pattazhy, Pathanapuram, Kollam',
    'Pattazhy Vadakkekara, Pathanapuram, Kollam',
    'Pidavoor, Pathanapuram, Kollam',
    'Piravanthur, Pathanapuram, Kollam',
    'Punalur, Pathanapuram, Kollam',
    'Punnala, Pathanapuram, Kollam',
    'Thalavoor, Pathanapuram, Kollam',
    'Thenmala, Pathanapuram, Kollam',
    'Thinkalkarikkakom, Pathanapuram, Kollam',
    'Valacode, Pathanapuram, Kollam',
    'Vilakkudy, Pathanapuram, Kollam',
    'Changanassery, Kottayam',
    'Kanjirappally, Kottayam',
    'Kottayam, Kottayam',
    'Meenachil, Kottayam',
    'Vaikom, Kottayam',
    'Changanassery, Changanassery, Kottayam',
    'Chethipuzha, Changanassery, Kottayam',
    'Kangazha, Changanassery, Kottayam',
    'Karukachal, Changanassery, Kottayam',
    'Kurichy, Changanassery, Kottayam',
    'Madappally, Changanassery, Kottayam',
    'Nedumkunnam, Changanassery, Kottayam',
    'Paippad, Changanassery, Kottayam',
    'Thottackad, Changanassery, Kottayam',
    'Thrikkodithanam, Changanassery, Kottayam',
    'Vakathanam, Changanassery, Kottayam',
    'Vazhappally Padinjaru, Changanassery, Kottayam',
    'Vazhoor, Changanassery, Kottayam',
    'Vellavoor, Changanassery, Kottayam',
    'Cheruvally, Kanjirappally, Kottayam',
    'Chirakkadavu, Kanjirappally, Kottayam',
    'Edakkunnam, Kanjirappally, Kottayam',
    'Elamgulam, Kanjirappally, Kottayam',
    'Elikkulam, Kanjirappally, Kottayam',
    'Erumeli North, Kanjirappally, Kottayam',
    'Erumeli South, Kanjirappally, Kottayam',
    'Kanjirappally, Kanjirappally, Kottayam',
    'Koottickal, Kanjirappally, Kottayam',
    'Koovappally, Kanjirappally, Kottayam',
    'Manimala, Kanjirappally, Kottayam',
    'Mundakayam, Kanjirappally, Kottayam',
    'Aimanam, Kottayam, Kottayam',
    'Akalakunnam, Kottayam, Kottayam',
    'Anikkad, Kottayam, Kottayam',
    'Arpookara, Kottayam, Kottayam',
    'Athirampuzha, Kottayam, Kottayam',
    'Ayarkunnam, Kottayam, Kottayam',
    'Chengalam East, Kottayam, Kottayam',
    'Chengalam South, Kottayam, Kottayam',
    'Ettumanoor, Kottayam, Kottayam',
    'Kaipuzha, Kottayam, Kottayam',
    'Kooroppada, Kottayam, Kottayam',
    'Kottayam, Kottayam, Kottayam',
    'Kumarakam, Kottayam, Kottayam',
    'Manarcad, Kottayam, Kottayam',
    'Meenadam, Kottayam, Kottayam',
    'Muttampalam, Kottayam, Kottayam',
    'Nattakam, Kottayam, Kottayam',
    'Onamthuruth, Kottayam, Kottayam',
    'Pampady, Kottayam, Kottayam',
    'Panachikkad, Kottayam, Kottayam',
    'Peroor, Kottayam, Kottayam',
    'Perumbaikad, Kottayam, Kottayam',
    'Puthuppally, Kottayam, Kottayam',
    'Thiruvarpu, Kottayam, Kottayam',
    'Veloor, Kottayam, Kottayam',
    'Vijayapuram, Kottayam, Kottayam',
    'Bharananganam, Meenachil, Kottayam',
    'Elackad, Meenachil, Kottayam',
    'Erattupetta, Meenachil, Kottayam',
    'Kadanad, Meenachil, Kottayam',
    'Kanakkari, Meenachil, Kottayam',
    'Kidangoor, Meenachil, Kottayam',
    'Kondoor, Meenachil, Kottayam',
    'Kuravilangad, Meenachil, Kottayam',
    'Kurichithanam, Meenachil, Kottayam',
    'Lalam, Meenachil, Kottayam',
    'Meenachil, Meenachil, Kottayam',
    'Melukavu, Meenachil, Kottayam',
    'Monippally, Meenachil, Kottayam',
    'Moonilavu, Meenachil, Kottayam',
    'Palai, Meenachil, Kottayam',
    'Poonjar Nadubhagam, Meenachil, Kottayam',
    'Poonjar Thekkekara, Meenachil, Kottayam',
    'Poonjar Vadakkekara, Meenachil, Kottayam',
    'Poovarany, Meenachil, Kottayam',
    'Puliyannoor, Meenachil, Kottayam',
    'Ramapuram, Meenachil, Kottayam',
    'Teekoy, Meenachil, Kottayam',
    'Thalappalam, Meenachil, Kottayam',
    'Uzhavoor, Meenachil, Kottayam',
    'Vallichira, Meenachil, Kottayam',
    'Veliyannoor, Meenachil, Kottayam',
    'Vellilappally, Meenachil, Kottayam',
    'Chempu, Vaikom, Kottayam',
    'Kaduthuruthy, Vaikom, Kottayam',
    'Kallara, Vaikom, Kottayam',
    'Kothanalloor, Vaikom, Kottayam',
    'Kulasekharamangalam, Vaikom, Kottayam',
    'Manjoor, Vaikom, Kottayam',
    'Mulakulam, Vaikom, Kottayam',
    'Muttuchira, Vaikom, Kottayam',
    'Naduvile, Vaikom, Kottayam',
    'Njeezhoor, Vaikom, Kottayam',
    'Thalayazham, Vaikom, Kottayam',
    'Vadakkemuri, Vaikom, Kottayam',
    'Vadayar, Vaikom, Kottayam',
    'Vaikom, Vaikom, Kottayam',
    'Vechoor, Vaikom, Kottayam',
    'Velloor, Vaikom, Kottayam',
    'Kozhikode',
    'Quilandy, Kozhikode',
    'Vadakara, Kozhikode',
    'Beypore, Kozhikode, Kozhikode',
    'Chathamangalam, Kozhikode, Kozhikode',
    'Chelannur, Kozhikode, Kozhikode',
    'Cheruvannur, Kozhikode, Kozhikode',
    'Elathur, Kozhikode, Kozhikode',
    'Engapuzha, Kozhikode, Kozhikode',
    'Feroke, Kozhikode, Kozhikode',
    'Kadalundi, Kozhikode, Kozhikode',
    'Kakkad, Kozhikode, Kozhikode',
    'Kakkodi, Kozhikode, Kozhikode',
    'Kakkur, Kozhikode, Kozhikode',
    'Karuvanthuruthy, Kozhikode, Kozhikode',
    'Kedavur, Kozhikode, Kozhikode',
    'Kizhakkoth, Kozhikode, Kozhikode',
    'Kodencheri, Kozhikode, Kozhikode',
    'Kodiyathur, Kozhikode, Kozhikode',
    'Koduvally, Kozhikode, Kozhikode',
    'Koodaranji, Kozhikode, Kozhikode',
    'Koodathayi, Kozhikode, Kozhikode',
    'Kozhikode, Kozhikode, Kozhikode',
    'Kumaranallur, Kozhikode, Kozhikode',
    'Kunnamangalam, Kozhikode, Kozhikode',
    'Kuruvattur, Kozhikode, Kozhikode',
    'Kuttikkattoor, Kozhikode, Kozhikode',
    'Madavoor, Kozhikode, Kozhikode',
    'Mavoor, Kozhikode, Kozhikode',
    'Nanmanda, Kozhikode, Kozhikode',
    'Narikkuni, Kozhikode, Kozhikode',
    'Neeleswaram, Kozhikode, Kozhikode',
    'Nellipoyil, Kozhikode, Kozhikode',
    'Olavanna, Kozhikode, Kozhikode',
    'Pantheeramkavu, Kozhikode, Kozhikode',
    'Perumanna, Kozhikode, Kozhikode',
    'Peruvayal, Kozhikode, Kozhikode',
    'Poolacode, Kozhikode, Kozhikode',
    'Puthiyangadi, Kozhikode, Kozhikode',
    'Puthuppadi, Kozhikode, Kozhikode',
    'Puthur, Kozhikode, Kozhikode',
    'Ramanattukara, Kozhikode, Kozhikode',
    'Raroth, Kozhikode, Kozhikode',
    'Thalakkulathur, Kozhikode, Kozhikode',
    'Thazhecode, Kozhikode, Kozhikode',
    'Thiruvambadi, Kozhikode, Kozhikode',
    'Vavad, Kozhikode, Kozhikode',
    'Arikkulam, Quilandy, Kozhikode',
    'Atholi, Quilandy, Kozhikode',
    'Avitanallur, Quilandy, Kozhikode',
    'Balusseri, Quilandy, Kozhikode',
    'Chakkittapara, Quilandy, Kozhikode',
    'Changaroth, Quilandy, Kozhikode',
    'Chemancheri, Quilandy, Kozhikode',
    'Chempanoda, Quilandy, Kozhikode',
    'Chengottukavu, Quilandy, Kozhikode',
    'Cheruvannur, Quilandy, Kozhikode',
    'Eravattur, Quilandy, Kozhikode',
    'Iringal, Quilandy, Kozhikode',
    'Kanthalad, Quilandy, Kozhikode',
    'Kayanna, Quilandy, Kozhikode',
    'Keezhariyur, Quilandy, Kozhikode',
    'Kinalur, Quilandy, Kozhikode',
    'Koorachundu, Quilandy, Kozhikode',
    'Koothali, Quilandy, Kozhikode',
    'Kottur, Quilandy, Kozhikode',
    'Kozhukkallur, Quilandy, Kozhikode',
    'Menhaniam, Quilandy, Kozhikode',
    'Meppayyur, Quilandy, Kozhikode',
    'Moodadi, Quilandy, Kozhikode',
    'Naduvannur, Quilandy, Kozhikode',
    'Nochad, Quilandy, Kozhikode',
    'Palery, Quilandy, Kozhikode',
    'Panangad, Quilandy, Kozhikode',
    'Payyoli, Quilandy, Kozhikode',
    'Perambra, Quilandy, Kozhikode',
    'Quilandy, Quilandy, Kozhikode',
    'Sivapuram, Quilandy, Kozhikode',
    'Thikkody, Quilandy, Kozhikode',
    'Thurayur, Quilandy, Kozhikode',
    'Ulliyeri, Quilandy, Kozhikode',
    'Unnikulam, Quilandy, Kozhikode',
    'Ayancheri, Vadakara, Kozhikode',
    'Azhiyur, Vadakara, Kozhikode',
    'Chekkiad, Vadakara, Kozhikode',
    'Chorode, Vadakara, Kozhikode',
    'Edacheri, Vadakara, Kozhikode',
    'Eramala, Vadakara, Kozhikode',
    'Kavilumpara, Vadakara, Kozhikode',
    'Kayakkodi, Vadakara, Kozhikode',
    'Kottappally, Vadakara, Kozhikode',
    'Kunnummal, Vadakara, Kozhikode',
    'Kuttiadi, Vadakara, Kozhikode',
    'Maniyur, Vadakara, Kozhikode',
    'Maruthonkara, Vadakara, Kozhikode',
    'Nadapuram, Vadakara, Kozhikode',
    'Narippatta, Vadakara, Kozhikode',
    'Onchiam, Vadakara, Kozhikode',
    'Palayad, Vadakara, Kozhikode',
    'Purameri, Vadakara, Kozhikode',
    'Thinoor, Vadakara, Kozhikode',
    'Thiruvallur, Vadakara, Kozhikode',
    'Thuneri, Vadakara, Kozhikode',
    'Vadakara, Vadakara, Kozhikode',
    'Valayam, Vadakara, Kozhikode',
    'Vanimel, Vadakara, Kozhikode',
    'Velom, Vadakara, Kozhikode',
    'Vilangad, Vadakara, Kozhikode',
    'Villiappally, Vadakara, Kozhikode',
    'Ernad, Malappuram',
    'Nilambur, Malappuram',
    'Perinthalmanna, Malappuram',
    'Ponnani, Malappuram',
    'Tirur, Malappuram',
    'Tirurangadi, Malappuram',
    'Anakkayam, Ernad, Malappuram',
    'Areekode, Ernad, Malappuram',
    'Cheekkode, Ernad, Malappuram',
    'Chembrasseri, Ernad, Malappuram',
    'Cherukavu, Ernad, Malappuram',
    'Edavanna, Ernad, Malappuram',
    'Elankur, Ernad, Malappuram',
    'Karakunnu, Ernad, Malappuram',
    'Kavanoor, Ernad, Malappuram',
    'Kizhuparamba, Ernad, Malappuram',
    'Kondotty, Ernad, Malappuram',
    'Kuzhimanna, Ernad, Malappuram',
    'Malappuram, Ernad, Malappuram',
    'Manjeri, Ernad, Malappuram',
    'Morayur, Ernad, Malappuram',
    'Muthuvallur, Ernad, Malappuram',
    'Nediyiruppu, Ernad, Malappuram',
    'Pandalur, Ernad, Malappuram',
    'Pandikkad, Ernad, Malappuram',
    'Perakamanna, Ernad, Malappuram',
    'Pookkottur, Ernad, Malappuram',
    'Pulikkal, Ernad, Malappuram',
    'Pulpatta, Ernad, Malappuram',
    'Trikkalangode, Ernad, Malappuram',
    'Urangattiri, Ernad, Malappuram',
    'Vazhakkad, Ernad, Malappuram',
    'Vazhayur, Ernad, Malappuram',
    'Vettikkattiri, Ernad, Malappuram',
    'Vettilappara, Ernad, Malappuram',
    'Akampadam, Nilambur, Malappuram',
    'Amarambalam, Nilambur, Malappuram',
    'Chekkode, Nilambur, Malappuram',
    'Chungathara, Nilambur, Malappuram',
    'Edakkara, Nilambur, Malappuram',
    'Kalikavu, Nilambur, Malappuram',
    'Karulai, Nilambur, Malappuram',
    'Karuvarakundu, Nilambur, Malappuram',
    'Kerala Estate, Nilambur, Malappuram',
    'Kurumbilangode, Nilambur, Malappuram',
    'Mambad, Nilambur, Malappuram',
    'Nilambur, Nilambur, Malappuram',
    'Porur, Nilambur, Malappuram',
    'Pullipadam, Nilambur, Malappuram',
    'Thiruvali, Nilambur, Malappuram',
    'Thuvvur, Nilambur, Malappuram',
    'Vazhikkadavu, Nilambur, Malappuram',
    'Vellayur, Nilambur, Malappuram',
    'Wandoor, Nilambur, Malappuram',
    'Aliparamba, Perinthalmanna, Malappuram',
    'Anamangad, Perinthalmanna, Malappuram',
    'Angadippuram, Perinthalmanna, Malappuram',
    'Arakkuparamba, Perinthalmanna, Malappuram',
    'Edappatta, Perinthalmanna, Malappuram',
    'Elamkulam, Perinthalmanna, Malappuram',
    'Kariavattom, Perinthalmanna, Malappuram',
    'Keezhattur, Perinthalmanna, Malappuram',
    'Kodur, Perinthalmanna, Malappuram',
    'Koottilangadi, Perinthalmanna, Malappuram',
    'Kuruva, Perinthalmanna, Malappuram',
    'Kuruvambalam, Perinthalmanna, Malappuram',
    'Mankada, Perinthalmanna, Malappuram',
    'Melattur, Perinthalmanna, Malappuram',
    'Moorkkanad, Perinthalmanna, Malappuram',
    'Nenmini, Perinthalmanna, Malappuram',
    'Perinthalmanna, Perinthalmanna, Malappuram',
    'Pulamanthole, Perinthalmanna, Malappuram',
    'Puzhakkattiri, Perinthalmanna, Malappuram',
    'Thazhekode, Perinthalmanna, Malappuram',
    'Vadakkangara, Perinthalmanna, Malappuram',
    'Valambur, Perinthalmanna, Malappuram',
    'Vettathur, Perinthalmanna, Malappuram',
    'Alamcode, Ponnani, Malappuram',
    'Edappal, Ponnani, Malappuram',
    'Kalady, Ponnani, Malappuram',
    'Marancheri, Ponnani, Malappuram',
    'Nannamukku, Ponnani, Malappuram',
    'Perumpadappa, Ponnani, Malappuram',
    'Ponnani, Ponnani, Malappuram',
    'Tavanur, Ponnani, Malappuram',
    'Vattamkulam, Ponnani, Malappuram',
    'Veliyankode, Ponnani, Malappuram',
    'Ananthavoor, Tirur, Malappuram',
    'Athavanad, Tirur, Malappuram',
    'Cheriyamundam, Tirur, Malappuram',
    'Edayoor, Tirur, Malappuram',
    'Irimbiliyam, Tirur, Malappuram',
    'Kalpakancheri, Tirur, Malappuram',
    'Kattipparuthi, Tirur, Malappuram',
    'Kottakkal, Tirur, Malappuram',
    'Kurumbathur, Tirur, Malappuram',
    'Kuttippuram, Tirur, Malappuram',
    'Mangalam, Tirur, Malappuram',
    'Marakkara, Tirur, Malappuram',
    'Melmuri, Tirur, Malappuram',
    'Naduvattom, Tirur, Malappuram',
    'Niramaruthur, Tirur, Malappuram',
    'Ozhur, Tirur, Malappuram',
    'Pariyapuram, Tirur, Malappuram',
    'Perumanna, Tirur, Malappuram',
    'Ponmala, Tirur, Malappuram',
    'Ponmundam, Tirur, Malappuram',
    'Purathur, Tirur, Malappuram',
    'Talakkad, Tirur, Malappuram',
    'Tanalur, Tirur, Malappuram',
    'Tanur, Tirur, Malappuram',
    'Thirunavaya, Tirur, Malappuram',
    'Tirur, Tirur, Malappuram',
    'Triprangode, Tirur, Malappuram',
    'Valavannur, Tirur, Malappuram',
    'Vettom, Tirur, Malappuram',
    'Abdu Rahiman Nagar, Tirurangadi, Malappuram',
    'Ariyallur, Tirurangadi, Malappuram',
    'Chelambra, Tirurangadi, Malappuram',
    'Kannamangalam, Tirurangadi, Malappuram',
    'Moonniyur, Tirurangadi, Malappuram',
    'Nannambra, Tirurangadi, Malappuram',
    'Neduva, Tirurangadi, Malappuram',
    'Othukkungal, Tirurangadi, Malappuram',
    'Pallikal, Tirurangadi, Malappuram',
    'Parappanangadi, Tirurangadi, Malappuram',
    'Parappur, Tirurangadi, Malappuram',
    'Peruvallur, Tirurangadi, Malappuram',
    'Thenhippalam, Tirurangadi, Malappuram',
    'Thennala, Tirurangadi, Malappuram',
    'Tirurangadi, Tirurangadi, Malappuram',
    'Urakam, Tirurangadi, Malappuram',
    'Vallikkunnu, Tirurangadi, Malappuram',
    'Vengara, Tirurangadi, Malappuram',
    'Alathur, Palakkad',
    'Chittur, Palakkad',
    'Mannarkad, Palakkad',
    'Ottappalam, Palakkad',
    'Palakkad, Palakkad',
    'Alathur, Alathur, Palakkad',
    'Erimayur-I, Alathur, Palakkad',
    'Erimayur-II, Alathur, Palakkad',
    'Kannambra-I, Alathur, Palakkad',
    'Kannambra-II, Alathur, Palakkad',
    'Kavasseri-I, Alathur, Palakkad',
    'Kavasseri-II, Alathur, Palakkad',
    'Kizhakkencheri-I, Alathur, Palakkad',
    'Kizhakkencheri-II, Alathur, Palakkad',
    'Kottayi-I, Alathur, Palakkad',
    'Kottayi-II, Alathur, Palakkad',
    'Kuthannur-I, Alathur, Palakkad',
    'Kuthannur-II, Alathur, Palakkad',
    'Kuzhalmannam-I, Alathur, Palakkad',
    'Kuzhalmannam-II, Alathur, Palakkad',
    'Mangalam Dam, Alathur, Palakkad',
    'Mathur-I, Alathur, Palakkad',
    'Mathur-II, Alathur, Palakkad',
    'Melarcode, Alathur, Palakkad',
    'Peringottukurissi-I, Alathur, Palakkad',
    'Peringottukurissi-II, Alathur, Palakkad',
    'Puducode, Alathur, Palakkad',
    'Tarur-I, Alathur, Palakkad',
    'Tarur-II, Alathur, Palakkad',
    'Thenkurissi-I, Alathur, Palakkad',
    'Thenkurissi-II, Alathur, Palakkad',
    'Vadakkancheri-I, Alathur, Palakkad',
    'Vadakkancheri-II, Alathur, Palakkad',
    'Vandazhi-I, Alathur, Palakkad',
    'Vandazhi-II, Alathur, Palakkad',
    'Ayiloor, Chittur, Palakkad',
    'Chittur, Chittur, Palakkad',
    'Chittur-Thathamangalam, Chittur, Palakkad',
    'Elavancherry, Chittur, Palakkad',
    'Eruthempathy, Chittur, Palakkad',
    'Kairady, Chittur, Palakkad',
    'Koduvayur, Chittur, Palakkad',
    'Koduvayur-II, Chittur, Palakkad',
    'Kollengode-I, Chittur, Palakkad',
    'Kollengode-II, Chittur, Palakkad',
    'Kozhinjampara, Chittur, Palakkad',
    'Kozhipathy, Chittur, Palakkad',
    'Moolathara, Chittur, Palakkad',
    'Muthalamada-I, Chittur, Palakkad',
    'Muthalamada-II, Chittur, Palakkad',
    'Nalleppilly, Chittur, Palakkad',
    'Nelliyampathy, Chittur, Palakkad',
    'Nemmara, Chittur, Palakkad',
    'Ozhalapathy, Chittur, Palakkad',
    'Pallassana, Chittur, Palakkad',
    'Pattanchery, Chittur, Palakkad',
    'Perumatty, Chittur, Palakkad',
    'Puthunagaram, Chittur, Palakkad',
    'Thathamangalam, Chittur, Palakkad',
    'Thekkedesom, Chittur, Palakkad',
    'Thiruvazhiyad, Chittur, Palakkad',
    'Vadakarapathy, Chittur, Palakkad',
    'Vadavannur, Chittur, Palakkad',
    'Valiyavallampathy, Chittur, Palakkad',
    'Vallanghy, Chittur, Palakkad',
    'Vandithavalam, Chittur, Palakkad',
    'Agali, Mannarkad, Palakkad',
    'Alanallur-I, Mannarkad, Palakkad',
    'Alanallur-II, Mannarkad, Palakkad',
    'Alanallur-III, Mannarkad, Palakkad',
    'Kallamala, Mannarkad, Palakkad',
    'Karakurissi, Mannarkad, Palakkad',
    'Karimba-I, Mannarkad, Palakkad',
    'Karimba-II, Mannarkad, Palakkad',
    'Kottathara, Mannarkad, Palakkad',
    'Kottoppadam-I, Mannarkad, Palakkad',
    'Kottoppadam-II, Mannarkad, Palakkad',
    'Kottoppadam-III, Mannarkad, Palakkad',
    'Kumaramputhur, Mannarkad, Palakkad',
    'Mannarkad-I, Mannarkad, Palakkad',
    'Mannarkad-II, Mannarkad, Palakkad',
    'Padavayal, Mannarkad, Palakkad',
    'Palakkayam, Mannarkad, Palakkad',
    'Payyanadam, Mannarkad, Palakkad',
    'Pottassery-I, Mannarkad, Palakkad',
    'Pottassery-II, Mannarkad, Palakkad',
    'Pudur, Mannarkad, Palakkad',
    'Sholayur, Mannarkad, Palakkad',
    'Thachampara, Mannarkad, Palakkad',
    'Thachanattukara-I, Mannarkad, Palakkad',
    'Thachanattukara-II, Mannarkad, Palakkad',
    'Ambalapara-I, Ottappalam, Palakkad',
    'Ambalapara-II, Ottappalam, Palakkad',
    'Anakkara, Ottappalam, Palakkad',
    'Ananganadi, Ottappalam, Palakkad',
    'Chalavara, Ottappalam, Palakkad',
    'Chalissery, Ottappalam, Palakkad',
    'Cherpulacherry, Ottappalam, Palakkad',
    'Kadampazhipuram-I, Ottappalam, Palakkad',
    'Kadampazhipuram-II, Ottappalam, Palakkad',
    'Kappur, Ottappalam, Palakkad',
    'Karimpuzha-I, Ottappalam, Palakkad',
    'Karimpuzha-II, Ottappalam, Palakkad',
    'Koppam, Ottappalam, Palakkad',
    'Kulukkallur, Ottappalam, Palakkad',
    'Lakkidi-Perur-I, Ottappalam, Palakkad',
    'Lakkidi-Perur-II, Ottappalam, Palakkad',
    'Muthuthala, Ottappalam, Palakkad',
    'Nagalassery, Ottappalam, Palakkad',
    'Nellaya, Ottappalam, Palakkad',
    'Ongallur-I, Ottappalam, Palakkad',
    'Ongallur-II, Ottappalam, Palakkad',
    'Ottappalam, Ottappalam, Palakkad',
    'Parudur, Ottappalam, Palakkad',
    'Pattambi, Ottappalam, Palakkad',
    'Pattithara, Ottappalam, Palakkad',
    'Shoranur, Ottappalam, Palakkad',
    'Sreekrishnapuram-I, Ottappalam, Palakkad',
    'Sreekrishnapuram-II, Ottappalam, Palakkad',
    'Thirumittacode-I, Ottappalam, Palakkad',
    'Thirumittacode-II, Ottappalam, Palakkad',
    'Thiruvegapura, Ottappalam, Palakkad',
    'Thrikkadeeri-I, Ottappalam, Palakkad',
    'Thrikkadeeri-II, Ottappalam, Palakkad',
    'Thrithala, Ottappalam, Palakkad',
    'Vallapuzha, Ottappalam, Palakkad',
    'Vaniyamkulam-I, Ottappalam, Palakkad',
    'Vaniyamkulam-II, Ottappalam, Palakkad',
    'Vellinezhi, Ottappalam, Palakkad',
    'Vilayur, Ottappalam, Palakkad',
    'Elappully-I, Palakkad, Palakkad',
    'Elappully-II, Palakkad, Palakkad',
    'Hemambikanagar, Palakkad, Palakkad',
    'Kannadi-I, Palakkad, Palakkad',
    'Kannadi-II, Palakkad, Palakkad',
    'Keralassery, Palakkad, Palakkad',
    'Kodumba, Palakkad, Palakkad',
    'Kongad-I, Palakkad, Palakkad',
    'Kongad-II, Palakkad, Palakkad',
    'Malampuzha-I, Palakkad, Palakkad',
    'Malampuzha-II, Palakkad, Palakkad',
    'Mankara, Palakkad, Palakkad',
    'Mannur, Palakkad, Palakkad',
    'Marutharode, Palakkad, Palakkad',
    'Mundur-I, Palakkad, Palakkad',
    'Mundur-II, Palakkad, Palakkad',
    'Palakkad, Palakkad, Palakkad',
    'Parli-I, Palakkad, Palakkad',
    'Parli-II, Palakkad, Palakkad',
    'Peruvemba, Palakkad, Palakkad',
    'Pirayiri, Palakkad, Palakkad',
    'Polpully, Palakkad, Palakkad',
    'Pudussery Central, Palakkad, Palakkad',
    'Pudussery East, Palakkad, Palakkad',
    'Pudussery West, Palakkad, Palakkad',
    'Puthuppariyaram, Palakkad, Palakkad',
    'Puthuppariyaram-I, Palakkad, Palakkad',
    'Adoor, Pathanamthitta',
    'Kozhenchery, Pathanamthitta',
    'Mallappally, Pathanamthitta',
    'Ranni, Pathanamthitta',
    'Thiruvalla, Pathanamthitta',
    'Adoor, Adoor, Pathanamthitta',
    'Angadickal, Adoor, Pathanamthitta',
    'Enadimangalam, Adoor, Pathanamthitta',
    'Enathu, Adoor, Pathanamthitta',
    'Erathu, Adoor, Pathanamthitta',
    'Ezhamkulam, Adoor, Pathanamthitta',
    'Kadampanadu, Adoor, Pathanamthitta',
    'Kalanjoor, Adoor, Pathanamthitta',
    'Kodumon, Adoor, Pathanamthitta',
    'Koodal, Adoor, Pathanamthitta',
    'Kurampala, Adoor, Pathanamthitta',
    'Pallickal, Adoor, Pathanamthitta',
    'Pandalam, Adoor, Pathanamthitta',
    'Pandalam Thekkekara, Adoor, Pathanamthitta',
    'Peringanadu, Adoor, Pathanamthitta',
    'Aranmula, Kozhenchery, Pathanamthitta',
    'Aruvappulam, Kozhenchery, Pathanamthitta',
    'Chenneerkara, Kozhenchery, Pathanamthitta',
    'Elanthoor, Kozhenchery, Pathanamthitta',
    'Iravan, Kozhenchery, Pathanamthitta',
    'Kidangannur, Kozhenchery, Pathanamthitta',
    'Konni, Kozhenchery, Pathanamthitta',
    'Konnithazham, Kozhenchery, Pathanamthitta',
    'Kozhenchery, Kozhenchery, Pathanamthitta',
    'Kulanada, Kozhenchery, Pathanamthitta',
    'Malayalapuzha, Kozhenchery, Pathanamthitta',
    'Mallapuzhassery, Kozhenchery, Pathanamthitta',
    'Mezhuveli, Kozhenchery, Pathanamthitta',
    'Mylapra, Kozhenchery, Pathanamthitta',
    'Naranganam, Kozhenchery, Pathanamthitta',
    'Omalloor, Kozhenchery, Pathanamthitta',
    'Pathanamthitta, Kozhenchery, Pathanamthitta',
    'Pramadom, Kozhenchery, Pathanamthitta',
    'Thannithode, Kozhenchery, Pathanamthitta',
    'Vallicode, Kozhenchery, Pathanamthitta',
    'Vallicode-Kottayam, Kozhenchery, Pathanamthitta',
    'Anicad, Mallappally, Pathanamthitta',
    'Ezhumattoor, Mallappally, Pathanamthitta',
    'Kallooppara, Mallappally, Pathanamthitta',
    'Kottangal, Mallappally, Pathanamthitta',
    'Kunnamthanam, Mallappally, Pathanamthitta',
    'Mallappally, Mallappally, Pathanamthitta',
    'Perumpetty, Mallappally, Pathanamthitta',
    'Puramattam, Mallappally, Pathanamthitta',
    'Thelliyoor, Mallappally, Pathanamthitta',
    'Angadi, Ranni, Pathanamthitta',
    'Athikkayam, Ranni, Pathanamthitta',
    'Ayiroor, Ranni, Pathanamthitta',
    'Cherukole, Ranni, Pathanamthitta',
    'Chethakkal, Ranni, Pathanamthitta',
    'Chittar-Seethathodu, Ranni, Pathanamthitta',
    'Kollamula, Ranni, Pathanamthitta',
    'Pazhavangadi, Ranni, Pathanamthitta',
    'Perunad, Ranni, Pathanamthitta',
    'Ranni, Ranni, Pathanamthitta',
    'Vadasserikkara, Ranni, Pathanamthitta',
    'Eraviperoor, Thiruvalla, Pathanamthitta',
    'Kadapra, Thiruvalla, Pathanamthitta',
    'Kaviyoor, Thiruvalla, Pathanamthitta',
    'Kavumbhagom, Thiruvalla, Pathanamthitta',
    'Koipuram, Thiruvalla, Pathanamthitta',
    'Kuttoor, Thiruvalla, Pathanamthitta',
    'Nedumpuram, Thiruvalla, Pathanamthitta',
    'Niranam, Thiruvalla, Pathanamthitta',
    'Peringara, Thiruvalla, Pathanamthitta',
    'Thiruvalla, Thiruvalla, Pathanamthitta',
    'Thottapuzhassery, Thiruvalla, Pathanamthitta',
    'Chirayinkeezhu, Thiruvananthapuram',
    'Nedumangad, Thiruvananthapuram',
    'Neyyattinkara, Thiruvananthapuram',
    'Thiruvananthapuram, Thiruvananthapuram',
    'Alamcode, Chirayinkeezhu, Thiruvananthapuram',
    'Attingal, Chirayinkeezhu, Thiruvananthapuram',
    'Attingal-Avanavancherry, Chirayinkeezhu, Thiruvananthapuram',
    'Ayiroor, Chirayinkeezhu, Thiruvananthapuram',
    'Azhoor, Chirayinkeezhu, Thiruvananthapuram',
    'Chemmaruthy, Chirayinkeezhu, Thiruvananthapuram',
    'Edakkode, Chirayinkeezhu, Thiruvananthapuram',
    'Edava, Chirayinkeezhu, Thiruvananthapuram',
    'Elamba-Mudakkal, Chirayinkeezhu, Thiruvananthapuram',
    'Kadakkavoor, Chirayinkeezhu, Thiruvananthapuram',
    'Karavaram, Chirayinkeezhu, Thiruvananthapuram',
    'Keezhattingal, Chirayinkeezhu, Thiruvananthapuram',
    'Kilimanoor, Chirayinkeezhu, Thiruvananthapuram',
    'Kizhuvalam-Koonthalloor, Chirayinkeezhu, Thiruvananthapuram',
    'Koduvazhannoor, Chirayinkeezhu, Thiruvananthapuram',
    'Kudavoor, Chirayinkeezhu, Thiruvananthapuram',
    'Madavoor, Chirayinkeezhu, Thiruvananthapuram',
    'Manamboor, Chirayinkeezhu, Thiruvananthapuram',
    'Nagaroor, Chirayinkeezhu, Thiruvananthapuram',
    'Navaikulam, Chirayinkeezhu, Thiruvananthapuram',
    'Ottoor, Chirayinkeezhu, Thiruvananthapuram',
    'Pallickal, Chirayinkeezhu, Thiruvananthapuram',
    'Pazhayakunnummel, Chirayinkeezhu, Thiruvananthapuram',
    'Pulimath, Chirayinkeezhu, Thiruvananthapuram',
    'Sarkara-Chirayinkeezhu, Chirayinkeezhu, Thiruvananthapuram',
    'Vakkom, Chirayinkeezhu, Thiruvananthapuram',
    'Varkala, Chirayinkeezhu, Thiruvananthapuram',
    'Vellalloor, Chirayinkeezhu, Thiruvananthapuram',
    'Vettoor-Cherunniyoor, Chirayinkeezhu, Thiruvananthapuram',
    'Anad, Nedumangad, Thiruvananthapuram',
    'Aruvikkara, Nedumangad, Thiruvananthapuram',
    'Aryanad, Nedumangad, Thiruvananthapuram',
    'Kallara, Nedumangad, Thiruvananthapuram',
    'Karakulam, Nedumangad, Thiruvananthapuram',
    'Koliyakode, Nedumangad, Thiruvananthapuram',
    'Kurupuzha, Nedumangad, Thiruvananthapuram',
    'Manikkal, Nedumangad, Thiruvananthapuram',
    'Mannoorkara, Nedumangad, Thiruvananthapuram',
    'Nedumangad, Nedumangad, Thiruvananthapuram',
    'Nellanad, Nedumangad, Thiruvananthapuram',
    'Palode, Nedumangad, Thiruvananthapuram',
    'Panavoor, Nedumangad, Thiruvananthapuram',
    'Pangode, Nedumangad, Thiruvananthapuram',
    'Peringamala, Nedumangad, Thiruvananthapuram',
    'Perumkulam, Nedumangad, Thiruvananthapuram',
    'Pullampara, Nedumangad, Thiruvananthapuram',
    'Theakada, Nedumangad, Thiruvananthapuram',
    'Thennoor, Nedumangad, Thiruvananthapuram',
    'Tholicode, Nedumangad, Thiruvananthapuram',
    'Uzhamalackal, Nedumangad, Thiruvananthapuram',
    'Vamanapuram, Nedumangad, Thiruvananthapuram',
    'Vattappara, Nedumangad, Thiruvananthapuram',
    'Veeranakavu, Nedumangad, Thiruvananthapuram',
    'Vellanad, Nedumangad, Thiruvananthapuram',
    'Vembayam, Nedumangad, Thiruvananthapuram',
    'Vithura, Nedumangad, Thiruvananthapuram',
    'Amboori, Neyyattinkara, Thiruvananthapuram',
    'Anavoor, Neyyattinkara, Thiruvananthapuram',
    'Athiyannur, Neyyattinkara, Thiruvananthapuram',
    'Chenkal, Neyyattinkara, Thiruvananthapuram',
    'Kallikkad, Neyyattinkara, Thiruvananthapuram',
    'Kanjiramkulam, Neyyattinkara, Thiruvananthapuram',
    'Karode, Neyyattinkara, Thiruvananthapuram',
    'Karumkulam, Neyyattinkara, Thiruvananthapuram',
    'Keezharoor, Neyyattinkara, Thiruvananthapuram',
    'Kollayil, Neyyattinkara, Thiruvananthapuram',
    'Kottukal, Neyyattinkara, Thiruvananthapuram',
    'Kovalam, Neyyattinkara, Thiruvananthapuram',
    'Kulathoor, Neyyattinkara, Thiruvananthapuram',
    'Kulathummal, Neyyattinkara, Thiruvananthapuram',
    'Kunnathukal, Neyyattinkara, Thiruvananthapuram',
    'Malayinkeezhu, Neyyattinkara, Thiruvananthapuram',
    'Maranalloor, Neyyattinkara, Thiruvananthapuram',
    'Neyyattinkara, Neyyattinkara, Thiruvananthapuram',
    'Ottasekharamangalam, Neyyattinkara, Thiruvananthapuram',
    'Pallichal, Neyyattinkara, Thiruvananthapuram',
    'Parassala, Neyyattinkara, Thiruvananthapuram',
    'Parasuvaikkal, Neyyattinkara, Thiruvananthapuram',
    'Perumkadavila, Neyyattinkara, Thiruvananthapuram',
    'Thirupuram, Neyyattinkara, Thiruvananthapuram',
    'Thiruvananthapuram, Neyyattinkara, Thiruvananthapuram',
    'Vazhichal, Neyyattinkara, Thiruvananthapuram',
    'Vellarada, Neyyattinkara, Thiruvananthapuram',
    'Vilappil, Neyyattinkara, Thiruvananthapuram',
    'Vilavoorkkal, Neyyattinkara, Thiruvananthapuram',
    'Andoorkonam, Thiruvananthapuram, Thiruvananthapuram',
    'Iroopara, Thiruvananthapuram, Thiruvananthapuram',
    'Kadinamkulam, Thiruvananthapuram, Thiruvananthapuram',
    'Kalliyoor, Thiruvananthapuram, Thiruvananthapuram',
    'Kazhakkoottam, Thiruvananthapuram, Thiruvananthapuram',
    'Keezhthonnakkal, Thiruvananthapuram, Thiruvananthapuram',
    'Kudappanakkunnu, Thiruvananthapuram, Thiruvananthapuram',
    'Melthonnakkal, Thiruvananthapuram, Thiruvananthapuram',
    'Menamkulam, Thiruvananthapuram, Thiruvananthapuram',
    'Pallippuram, Thiruvananthapuram, Thiruvananthapuram',
    'Sreekaryam, Thiruvananthapuram, Thiruvananthapuram',
    'Uliyazhathura, Thiruvananthapuram, Thiruvananthapuram',
    'Vattiyoorkavu, Thiruvananthapuram, Thiruvananthapuram',
    'Veiloor, Thiruvananthapuram, Thiruvananthapuram',
    'Venganoor, Thiruvananthapuram, Thiruvananthapuram',
    'Chavakkad, Thrissur',
    'Kodungallur, Thrissur',
    'Mukundapuram, Thrissur',
    'Talappilly, Thrissur',
    'Thrissur, Thrissur',
    'Annakara, Chavakkad, Thrissur',
    'Brahmakulam, Chavakkad, Thrissur',
    'Chavakkad, Chavakkad, Thrissur',
    'Edakkazhiyur, Chavakkad, Thrissur',
    'Elavally, Chavakkad, Thrissur',
    'Engandiyur, Chavakkad, Thrissur',
    'Guruvayoor, Chavakkad, Thrissur',
    'Irimbranallur, Chavakkad, Thrissur',
    'Iringaprom, Chavakkad, Thrissur',
    'Kadappuram, Chavakkad, Thrissur',
    'Kadikkad, Chavakkad, Thrissur',
    'Kundazhiyur, Chavakkad, Thrissur',
    'Mullassery, Chavakkad, Thrissur',
    'Nattika, Chavakkad, Thrissur',
    'Orumanayur, Chavakkad, Thrissur',
    'Paluvai, Chavakkad, Thrissur',
    'Pavaratty, Chavakkad, Thrissur',
    'Perakam, Chavakkad, Thrissur',
    'Pookode, Chavakkad, Thrissur',
    'Punnayur, Chavakkad, Thrissur',
    'Punnayurkulam, Chavakkad, Thrissur',
    'Talikkulam, Chavakkad, Thrissur',
    'Thaikkad, Chavakkad, Thrissur',
    'Vadakkekad, Chavakkad, Thrissur',
    'Vadanappally, Chavakkad, Thrissur',
    'Valappad, Chavakkad, Thrissur',
    'Venkitangu, Chavakkad, Thrissur',
    'Venmanad, Chavakkad, Thrissur',
    'Vylathur, Chavakkad, Thrissur',
    'Ala, Kodungallur, Thrissur',
    'Azhikode, Kodungallur, Thrissur',
    'Chendrappini, Kodungallur, Thrissur',
    'Edathiruthy, Kodungallur, Thrissur',
    'Edavilangu, Kodungallur, Thrissur',
    'Eriyad, Kodungallur, Thrissur',
    'Kaipamangalam, Kodungallur, Thrissur',
    'Kodungallur, Kodungallur, Thrissur',
    'Koolimuttam, Kodungallur, Thrissur',
    'Madathumpady, Kodungallur, Thrissur',
    'Methala, Kodungallur, Thrissur',
    'Padinjare Vemballur, Kodungallur, Thrissur',
    'Pallippuram, Kodungallur, Thrissur',
    'Panangad, Kodungallur, Thrissur',
    'Pappinivattom, Kodungallur, Thrissur',
    'Perinjanam, Kodungallur, Thrissur',
    'Poyya, Kodungallur, Thrissur',
    'Alathur, Mukundapuram, Thrissur',
    'Alur, Mukundapuram, Thrissur',
    'Amballur, Mukundapuram, Thrissur',
    'Anandapuram, Mukundapuram, Thrissur',
    'Annallur, Mukundapuram, Thrissur',
    'Chalakudy, Mukundapuram, Thrissur',
    'Chengallur, Mukundapuram, Thrissur',
    'Edathirinji, Mukundapuram, Thrissur',
    'Elanjipra, Mukundapuram, Thrissur',
    'Irinjalakuda, Mukundapuram, Thrissur',
    'Kaduppassery, Mukundapuram, Thrissur',
    'Kakkulissery, Mukundapuram, Thrissur',
    'Kallettumkara, Mukundapuram, Thrissur',
    'Kallur, Mukundapuram, Thrissur',
    'Kallur Thekkummuri, Mukundapuram, Thrissur',
    'Kallur Vadakkummuri, Mukundapuram, Thrissur',
    'Karalam, Mukundapuram, Thrissur',
    'Karumathra, Mukundapuram, Thrissur',
    'Kattur, Mukundapuram, Thrissur',
    'Kizhakkummuri, Mukundapuram, Thrissur',
    'Kodakara, Mukundapuram, Thrissur',
    'Kodassery, Mukundapuram, Thrissur',
    'Koratty, Mukundapuram, Thrissur',
    'Kottanellur, Mukundapuram, Thrissur',
    'Kuruvilassery, Mukundapuram, Thrissur',
    'Kuttichira, Mukundapuram, Thrissur',
    'Madayikonam, Mukundapuram, Thrissur',
    'Manavalassery, Mukundapuram, Thrissur',
    'Mattathur, Mukundapuram, Thrissur',
    'Melur, Mukundapuram, Thrissur',
    'Mupliyam, Mukundapuram, Thrissur',
    'Muringur Vadakkummuri, Mukundapuram, Thrissur',
    'Muriyad, Mukundapuram, Thrissur',
    'Nandipulam, Mukundapuram, Thrissur',
    'Nellayi, Mukundapuram, Thrissur',
    'Nenmenikkara, Mukundapuram, Thrissur',
    'Padiyur, Mukundapuram, Thrissur',
    'Parappukkara, Mukundapuram, Thrissur',
    'Pariyaram, Mukundapuram, Thrissur',
    'Poomangalam, Mukundapuram, Thrissur',
    'Porathissery, Mukundapuram, Thrissur',
    'Pullur, Mukundapuram, Thrissur',
    'Puthenchira, Mukundapuram, Thrissur',
    'Puthukkad, Mukundapuram, Thrissur',
    'Thazhekkad, Mukundapuram, Thrissur',
    'Thekkumkara, Mukundapuram, Thrissur',
    'Thirumukkulam, Mukundapuram, Thrissur',
    'Thottippal, Mukundapuram, Thrissur',
    'Trikkur, Mukundapuram, Thrissur',
    'Vadakkumbhagom, Mukundapuram, Thrissur',
    'Vadakkumkara, Mukundapuram, Thrissur',
    'Vadama, Mukundapuram, Thrissur',
    'Vallivattom, Mukundapuram, Thrissur',
    'Varandarappilly, Mukundapuram, Thrissur',
    'Vellikulangara, Mukundapuram, Thrissur',
    'Vellookkara, Mukundapuram, Thrissur',
    'Akathiyoor, Talappilly, Thrissur',
    'Alur, Talappilly, Thrissur',
    'Arangottukara, Talappilly, Thrissur',
    'Attoor, Talappilly, Thrissur',
    'Chelakkara, Talappilly, Thrissur',
    'Chelakode, Talappilly, Thrissur',
    'Chemmanthatta, Talappilly, Thrissur',
    'Cheruthuruthi, Talappilly, Thrissur',
    'Chiramanangad, Talappilly, Thrissur',
    'Chiranellur, Talappilly, Thrissur',
    'Chittanda, Talappilly, Thrissur',
    'Choondal, Talappilly, Thrissur',
    'Chowwannur, Talappilly, Thrissur',
    'Desamangalam, Talappilly, Thrissur',
    'Elanad, Talappilly, Thrissur',
    'Enkakkad, Talappilly, Thrissur',
    'Eranellur, Talappilly, Thrissur',
    'Eyyal, Talappilly, Thrissur',
    'Kadangode, Talappilly, Thrissur',
    'Kadavallur, Talappilly, Thrissur',
    'Kandanassery, Talappilly, Thrissur',
    'Kanipayyur, Talappilly, Thrissur',
    'Kaniyarkode, Talappilly, Thrissur',
    'Kanjirakode, Talappilly, Thrissur',
    'Karikkad, Talappilly, Thrissur',
    'Kariyannur, Talappilly, Thrissur',
    'Karumathara, Talappilly, Thrissur',
    'Kattakampal, Talappilly, Thrissur',
    'Killimangalam, Talappilly, Thrissur',
    'Kiralur, Talappilly, Thrissur',
    'Kondazhy, Talappilly, Thrissur',
    'Kottappuram, Talappilly, Thrissur',
    'Kumaranellur, Talappilly, Thrissur',
    'Kunnamkulam, Talappilly, Thrissur',
    'Kurumala, Talappilly, Thrissur',
    'Manalithara, Talappilly, Thrissur',
    'Mangad, Talappilly, Thrissur',
    'Mayannur, Talappilly, Thrissur',
    'Minalur, Talappilly, Thrissur',
    'Mullurkara, Talappilly, Thrissur',
    'Mundathikode, Talappilly, Thrissur',
    'Nedumpura, Talappilly, Thrissur',
    'Nelluwaya, Talappilly, Thrissur',
    'Painkulam, Talappilly, Thrissur',
    'Pallur, Talappilly, Thrissur',
    'Pampady, Talappilly, Thrissur',
    'Pangarappilly, Talappilly, Thrissur',
    'Panjal, Talappilly, Thrissur',
    'Parlikad, Talappilly, Thrissur',
    'Pazhanji, Talappilly, Thrissur',
    'Pazhayannur, Talappilly, Thrissur',
    'Peringandoor, Talappilly, Thrissur',
    'Perumpilavu, Talappilly, Thrissur',
    'Pilakkad, Talappilly, Thrissur',
    'Porkulam, Talappilly, Thrissur',
    'Pulakode, Talappilly, Thrissur',
    'Puthuruthy, Talappilly, Thrissur',
    'Thalassery, Talappilly, Thrissur',
    'Thayyur, Talappilly, Thrissur',
    'Thekkumkara, Talappilly, Thrissur',
    'Thichur, Talappilly, Thrissur',
    'Thiruvilwamala, Talappilly, Thrissur',
    'Thonnurkara, Talappilly, Thrissur',
    'Vadakkethara, Talappilly, Thrissur',
    'Varavoor, Talappilly, Thrissur',
    'Vellarakkad, Talappilly, Thrissur',
    'Vellattanjur, Talappilly, Thrissur',
    'Velur, Talappilly, Thrissur',
    'Venganellur, Talappilly, Thrissur',
    'Vennur, Talappilly, Thrissur',
    'Viruppakka, Talappilly, Thrissur',
    'Wadakkanchery, Talappilly, Thrissur',
    'Adat, Thrissur, Thrissur',
    'Alappad, Thrissur, Thrissur',
    'Anjur, Thrissur, Thrissur',
    'Anthicad, Thrissur, Thrissur',
    'Arattupuzha, Thrissur, Thrissur',
    'Avanur, Thrissur, Thrissur',
    'Avinissery, Thrissur, Thrissur',
    'Chalakkal, Thrissur, Thrissur',
    'Chazhoor, Thrissur, Thrissur',
    'Cherpu, Thrissur, Thrissur',
    'Chevvoor, Thrissur, Thrissur',
    'Chittilappilly, Thrissur, Thrissur',
    'Choolissery, Thrissur, Thrissur',
    'Edakkalathur, Thrissur, Thrissur',
    'Eravu, Thrissur, Thrissur',
    'Inchamudi, Thrissur, Thrissur',
    'Kainoor, Thrissur, Thrissur',
    'Kaiparamba, Thrissur, Thrissur',
    'Karamuck, Thrissur, Thrissur',
    'Killannur, Thrissur, Thrissur',
    'Kizhakkummuri, Thrissur, Thrissur',
    'Kizhuppillikkara, Thrissur, Thrissur',
    'Kodannur, Thrissur, Thrissur',
    'Kolazhy, Thrissur, Thrissur',
    'Kozhukkully, Thrissur, Thrissur',
    'Kurichikkara, Thrissur, Thrissur',
    'Kurumpilavu, Thrissur, Thrissur',
    'Kuttoor, Thrissur, Thrissur',
    'Madakkathara, Thrissur, Thrissur',
    'Manakkody, Thrissur, Thrissur',
    'Manalur, Thrissur, Thrissur',
    'Mannamangalam, Thrissur, Thrissur',
    'Marathakkara, Thrissur, Thrissur',
    'Mulayam, Thrissur, Thrissur',
    'Nadathara, Thrissur, Thrissur',
    'Oorakam, Thrissur, Thrissur',
    'Padiyam, Thrissur, Thrissur',
    'Palissery, Thrissur, Thrissur',
    'Pallippuram, Thrissur, Thrissur',
    'Pananchery, Thrissur, Thrissur',
    'Parakkad, Thrissur, Thrissur',
    'Paralam, Thrissur, Thrissur',
    'Peechi, Thrissur, Thrissur',
    'Peramangalam, Thrissur, Thrissur',
    'Pottore, Thrissur, Thrissur',
    'Pullu, Thrissur, Thrissur',
    'Puranattukara, Thrissur, Thrissur',
    'Puthur, Thrissur, Thrissur',
    'Puzhakkal, Thrissur, Thrissur',
    'Thangalur, Thrissur, Thrissur',
    'Thanniyam, Thrissur, Thrissur',
    'Tholur, Thrissur, Thrissur',
    'Thrissur, Thrissur, Thrissur',
    'Vadakkummuri, Thrissur, Thrissur',
    'Vallachira, Thrissur, Thrissur',
    'Velappaya, Thrissur, Thrissur',
    'Vellanikkara, Thrissur, Thrissur',
    'Veluthur, Thrissur, Thrissur',
    'Venginissery, Thrissur, Thrissur',
    'Mananthavady, Wayanad',
    'Sulthanbathery, Wayanad',
    'Vythiri, Wayanad',
    'Anchukunnu, Mananthavady, Wayanad',
    'Cherukottur, Mananthavady, Wayanad',
    'Edavaka, Mananthavady, Wayanad',
    'Kanjirangad, Mananthavady, Wayanad',
    'Mananthavady, Mananthavady, Wayanad',
    'Nalloornad, Mananthavady, Wayanad',
    'Panamaram, Mananthavady, Wayanad',
    'Payyampally, Mananthavady, Wayanad',
    'Periya, Mananthavady, Wayanad',
    'Porunnanore, Mananthavady, Wayanad',
    'Thavinhal, Mananthavady, Wayanad',
    'Thirunelly, Mananthavady, Wayanad',
    'Thondernad, Mananthavady, Wayanad',
    'Thrissilery, Mananthavady, Wayanad',
    'Valat, Mananthavady, Wayanad',
    'Vellamunda, Mananthavady, Wayanad',
    'Ambalavayal, Sulthanbathery, Wayanad',
    'Cheeral, Sulthanbathery, Wayanad',
    'Irulam, Sulthanbathery, Wayanad',
    'Kidanganad, Sulthanbathery, Wayanad',
    'Krishnagiri, Sulthanbathery, Wayanad',
    'Kuppadi, Sulthanbathery, Wayanad',
    'Nadavayal, Sulthanbathery, Wayanad',
    'Nenmeni, Sulthanbathery, Wayanad',
    'Noolpuzha, Sulthanbathery, Wayanad',
    'Padichira, Sulthanbathery, Wayanad',
    'Poothadi, Sulthanbathery, Wayanad',
    'Pulpalli, Sulthanbathery, Wayanad',
    'Purakkadi, Sulthanbathery, Wayanad',
    'Sulthanbathery, Sulthanbathery, Wayanad',
    'Thomattuchal, Sulthanbathery, Wayanad',
    'Achooranam, Vythiri, Wayanad',
    'Chundale, Vythiri, Wayanad',
    'Kalpetta, Vythiri, Wayanad',
    'Kaniambetta, Vythiri, Wayanad',
    'Kavumannam, Vythiri, Wayanad',
    'Kottappadi, Vythiri, Wayanad',
    'Kottathara, Vythiri, Wayanad',
    'Kunnathidavaka, Vythiri, Wayanad',
    'Kuppadithara, Vythiri, Wayanad',
    'Muppainad, Vythiri, Wayanad',
    'Muttil North, Vythiri, Wayanad',
    'Muttil South, Vythiri, Wayanad',
    'Padinharethara, Vythiri, Wayanad',
    'Pozhuthana, Vythiri, Wayanad',
    'Thariyode, Vythiri, Wayanad',
    'Thrikkaipatta, Vythiri, Wayanad',
    'Vellarimala, Vythiri, Wayanad',
    'Vengappally, Vythiri, Wayanad',
    'Wayanad'
  ])).sort(function (a, b) {
    return a.localeCompare(b);
  });

  function normalizeDisplayName(item) {
    const parts = item.split(',').map(function (part) {
      return part.trim();
    }).filter(Boolean);

    if (parts.length >= 2 && parts[0].toLowerCase() === parts[parts.length - 1].toLowerCase()) {
      return parts[parts.length - 1];
    }

    const normalizedParts = [];
    const seenParts = new Set();

    parts.forEach(function (part) {
      const normalizedPart = part.toLowerCase();

      if (!seenParts.has(normalizedPart)) {
        normalizedParts.push(part);
        seenParts.add(normalizedPart);
      }
    });

    if (normalizedParts.length === 1) {
      return normalizedParts[0];
    }

    return normalizedParts.join(', ');
  }

  function getSearchKey(item) {
    return normalizeDisplayName(item).split(',')[0].trim().toLowerCase();
  }

  function getActiveData(fieldName) {
    if (routeScope === 'tourist' && fieldName === 'to') {
      return districtData.concat(touristData);
    }

    return districtData;
  }

  function getUniqueData(fieldName) {
    const activeData = getActiveData(fieldName);
    const seenKeys = new Set();

    return activeData.filter(function (item) {
      const normalizedItem = getSearchKey(item);

      if (seenKeys.has(normalizedItem)) {
        return false;
      }

      seenKeys.add(normalizedItem);
      return true;
    });
  }

  const uniqueDistrictData = getUniqueData('from');
  const uniqueTouristData = getUniqueData('to');

  if (!toggles.length) {
    return;
  }

  function persistRouteInputs() {
    if (fromInput) {
      sessionStorage.setItem(routeFromKey, fromInput.value.trim());
    }

    if (toInput) {
      sessionStorage.setItem(routeToKey, toInput.value.trim());
    }
  }

  if (fromInput) {
    fromInput.value = sessionStorage.getItem(routeFromKey) || '';
  }

  if (toInput) {
    toInput.value = sessionStorage.getItem(routeToKey) || '';
  }

  function renderList(toggle, query) {
    const listId = toggle.getAttribute('aria-controls');
    const list = listId ? document.getElementById(listId) : null;

    if (!list) {
      return;
    }

    const normalizedQuery = (query || '').trim().toLowerCase();
    const fieldName = toggle.getAttribute('data-dropdown') || 'from';
    const sourceData = fieldName === 'to' ? uniqueTouristData : uniqueDistrictData;
    const matches = sourceData.filter(function (item) {
      const displayName = normalizeDisplayName(item);

      if (!normalizedQuery) {
        return true;
      }

      const primaryName = displayName.split(',')[0].trim().toLowerCase();
      return primaryName.indexOf(normalizedQuery) === 0;
    });

    if (!matches.length) {
      list.innerHTML = '<button type="button" class="route-dropdown-item is-placeholder">No places found</button>';
      return;
    }

    list.innerHTML = matches.map(function (item) {
      const displayName = normalizeDisplayName(item);
      return '<button type="button" class="route-dropdown-item" data-select-value="' + displayName + '">' + displayName + '</button>';
    }).join('');
  }

  function closeDropdown(toggle) {
    const listId = toggle.getAttribute('aria-controls');
    const list = listId ? document.getElementById(listId) : null;

    toggle.setAttribute('aria-expanded', 'false');
    toggle.classList.remove('is-open');

    if (list) {
      list.hidden = true;
    }
  }

  function openDropdown(toggle) {
    const listId = toggle.getAttribute('aria-controls');
    const list = listId ? document.getElementById(listId) : null;
    const input = toggle.querySelector('.route-search-input');

    toggles.forEach(function (item) {
      if (item !== toggle) {
        closeDropdown(item);
      }
    });

    toggle.setAttribute('aria-expanded', 'true');
    toggle.classList.add('is-open');

    if (list) {
      renderList(toggle, input ? input.value : '');
      list.hidden = false;
    }
  }

  toggles.forEach(function (toggle) {
    toggle.addEventListener('click', function () {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      const input = toggle.querySelector('.route-search-input');
      const selection = window.getSelection ? window.getSelection() : null;
      const hasTextSelection = selection && selection.type === 'Range';

      if (expanded) {
        suppressedToggle = toggle;
        closeDropdown(toggle);
        if (input) {
          input.blur();
        }
        setTimeout(function () {
          if (suppressedToggle === toggle) {
            suppressedToggle = null;
          }
        }, 150);
        return;
      }

      openDropdown(toggle);

      if (input && !hasTextSelection) {
        input.focus();
        const valueLength = input.value.length;

        if (typeof input.setSelectionRange === 'function') {
          input.setSelectionRange(valueLength, valueLength);
        }
      }
    });
  });

  searchInputs.forEach(function (input) {
    input.addEventListener('focus', function () {
      const toggle = input.closest('.route-dropdown-toggle');

      if (toggle && suppressedToggle !== toggle) {
        openDropdown(toggle);
      }
    });

    input.addEventListener('click', function (event) {
      event.stopPropagation();
      const toggle = input.closest('.route-dropdown-toggle');

      if (toggle && suppressedToggle !== toggle) {
        openDropdown(toggle);
      }
    });

    input.addEventListener('input', function () {
      const toggle = input.closest('.route-dropdown-toggle');

      if (toggle) {
        openDropdown(toggle);
      }

      persistRouteInputs();
    });
  });

  document.addEventListener('click', function (event) {
    const listItem = event.target.closest('.route-dropdown-item[data-select-value]');

    if (listItem) {
      const list = listItem.closest('.route-dropdown-list');
      const toggle = list ? document.querySelector('[aria-controls="' + list.id + '"]') : null;
      const input = toggle ? toggle.querySelector('.route-search-input') : null;

      if (input) {
        input.value = listItem.getAttribute('data-select-value') || '';
      }

      persistRouteInputs();

      if (toggle) {
        closeDropdown(toggle);
      }

      return;
    }

    if (event.target.closest('.route-field')) {
      return;
    }

    toggles.forEach(closeDropdown);
  });
})();

(function () {
  const busCounters = Array.from(document.querySelectorAll('.route-bus-counter'));
  const requiredVehiclesKey = 'route-required-vehicles';

  if (!busCounters.length) {
    return;
  }

  busCounters.forEach(function (counter) {
    const valueNode = counter.querySelector('[data-bus-counter-value]');

    if (!valueNode) {
      return;
    }

    const savedRequiredCount = Number(sessionStorage.getItem(requiredVehiclesKey));

    if (savedRequiredCount >= 1) {
      valueNode.textContent = String(savedRequiredCount);
    }

    counter.addEventListener('click', function (event) {
      const button = event.target.closest('.route-bus-counter-btn[data-bus-counter]');

      if (!button) {
        return;
      }

      const currentValue = Number(valueNode.textContent) || 1;
      const nextValue = button.dataset.busCounter === 'increase'
        ? currentValue + 1
        : Math.max(1, currentValue - 1);

      valueNode.textContent = String(nextValue);
      sessionStorage.setItem(requiredVehiclesKey, String(nextValue));
    });
  });

  const submitLink = document.querySelector('.route-select-btn');

  if (submitLink) {
    submitLink.addEventListener('click', function () {
      const activeValueNode = document.querySelector('[data-bus-counter-value]');
      const requiredCount = Number(activeValueNode && activeValueNode.textContent) || 1;
      sessionStorage.setItem(requiredVehiclesKey, String(Math.max(1, requiredCount)));
    });
  }
})();

(function () {
  const pageParams = new URLSearchParams(window.location.search);
  const submitButton = document.querySelector('.route-select-btn');
  const fromInput = document.getElementById('from-value');
  const toInput = document.getElementById('to-value');
  const submitLocationBox = document.querySelector('.submit-box-location');
  const submitLocationFrom = document.querySelector('[data-submit-location-from]');
  const submitLocationTo = document.querySelector('[data-submit-location-to]');
  const submitDates = document.querySelector('[data-submit-dates]');
  const submitScope = pageParams.get('scope') || sessionStorage.getItem('route-scope');
  const singleLocationScopes = new Set(['excavator', 'backhoe']);
  const isSingleLocationScope = singleLocationScopes.has(submitScope);

  function padCompactYear(year) {
    return String(year).slice(-2);
  }

  function parseDateKey(key) {
    const parts = key.split('-').map(Number);
    return {
      year: parts[0],
      month: parts[1],
      day: parts[2]
    };
  }

  function areDatesContinuous(keys) {
    if (keys.length < 2) {
      return false;
    }

    for (let index = 1; index < keys.length; index += 1) {
      const previous = new Date(keys[index - 1]);
      const current = new Date(keys[index]);
      const difference = Math.round((current - previous) / 86400000);

      if (difference !== 1) {
        return false;
      }
    }

    return true;
  }

  function formatCompactDateRange(keys) {
    if (!keys.length) {
      return '- -';
    }

    const sortedKeys = keys.slice().sort();

    if (sortedKeys.length === 1) {
      const single = parseDateKey(sortedKeys[0]);
      return [single.day, single.month, padCompactYear(single.year)].join('|');
    }

    if (areDatesContinuous(sortedKeys)) {
      const start = parseDateKey(sortedKeys[0]);
      const end = parseDateKey(sortedKeys[sortedKeys.length - 1]);
      return `${[start.day, start.month, padCompactYear(start.year)].join('|')} - ${[end.day, end.month, padCompactYear(end.year)].join('|')}`;
    }

    const grouped = new Map();

    sortedKeys.forEach(function (key) {
      const item = parseDateKey(key);
      const groupKey = `${item.month}-${item.year}`;

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          month: item.month,
          year: item.year,
          days: []
        });
      }

      grouped.get(groupKey).days.push(item.day);
    });

    return Array.from(grouped.values()).map(function (group) {
      return `${group.days.join(',')}|${group.month}|${padCompactYear(group.year)}`;
    }).join(' ; ');
  }

  function getSafeLocationValue(input) {
    const value = input && input.value ? input.value.trim() : '';
    return value || '- -';
  }

  function formatSubmitLocationValue(value) {
    if (!value || value === '- -') {
      return '- -';
    }

    const parts = value.split(',').map(function (part) {
      return part.trim();
    }).filter(Boolean);

    if (parts.length <= 1) {
      return value;
    }

    return parts[0] + ', ' + parts[parts.length - 1];
  }

  if (submitButton) {
    submitButton.addEventListener('click', function () {
      sessionStorage.setItem('submit-location-from', getSafeLocationValue(fromInput));
      sessionStorage.setItem('submit-location-to', getSafeLocationValue(toInput));
      sessionStorage.setItem('route-location-from', getSafeLocationValue(fromInput) === '- -' ? '' : getSafeLocationValue(fromInput));
      sessionStorage.setItem('route-location-to', getSafeLocationValue(toInput) === '- -' ? '' : getSafeLocationValue(toInput));
      if (submitScope) {
        sessionStorage.setItem('route-scope', submitScope);
      }
    });
  }

  if (submitLocationFrom && submitLocationTo) {
    submitLocationFrom.textContent = formatSubmitLocationValue(sessionStorage.getItem('submit-location-from') || '- -');
    submitLocationTo.textContent = formatSubmitLocationValue(sessionStorage.getItem('submit-location-to') || '- -');

    if (isSingleLocationScope) {
      submitLocationBox && submitLocationBox.classList.add('submit-box-location-single');
      submitLocationTo.hidden = true;
    }
  }

  if (submitDates) {
    const savedDates = JSON.parse(sessionStorage.getItem('submit-selected-dates') || '[]');
    submitDates.textContent = formatCompactDateRange(savedDates);
  }
})();

(function () {
  const panel = document.querySelector('.submit-filter-panel');
  const tabs = Array.from(document.querySelectorAll('.submit-filter-tab'));
  const panes = Array.from(document.querySelectorAll('.submit-filter-pane'));
  const filterPane = document.querySelector('#submit-pane-filter');
  const categoryButtons = Array.from(document.querySelectorAll('.submit-filter-category'));
  const categoryGroups = Array.from(document.querySelectorAll('.submit-filter-group'));
  const clearButton = document.querySelector('[data-filter-action="clear"]');
  const applyButton = document.querySelector('[data-filter-action="apply"]');
  const filterCountBadge = document.querySelector('[data-filter-count]');
  const nameTabLabel = document.querySelector('[data-submit-tab="name"] .submit-filter-tab-label');
  const demoCards = Array.from(document.querySelectorAll('[data-demo-card]'));
  const demoSheet = document.querySelector('[data-demo-sheet]');
  const demoSheetGrid = demoSheet ? demoSheet.querySelector('.submit-demo-sheet-grid') : null;
  const selectedLocationLabel = demoSheet ? demoSheet.querySelector('[data-demo-selected-location]') : null;
  const bookButton = demoSheet ? demoSheet.querySelector('.submit-demo-sheet-book-btn') : null;
  let demoSheetRects = demoSheet ? Array.from(demoSheet.querySelectorAll('.submit-demo-sheet-rect')) : [];
  const selectedCardOrder = [];
  const savedRequiredVehicles = Number(sessionStorage.getItem('route-required-vehicles'));
  const requiredVehiclesCount = Math.max(1, Number.isFinite(savedRequiredVehicles) ? savedRequiredVehicles : 4);
  const totalDemoSheetBoxes = Math.max(4, requiredVehiclesCount);
  const maxSelectableVehicles = Math.min(requiredVehiclesCount, demoCards.length || requiredVehiclesCount);
  const routeScopeForCount = sessionStorage.getItem('route-scope') || '';

  if (!panel || !tabs.length || !panes.length || !filterPane) {
    return;
  }

  if (nameTabLabel) {
    let primaryTabLabel = 'Vehicles';

    if (routeScopeForCount === 'tourist') {
      primaryTabLabel = 'Buses';
    } else if (routeScopeForCount === 'truck') {
      primaryTabLabel = 'Closed Body';
    } else if (routeScopeForCount === 'open-truck') {
      primaryTabLabel = 'Open Body';
    } else if (routeScopeForCount === 'excavator') {
      primaryTabLabel = 'Excavators';
    } else if (routeScopeForCount === 'backhoe') {
      primaryTabLabel = 'Backhoe';
    }

    nameTabLabel.textContent = primaryTabLabel;
    nameTabLabel.classList.toggle('is-long', primaryTabLabel.length > 8);
  }

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  function resetSubmitScrollToTop() {
    window.scrollTo(0, 0);
    const namePane = document.querySelector('#submit-pane-name');

    if (namePane) {
      namePane.scrollTop = 0;
    }
  }

  resetSubmitScrollToTop();
  requestAnimationFrame(resetSubmitScrollToTop);
  setTimeout(resetSubmitScrollToTop, 80);

  function buildDemoSheetBoxes() {
    if (!demoSheetGrid) {
      return;
    }

    demoSheetGrid.innerHTML = '';

    for (let index = 0; index < totalDemoSheetBoxes; index += 1) {
      const rect = document.createElement('span');
      rect.className = 'submit-demo-sheet-rect';

      const plus = document.createElement('span');
      plus.className = 'submit-demo-sheet-plus';
      plus.setAttribute('aria-hidden', 'true');

      rect.appendChild(plus);
      demoSheetGrid.appendChild(rect);
    }

    demoSheetRects = Array.from(demoSheetGrid.querySelectorAll('.submit-demo-sheet-rect'));
  }

  function enableDemoSheetAnyDeviceScroll() {
    if (!demoSheetGrid) {
      return;
    }

    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;

    demoSheetGrid.addEventListener('wheel', function (event) {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return;
      }

      event.preventDefault();
      demoSheetGrid.scrollBy({
        left: event.deltaY,
        behavior: 'auto'
      });
    }, { passive: false });

    demoSheetGrid.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'touch') {
        return;
      }

      if (event.target.closest('.submit-demo-sheet-remove, .submit-demo-sheet-rect.is-preview')) {
        return;
      }

      isDragging = true;
      startX = event.clientX;
      startScrollLeft = demoSheetGrid.scrollLeft;
      demoSheetGrid.setPointerCapture(event.pointerId);
      demoSheetGrid.classList.add('is-dragging');
    });

    demoSheetGrid.addEventListener('pointermove', function (event) {
      if (!isDragging) {
        return;
      }

      const deltaX = event.clientX - startX;
      demoSheetGrid.scrollLeft = startScrollLeft - deltaX;
    });

    function stopDrag(event) {
      if (!isDragging) {
        return;
      }

      isDragging = false;
      demoSheetGrid.classList.remove('is-dragging');

      if (event && typeof event.pointerId === 'number' && demoSheetGrid.hasPointerCapture(event.pointerId)) {
        demoSheetGrid.releasePointerCapture(event.pointerId);
      }
    }

    demoSheetGrid.addEventListener('pointerup', stopDrag);
    demoSheetGrid.addEventListener('pointercancel', stopDrag);
    demoSheetGrid.addEventListener('pointerleave', stopDrag);
  }

  function applyDemoSheetCapacity() {
    demoSheetRects.forEach(function (rect, index) {
      const plusSymbol = rect.querySelector('.submit-demo-sheet-plus');
      const isDisabledByCapacity = index >= maxSelectableVehicles;
      rect.classList.toggle('is-disabled-capacity', isDisabledByCapacity);

      if (isDisabledByCapacity && plusSymbol) {
        plusSymbol.hidden = true;
      }
    });
  }

  function activateTab(targetTab) {
    const target = targetTab.getAttribute('data-submit-tab');

    if (!target) {
      return;
    }

    panel.dataset.activeTab = target;

    tabs.forEach(function (button) {
      const isActive = button === targetTab;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    panes.forEach(function (pane) {
      const isActive = pane.getAttribute('data-submit-pane') === target;
      pane.hidden = !isActive;
      pane.classList.toggle('is-active', isActive);
      pane.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      activateTab(tab);
    });

    tab.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
        return;
      }

      event.preventDefault();

      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const currentIndex = tabs.indexOf(tab);
      const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
      const nextTab = tabs[nextIndex];

      if (nextTab) {
        activateTab(nextTab);
        nextTab.focus();
      }
    });
  });

  function activateCategory(targetButton) {
    const category = targetButton.getAttribute('data-filter-category');

    if (!category) {
      return;
    }

    panel.dataset.activeCategory = category;

    categoryButtons.forEach(function (button) {
      const isActive = button === targetButton;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    categoryGroups.forEach(function (group) {
      const isActive = group.getAttribute('data-filter-group') === category;
      group.hidden = !isActive;
      group.classList.toggle('is-active', isActive);
      group.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });
  }

  categoryButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      activateCategory(button);
    });
  });

  if (categoryButtons.length) {
    activateCategory(categoryButtons[0]);
  }

  function updateFilterCountBadge() {
    if (!filterCountBadge) {
      return;
    }

    const checkedCount = Array.from(document.querySelectorAll('.submit-filter-group input[type="checkbox"]:checked')).length;

    filterCountBadge.textContent = String(checkedCount);
    filterCountBadge.hidden = checkedCount === 0;
  }

  if (clearButton) {
    clearButton.addEventListener('click', function () {
      const activeGroup = document.querySelector('.submit-filter-group.is-active');
      const checkboxes = activeGroup ? Array.from(activeGroup.querySelectorAll('input[type="checkbox"]')) : [];

      checkboxes.forEach(function (checkbox) {
        checkbox.checked = false;
      });

      updateFilterCountBadge();
    });
  }

  if (applyButton) {
    applyButton.addEventListener('click', function () {
      updateFilterCountBadge();

      const nameTab = tabs.find(function (tab) {
        return tab.getAttribute('data-submit-tab') === 'name';
      });

      if (nameTab) {
        activateTab(nameTab);
      }
    });
  }

  updateFilterCountBadge();

  function setDemoCardExpanded(card, expanded) {
    demoCards.forEach(function (otherCard) {
      const isTarget = otherCard === card;
      otherCard.classList.toggle('is-expanded', isTarget && expanded);

      const expand = otherCard.querySelector('.submit-demo-expand');

      if (expand) {
        expand.setAttribute('aria-hidden', isTarget && expanded ? 'false' : 'true');
      }
    });
  }

  function ensureDemoCardVisible(card, expanded) {
    if (!card) {
      return;
    }

    const topSafe = 64;

    function getScrollHost(element) {
      let current = element ? element.parentElement : null;

      while (current && current !== document.body) {
        const styles = window.getComputedStyle(current);
        const canScrollY = (styles.overflowY === 'auto' || styles.overflowY === 'scroll') && current.scrollHeight > current.clientHeight;

        if (canScrollY) {
          return current;
        }

        current = current.parentElement;
      }

      return document.scrollingElement || document.documentElement;
    }

    function runAutoScroll() {
      const sheetHeight = demoSheet && demoSheet.classList.contains('is-open') ? demoSheet.getBoundingClientRect().height : 0;
      const extraExpandSpace = expanded ? 84 : 0;
      const bottomSafe = sheetHeight + 18 + extraExpandSpace;
      const rect = card.getBoundingClientRect();
      const viewportTop = topSafe;
      const viewportBottom = window.innerHeight - bottomSafe;
      const scrollHost = getScrollHost(card);

      if (scrollHost !== document.scrollingElement && scrollHost !== document.documentElement) {
        const hostRect = scrollHost.getBoundingClientRect();
        const visibleTop = Math.max(hostRect.top + 30, viewportTop);
        const visibleBottom = Math.min(hostRect.bottom - 6, viewportBottom);

        if (rect.top < visibleTop || rect.bottom > visibleBottom) {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }

        const nextRect = card.getBoundingClientRect();

        if (nextRect.top < visibleTop) {
          const upBy = nextRect.top - visibleTop - 36;
          scrollHost.scrollBy({ top: upBy, behavior: 'smooth' });
          return;
        }

        if (nextRect.bottom > visibleBottom) {
          const downBy = nextRect.bottom - visibleBottom + 12;
          scrollHost.scrollBy({ top: downBy, behavior: 'smooth' });
        }
        return;
      }

      if (rect.top < viewportTop || rect.bottom > viewportBottom) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      }

      const nextRect = card.getBoundingClientRect();

      if (nextRect.top < viewportTop) {
        const upBy = nextRect.top - viewportTop - 40;
        window.scrollBy({ top: upBy, behavior: 'smooth' });
        return;
      }

      if (nextRect.bottom > viewportBottom) {
        const downBy = nextRect.bottom - viewportBottom + 12;
        window.scrollBy({ top: downBy, behavior: 'smooth' });
      }
    }

    requestAnimationFrame(runAutoScroll);

    if (expanded) {
      setTimeout(runAutoScroll, 220);
      setTimeout(runAutoScroll, 420);
    }
  }

  function ensureDemoActionsVisible(card, attempt) {
    if (!card) {
      return;
    }

    const actions = card.querySelector('.submit-demo-expand-actions');

    if (!actions || !card.classList.contains('is-expanded')) {
      return;
    }

    function getScrollHost(element) {
      let current = element ? element.parentElement : null;

      while (current && current !== document.body) {
        const styles = window.getComputedStyle(current);
        const canScrollY = (styles.overflowY === 'auto' || styles.overflowY === 'scroll') && current.scrollHeight > current.clientHeight;

        if (canScrollY) {
          return current;
        }

        current = current.parentElement;
      }

      return document.scrollingElement || document.documentElement;
    }

    const scrollHost = getScrollHost(card);
    const sheetHeight = demoSheet && demoSheet.classList.contains('is-open') ? demoSheet.getBoundingClientRect().height : 0;
    const actionsRect = actions.getBoundingClientRect();
    const viewportBottomLimit = window.innerHeight - (sheetHeight + 18);
    let visibleBottom = viewportBottomLimit;

    if (scrollHost !== document.scrollingElement && scrollHost !== document.documentElement) {
      const hostRect = scrollHost.getBoundingClientRect();
      visibleBottom = Math.min(visibleBottom, hostRect.bottom - 6);
    }

    const overflow = actionsRect.bottom - visibleBottom;
    const comfortGap = visibleBottom - actionsRect.bottom;
    const needsComfortLift = comfortGap < 36;

    if (overflow > 0 || needsComfortLift) {
      const delta = overflow > 0 ? overflow + 14 : 36 - comfortGap;
      if (scrollHost === document.scrollingElement || scrollHost === document.documentElement) {
        window.scrollBy({ top: delta, behavior: 'smooth' });
      } else {
        scrollHost.scrollBy({ top: delta, behavior: 'smooth' });
      }
    }

    if ((attempt || 0) < 12) {
      setTimeout(function () {
        ensureDemoActionsVisible(card, (attempt || 0) + 1);
      }, 80);
    }
  }

  function openDemoSheet() {
    if (!demoSheet) {
      return;
    }

    demoSheet.classList.add('is-open');
    demoSheet.setAttribute('aria-hidden', 'false');
  }

  function closeDemoSheet() {
    if (!demoSheet) {
      return;
    }

    demoSheet.classList.remove('is-open');
    demoSheet.setAttribute('aria-hidden', 'true');
  }

  function activateNameTab() {
    const nameTab = tabs.find(function (tab) {
      return tab.getAttribute('data-submit-tab') === 'name';
    });

    if (nameTab) {
      activateTab(nameTab);
    }
  }

  function syncCardSelectState(card, selected) {
    if (!card) {
      return;
    }

    card.classList.toggle('is-selected', selected);

    const selectButton = card.querySelector('[data-demo-action="select"]');

    if (selectButton) {
      selectButton.classList.toggle('is-active', selected);
      selectButton.setAttribute('aria-pressed', selected ? 'true' : 'false');
      selectButton.textContent = selected ? 'DESELECT' : 'SELECT';
    }
  }

  function addSelectedCard(card) {
    if (selectedCardOrder.indexOf(card) !== -1) {
      return true;
    }

    if (selectedCardOrder.length >= maxSelectableVehicles) {
      return false;
    }

    selectedCardOrder.push(card);
    syncCardSelectState(card, true);
    return true;
  }

  function removeSelectedCard(card) {
    const selectedIndex = selectedCardOrder.indexOf(card);

    if (selectedIndex !== -1) {
      selectedCardOrder.splice(selectedIndex, 1);
    }

    syncCardSelectState(card, false);
  }

  function focusSelectedCard(card) {
    if (!card) {
      return;
    }

    activateNameTab();
    openDemoSheet();

    requestAnimationFrame(function () {
      setDemoCardExpanded(card, true);
      ensureDemoCardVisible(card, true);
      ensureDemoActionsVisible(card, 0);
    });
  }

  function updateDemoSheetPreview() {
    if (!demoSheetRects.length) {
      return;
    }

    demoSheetRects.forEach(function (rect, index) {
      const plusSymbol = rect.querySelector('.submit-demo-sheet-plus');
      const existingPreview = rect.querySelector('.submit-demo-sheet-preview-img');
      const existingRemove = rect.querySelector('.submit-demo-sheet-remove');
      const isDisabledByCapacity = index >= maxSelectableVehicles;
      const selectedCard = selectedCardOrder[index];
      const selectedImage = selectedCard ? selectedCard.querySelector('.submit-demo-image') : null;

      if (isDisabledByCapacity) {
        rect.classList.remove('is-preview');
        rect.removeAttribute('data-demo-card-index');
        rect.removeAttribute('data-demo-selected-card');
        if (existingPreview) {
          existingPreview.remove();
        }
        if (existingRemove) {
          existingRemove.remove();
        }
        if (plusSymbol) {
          plusSymbol.hidden = true;
        }
        return;
      }

      if (!selectedImage) {
        rect.classList.remove('is-preview');
        rect.removeAttribute('data-demo-card-index');
        rect.removeAttribute('data-demo-selected-card');
        if (existingPreview) {
          existingPreview.remove();
        }
        if (existingRemove) {
          existingRemove.remove();
        }
        if (plusSymbol) {
          plusSymbol.hidden = false;
        }
        return;
      }

      let previewImage = existingPreview;

      if (!previewImage) {
        previewImage = document.createElement('img');
        previewImage.className = 'submit-demo-sheet-preview-img';
        rect.appendChild(previewImage);
      }

      previewImage.src = selectedImage.getAttribute('src') || '';
      previewImage.alt = selectedImage.getAttribute('alt') || 'Selected vehicle';
      rect.classList.add('is-preview');
      rect.setAttribute('data-demo-card-index', String(index));
      rect.setAttribute('data-demo-selected-card', String(demoCards.indexOf(selectedCard)));

      let removeButton = existingRemove;

      if (!removeButton) {
        removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'submit-demo-sheet-remove';
        removeButton.setAttribute('aria-label', 'Remove selected vehicle');
        removeButton.textContent = '\u00d7';
        rect.appendChild(removeButton);
      }

      removeButton.setAttribute('data-demo-remove', String(index));
      removeButton.setAttribute('data-demo-selected-card', String(demoCards.indexOf(selectedCard)));

      if (plusSymbol) {
        plusSymbol.hidden = true;
      }
    });

    updateSelectedLocationsLabel();
  }

  function getCardLocation(card) {
    if (!card) {
      return '';
    }

    const metas = Array.from(card.querySelectorAll('.submit-demo-meta'));
    const locationMeta = metas.find(function (node) {
      return node.textContent && node.textContent.indexOf('\u00b7') !== -1;
    }) || metas[0];
    const rawText = locationMeta ? locationMeta.textContent || '' : '';
    const locationPart = rawText.split('\u00b7')[0].trim();
    return locationPart;
  }

  function updateSelectedLocationsLabel() {
    if (!selectedLocationLabel) {
      return;
    }

    let unitLabel = 'Vehicles';

    if (routeScopeForCount === 'tourist') {
      unitLabel = 'Buses';
    } else if (routeScopeForCount === 'truck') {
      unitLabel = 'Closed Body';
    } else if (routeScopeForCount === 'open-truck') {
      unitLabel = 'Open Body';
    } else if (routeScopeForCount === 'excavator') {
      unitLabel = 'Excavators';
    } else if (routeScopeForCount === 'backhoe') {
      unitLabel = 'Backhoe';
    }

    selectedLocationLabel.textContent = selectedCardOrder.length + '/' + maxSelectableVehicles + ' ' + unitLabel;

    if (bookButton) {
      const isReadyToBook = selectedCardOrder.length === maxSelectableVehicles;
      bookButton.disabled = !isReadyToBook;
      bookButton.classList.toggle('is-disabled', !isReadyToBook);
      bookButton.setAttribute('aria-disabled', isReadyToBook ? 'false' : 'true');
    }
  }

  function resetBookingState() {
    sessionStorage.removeItem('submit-location-from');
    sessionStorage.removeItem('submit-location-to');
    sessionStorage.removeItem('route-location-from');
    sessionStorage.removeItem('route-location-to');
    sessionStorage.removeItem('submit-selected-dates');
    sessionStorage.removeItem('route-required-vehicles');

    selectedCardOrder.splice(0, selectedCardOrder.length);
    demoCards.forEach(function (card) {
      syncCardSelectState(card, false);
    });
    setDemoCardExpanded(null, false);
    updateDemoSheetPreview();
  }

  if (bookButton) {
    bookButton.addEventListener('click', function () {
      if (bookButton.disabled) {
        return;
      }

      resetBookingState();
    });
  }

  demoCards.forEach(function (card) {
    card.addEventListener('click', function (event) {
      const actionButton = event.target.closest('[data-demo-action]');

      if (actionButton) {
        event.stopPropagation();
        const actionType = actionButton.getAttribute('data-demo-action');

        if (actionType === 'select') {
          const isSelected = !card.classList.contains('is-selected');

          if (isSelected) {
            if (!addSelectedCard(card)) {
              openDemoSheet();
              return;
            }
          } else {
            removeSelectedCard(card);
          }

          setDemoCardExpanded(card, false);
          updateDemoSheetPreview();
          openDemoSheet();
          return;
        }

        if (actionType === 'view') {
          const isExpanded = card.classList.contains('is-expanded');
          const shouldExpand = !isExpanded;
          openDemoSheet();
          setDemoCardExpanded(card, shouldExpand);
          if (shouldExpand) {
            ensureDemoCardVisible(card, true);
            ensureDemoActionsVisible(card, 0);
          }
          return;
        }
      }

      const isExpanded = card.classList.contains('is-expanded');
      const shouldExpand = !isExpanded;
      openDemoSheet();
      setDemoCardExpanded(card, shouldExpand);
      if (shouldExpand) {
        ensureDemoCardVisible(card, true);
        ensureDemoActionsVisible(card, 0);
      }
    });
  });

  if (demoSheetGrid) {
    demoSheetGrid.addEventListener('click', function (event) {
      const removeButton = event.target.closest('[data-demo-remove]');

      if (removeButton) {
        event.stopPropagation();
        const removeIndex = Number(removeButton.getAttribute('data-demo-remove'));
        const cardToRemove = selectedCardOrder[removeIndex];

        if (cardToRemove) {
          removeSelectedCard(cardToRemove);
          setDemoCardExpanded(cardToRemove, false);
          updateDemoSheetPreview();
          openDemoSheet();
        }
        return;
      }

      const previewRect = event.target.closest('.submit-demo-sheet-rect.is-preview');

      if (previewRect) {
        event.stopPropagation();
        const selectedCardIndex = Number(previewRect.getAttribute('data-demo-selected-card'));
        const cardToFocus = demoCards[selectedCardIndex];

        if (cardToFocus) {
          focusSelectedCard(cardToFocus);
        }
        return;
      }
    });
  }

  if (demoSheet) {
    demoSheet.addEventListener('click', function (event) {
      if (event.target.closest('.submit-demo-sheet-grid')) {
        return;
      }

      closeDemoSheet();
    });
  }

  buildDemoSheetBoxes();
  enableDemoSheetAnyDeviceScroll();
  applyDemoSheetCapacity();
  updateDemoSheetPreview();
})();

(function () {
  const calendars = Array.from(document.querySelectorAll('.route-calendar'));
  const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  if (!calendars.length) {
    return;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function addMonths(date, amount) {
    return new Date(date.getFullYear(), date.getMonth() + amount, 1);
  }

  function getDateKey(year, month, day) {
    return [
      year,
      String(month + 1).padStart(2, '0'),
      String(day).padStart(2, '0')
    ].join('-');
  }

  function formatSelectedDates(keys) {
    if (!keys.length) {
      return 'Select 2, 3 or more dates';
    }

    return keys
      .slice()
      .sort()
      .map(function (key) {
        const parts = key.split('-').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      })
      .join(', ');
  }

  function createDayButton(label, className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'route-calendar-day ' + className;
    button.textContent = label;
    button.disabled = true;
    button.setAttribute('aria-hidden', 'true');
    return button;
  }

  function renderMonth(monthDate, selectedDates) {
    const month = monthDate.getMonth();
    const year = monthDate.getFullYear();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayKey = getDateKey(today.getFullYear(), today.getMonth(), today.getDate());
    const monthWrap = document.createElement('section');
    const header = document.createElement('div');
    const title = document.createElement('h2');
    const weekdays = document.createElement('div');
    const grid = document.createElement('div');

    monthWrap.className = 'route-calendar-month';
    header.className = 'route-calendar-month-header';
    title.className = 'route-calendar-month-title';
    title.textContent = monthDate.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });

    weekdays.className = 'route-calendar-weekdays';
    weekdayLabels.forEach(function (label) {
      const item = document.createElement('span');
      item.className = 'route-calendar-weekday';
      item.textContent = label;
      weekdays.appendChild(item);
    });

    grid.className = 'route-calendar-grid';

    for (let index = 0; index < firstWeekday; index += 1) {
      grid.appendChild(createDayButton('', 'is-placeholder'));
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = getDateKey(year, month, day);
      const button = document.createElement('button');

      button.type = 'button';
      button.className = 'route-calendar-day';
      button.textContent = String(day);
      button.dataset.dateKey = key;
      button.setAttribute('aria-pressed', selectedDates.has(key) ? 'true' : 'false');
      button.setAttribute('aria-label', new Date(year, month, day).toLocaleDateString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }));

      if (key === todayKey) {
        button.classList.add('is-today');
      }

      if (selectedDates.has(key)) {
        button.classList.add('is-selected');
      }

      grid.appendChild(button);
    }

    header.appendChild(title);

    monthWrap.appendChild(header);
    monthWrap.appendChild(weekdays);
    monthWrap.appendChild(grid);

    return monthWrap;
  }

  calendars.forEach(function (calendar) {
    const monthsHost = calendar.querySelector('[data-calendar-months]');
    const savedDateKeys = JSON.parse(sessionStorage.getItem('submit-selected-dates') || '[]');
    const state = {
      monthCursor: startOfMonth(new Date()),
      selectedDates: new Set(Array.isArray(savedDateKeys) ? savedDateKeys : [])
    };
    const swipeState = {
      startX: 0,
      startY: 0,
      active: false
    };

    if (!monthsHost) {
      return;
    }

    if (savedDateKeys.length) {
      const firstSavedDate = new Date(savedDateKeys.slice().sort()[0]);

      if (!Number.isNaN(firstSavedDate.getTime())) {
        state.monthCursor = startOfMonth(firstSavedDate);
      }
    }

    function refresh() {
      monthsHost.innerHTML = '';
      monthsHost.appendChild(renderMonth(state.monthCursor, state.selectedDates));
      sessionStorage.setItem('submit-selected-dates', JSON.stringify(Array.from(state.selectedDates).sort()));
    }

    calendar.addEventListener('click', function (event) {
      const navButton = event.target.closest('.route-calendar-nav[data-calendar-nav]');

      if (navButton) {
        state.monthCursor = addMonths(state.monthCursor, navButton.dataset.calendarNav === 'prev' ? -1 : 1);
        refresh();
        return;
      }

      const dayButton = event.target.closest('.route-calendar-day[data-date-key]');

      if (!dayButton) {
        return;
      }

      const dateKey = dayButton.dataset.dateKey;

      if (!dateKey) {
        return;
      }

      if (state.selectedDates.has(dateKey)) {
        state.selectedDates.delete(dateKey);
      } else {
        state.selectedDates.add(dateKey);
      }

      refresh();
    });

    monthsHost.addEventListener('touchstart', function (event) {
      if (window.innerWidth > 768 || !event.touches.length) {
        return;
      }

      swipeState.startX = event.touches[0].clientX;
      swipeState.startY = event.touches[0].clientY;
      swipeState.active = true;
    }, { passive: true });

    monthsHost.addEventListener('touchend', function (event) {
      if (!swipeState.active || window.innerWidth > 768 || !event.changedTouches.length) {
        swipeState.active = false;
        return;
      }

      const deltaX = event.changedTouches[0].clientX - swipeState.startX;
      const deltaY = event.changedTouches[0].clientY - swipeState.startY;

      swipeState.active = false;

      if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY)) {
        return;
      }

      state.monthCursor = addMonths(state.monthCursor, deltaX < 0 ? 1 : -1);
      refresh();
    }, { passive: true });

    refresh();
  });
})();
