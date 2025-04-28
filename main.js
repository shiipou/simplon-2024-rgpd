import {
  getCurrentUser, setCurrentUser, logout, getUsers, addUser, findUserByEmail
} from './user.js';
import { getTrips, addTrip, getUserTrips } from './trip.js';
import { addComment, getUserComments } from './comments.js';
import { geocode, geocodePromise, createMap, addTileLayer } from './map.js';

// Fonctions utilitaires
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// --- UI ---
function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <h2>Connexion / Inscription</h2>
    <form id="login-form">
      <input name="prenom" placeholder="Prénom" required />
      <input name="nom" placeholder="Nom" required />
      <input name="email" type="email" placeholder="Email" required />
      <input name="tel" placeholder="Téléphone" required />
      <input name="photo" type="file" accept="image/*" />
      <button type="submit">Se connecter / S'inscrire</button>
    </form>
  `;
  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const email = form.email.value.trim();
    let user = findUserByEmail(email);
    let photoData = '';
    if (form.photo.files[0]) {
      photoData = await toBase64(form.photo.files[0]);
    }
    if (!user) {
      user = {
        prenom: form.prenom.value.trim(),
        nom: form.nom.value.trim(),
        email,
        tel: form.tel.value.trim(),
        photo: photoData,
        home: '',
        work: ''
      };
      addUser(user);
    }
    setCurrentUser(user);
    renderProfile();
  };
}

function renderProfile() {
  const app = document.getElementById('app');
  const user = getCurrentUser();
  if (!user) return renderLogin();
  // Blocage si une des adresses n'est pas renseignée
  if (!user.home || !user.work) {
    app.innerHTML = `
      <h2>Complétez vos adresses</h2>
      <p>Pour accéder à l'application, vous devez renseigner à la fois votre adresse de domicile et votre adresse de travail.<br>
      Cela permet d'assurer la sécurité et la pertinence des trajets proposés.</p>
      <form id="address-form-blocked">
        <div style="position:relative;">
          <input id="home-input" name="home" placeholder="Adresse domicile" value="${user.home || ''}" autocomplete="off" required />
          <ul id="home-suggestions" class="autocomplete-list"></ul>
        </div>
        <div style="position:relative;">
          <input id="work-input" name="work" placeholder="Adresse travail" value="${user.work || ''}" autocomplete="off" required />
          <ul id="work-suggestions" class="autocomplete-list"></ul>
        </div>
        <button type="submit">Valider mes adresses</button>
      </form>
    `;
    document.getElementById('address-form-blocked').onsubmit = (e) => {
      e.preventDefault();
      const user = getCurrentUser();
      user.home = e.target.home.value.trim();
      user.work = e.target.work.value.trim();
      addUser(user);
      setCurrentUser(user);
      renderProfile();
    };
    setupAddressAutocomplete('home-input', 'home-suggestions');
    setupAddressAutocomplete('work-input', 'work-suggestions');
    return;
  }
  app.innerHTML = `
    <h2>Bienvenue, ${user.prenom} ${user.nom}</h2>
    ${user.photo ? `<img src="${user.photo}" class="profile-pic" />` : ''}
    <p>Email : ${user.email}<br>Tél : ${user.tel}</p>
    <form id="address-form">
      <div style="position:relative;">
        <input id="home-input" name="home" placeholder="Adresse domicile" value="${user.home || ''}" autocomplete="off" required />
        <ul id="home-suggestions" class="autocomplete-list"></ul>
      </div>
      <div style="position:relative;">
        <input id="work-input" name="work" placeholder="Adresse travail" value="${user.work || ''}" autocomplete="off" required />
        <ul id="work-suggestions" class="autocomplete-list"></ul>
      </div>
      <button type="submit">Valider mes adresses</button>
    </form>
    <button id="add-trip">Ajouter un trajet</button>
    <button id="show-history">Voir mon historique</button>
    <button id="show-map">Carte des trajets</button>
    <button id="show-profile">Mon profil public</button>
    <button onclick="logout()">Déconnexion</button>
  `;
  document.getElementById('address-form').onsubmit = (e) => {
    e.preventDefault();
    user.home = e.target.home.value.trim();
    user.work = e.target.work.value.trim();
    addUser(user); // Met à jour l'utilisateur
    setCurrentUser(user);
    renderProfile();
  };
  document.getElementById('add-trip').addEventListener('click', renderAddTrip);
  document.getElementById('show-history').addEventListener('click', renderHistory);
  document.getElementById('show-profile').addEventListener('click', () => renderPublicProfile(user.email));
  document.getElementById('show-map').addEventListener('click', () => location.reload());

  // Autocomplétion adresse API gouvernementale
  setupAddressAutocomplete('home-input', 'home-suggestions');
  setupAddressAutocomplete('work-input', 'work-suggestions');
}

function setupAddressAutocomplete(inputId, listId, centerOnSelect = false) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  let timer;
  input.addEventListener('input', function() {
    clearTimeout(timer);
    const value = input.value.trim();
    if (value.length < 3) {
      list.innerHTML = '';
      return;
    }
    timer = setTimeout(() => {
      fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(value)}&limit=5`)
        .then(r => r.json())
        .then(data => {
          list.innerHTML = '';
          if (data && data.features) {
            data.features.forEach(f => {
              const li = document.createElement('li');
              li.textContent = f.properties.label;
              li.style.cursor = 'pointer';
              li.addEventListener('click', () => {
                input.value = f.properties.label;
                list.innerHTML = '';
                if (centerOnSelect && window.leafletMapInstance && f.geometry && f.geometry.coordinates) {
                  // f.geometry.coordinates = [lon, lat]
                  window.leafletMapInstance.setView([f.geometry.coordinates[1], f.geometry.coordinates[0]], 15);
                  L.marker([f.geometry.coordinates[1], f.geometry.coordinates[0]]).addTo(window.leafletMapInstance).bindPopup('Adresse sélectionnée').openPopup();
                }
              });
              list.appendChild(li);
            });
          }
        });
    }, 250);
  });
  document.addEventListener('click', function(e) {
    if (!input.contains(e.target) && !list.contains(e.target)) {
      list.innerHTML = '';
    }
  });
}

function renderAddTrip() {
  const app = document.getElementById('app');
  const user = getCurrentUser();
  if (!user.home || !user.work) {
    alert('Veuillez renseigner vos adresses domicile et travail.');
    return renderProfile();
  }
  let from = user.home;
  let to = user.work;
  app.innerHTML = `
    <h2>Nouveau trajet</h2>
    <form id="trip-form">
      <input id="from-input" name="from" value="${from}" readonly />
      <input id="to-input" name="to" value="${to}" readonly />
      <button type="button" id="swap-btn">Permuter</button>
      <input name="date" type="date" required />
      <input name="time" type="time" required />
      <input name="video" type="url" placeholder="Lien vidéo YouTube (optionnel)" />
      <button type="submit">Valider le trajet</button>
    </form>
    <button onclick="renderProfile()">Retour</button>
  `;
  document.getElementById('swap-btn').addEventListener('click', () => {
    const fromInput = document.getElementById('from-input');
    const toInput = document.getElementById('to-input');
    const tmp = fromInput.value;
    fromInput.value = toInput.value;
    toInput.value = tmp;
  });
  document.getElementById('trip-form').addEventListener('submit', (e) => {
    e.preventDefault();
    addTrip({
      userEmail: user.email,
      from: e.target.from.value,
      to: e.target.to.value,
      date: e.target.date.value,
      time: e.target.time.value,
      video: e.target.video.value.trim()
    });
    alert('Trajet ajouté !');
    renderProfile();
  });
}

function renderHistory() {
  const app = document.getElementById('app');
  const user = getCurrentUser();
  const trips = getUserTrips(user.email);
  app.innerHTML = `
    <h2>Historique de mes trajets</h2>
    <ul>
      ${trips.map(t => `<li>${t.date} ${t.time} : ${t.from} → ${t.to}</li>`).join('')}
    </ul>
    <button onclick="renderProfile()">Retour</button>
  `;
}

function renderPublicProfile(email) {
  const app = document.getElementById('app');
  const user = findUserByEmail(email);
  const comments = getUserComments(email);
  app.innerHTML = `
    <h2>Profil public de ${user.prenom} ${user.nom}</h2>
    ${user.photo ? `<img src="${user.photo}" class="profile-pic" />` : ''}
    <p>Email : ${user.email}<br>Tél : ${user.tel}</p>
    <h3>Commentaires publics</h3>
    <div id="comments">
      ${comments.map(c => `<div class="comment"><b>${c.authorName}</b> : ${c.text}</div>`).join('')}
    </div>
    <form id="comment-form">
      <textarea name="text" placeholder="Laisser un commentaire public..." required></textarea>
      <button type="submit">Publier</button>
    </form>
    <button onclick="renderProfile()">Retour</button>
  `;
  document.getElementById('comment-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const current = getCurrentUser();
    addComment({
      targetEmail: email,
      authorName: current.prenom + ' ' + current.nom,
      text: e.target.text.value.trim()
    });
    renderPublicProfile(email);
  });
}

function renderViewProfile(email) {
  const app = document.getElementById('app');
  const user = findUserByEmail(email);
  if (!user) {
    app.innerHTML = '<p>Utilisateur introuvable.</p><button onclick="renderProfile()">Retour</button>';
    return;
  }
  const comments = getUserComments(email);
  app.innerHTML = `
    <h2>Profil de ${user.prenom} ${user.nom}</h2>
    ${user.photo ? `<img src="${user.photo}" class="profile-pic" />` : ''}
    <p><b>Email :</b> ${user.email}<br><b>Tél :</b> ${user.tel}</p>
    <p><b>Domicile :</b> ${user.home || 'Non renseigné'}<br><b>Travail :</b> ${user.work || 'Non renseigné'}</p>
    <h3>Commentaires publics</h3>
    <div id="comments">
      ${comments.length ? comments.map(c => `<div class="comment"><b>${c.authorName}</b> : ${c.text}</div>`).join('') : '<i>Aucun commentaire</i>'}
    </div>
    <button onclick="renderProfile()">Retour</button>
  `;
}

// --- Carte Leaflet ---
let leafletMapInstance = null;

function renderMapView(lat = 48.8566, lon = 2.3522) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <h2>Carte des trajets disponibles</h2>
    <div style="position:relative;">
      <input id="search-address" placeholder="Rechercher une adresse..." autocomplete="off" />
      <ul id="search-suggestions" class="autocomplete-list"></ul>
    </div>
    <button id="search-btn">Rechercher</button>
    <div id="map"></div>
    <ul id="trip-list"></ul>
    <button onclick="renderProfile()">Mon profil</button>
  `;
  setTimeout(() => initMap(lat, lon), 0);
  setupAddressAutocomplete('search-address', 'search-suggestions', true);
}

function initMap(lat = 48.8566, lon = 2.3522) {
  // Détruire la carte précédente si elle existe
  if (window.leafletMapInstance) {
    try {
      window.leafletMapInstance.remove();
    } catch (e) {}
    window.leafletMapInstance = null;
  }
  // Nettoyer le conteneur #map pour éviter les artefacts Leaflet
  const mapDiv = document.getElementById('map');
  if (!mapDiv) return;
  mapDiv.innerHTML = '';
  // Créer la carte
  window.leafletMapInstance = createMap('map', [lat, lon], 12);
  addTileLayer(window.leafletMapInstance);
  const map = window.leafletMapInstance;

  const trips = getTrips();
  const users = getUsers();
  const bounds = L.latLngBounds();

  // Géocodage de tous les trajets
  Promise.all(trips.map(trip =>
    Promise.all([
      geocodePromise(trip.from),
      geocodePromise(trip.to)
    ]).then(([fromCoord, toCoord]) => ({ trip, fromCoord, toCoord }))
  )).then(results => {
    // Grouper par coordonnées (en string)
    const groupByCoord = {};
    results.forEach(({ trip, fromCoord, toCoord }) => {
      if (fromCoord) {
        const key = fromCoord.join(',');
        if (!groupByCoord[key]) groupByCoord[key] = { coord: fromCoord, trajets: [] };
        groupByCoord[key].trajets.push({ ...trip, type: 'Départ', coord: fromCoord });
        bounds.extend(fromCoord);
      }
      if (toCoord) {
        const key = toCoord.join(',');
        if (!groupByCoord[key]) groupByCoord[key] = { coord: toCoord, trajets: [] };
        groupByCoord[key].trajets.push({ ...trip, type: 'Arrivée', coord: toCoord });
        bounds.extend(toCoord);
      }
    });
    // Afficher un marqueur par point unique
    Object.values(groupByCoord).forEach(({ coord, trajets }) => {
      const popupContent = trajets.map(trip => {
        const user = users.find(u => u.email === trip.userEmail);
        let videoEmbed = '';
        if (trip.video) {
          const match = trip.video.match(/(?:v=|youtu.be\/)([\w-]{11})/);
          if (match) {
            videoEmbed = `<div style='margin:8px 0;'><iframe width='220' height='124' src='https://www.youtube.com/embed/${match[1]}' frameborder='0' allowfullscreen></iframe></div>`;
          }
        }
        return `<div style='margin-bottom:8px;'>
          <b>${user ? user.prenom + ' ' + user.nom : trip.userEmail}</b> <span style='color:#6366f1;'>(${trip.type})</span><br>
          ${trip.date} ${trip.time}<br>
          ${trip.from} → ${trip.to}<br>
          ${videoEmbed}
          <a href="#" class="view-profile-link" data-email="${trip.userEmail}">Voir profil</a>
        </div>`;
      }).join('<hr style="margin:6px 0;">');
      const marker = L.marker(coord).addTo(map).bindPopup(popupContent);
      marker.on('popupopen', function(e) {
        setTimeout(() => {
          document.querySelectorAll('.view-profile-link').forEach(link => {
            link.addEventListener('click', (ev) => {
              ev.preventDefault();
              const email = ev.target.getAttribute('data-email');
              window.renderViewProfile(email);
              map.closePopup();
            });
          });
        }, 0);
      });
    });
    // Afficher les lignes de trajets
    results.forEach(({ trip, fromCoord, toCoord }) => {
      if (fromCoord && toCoord) {
        L.polyline([fromCoord, toCoord], {color: 'blue'}).addTo(map)
          .bindPopup(`${trip.from} → ${trip.to}`);
      }
    });
    if (bounds.isValid()) {
      map.fitBounds(bounds, {padding: [30, 30]});
    }
  });

  document.getElementById('search-btn').addEventListener('click', () => {
    const query = document.getElementById('search-address').value.trim();
    if (!query) return;
    geocode(query, (coord) => {
      if (coord) {
        map.setView(coord, 14);
        L.marker(coord).addTo(map).bindPopup('Adresse recherchée').openPopup();
      } else {
        alert('Adresse non trouvée');
      }
    });
  });

  const tripList = document.getElementById('trip-list');
  tripList.innerHTML = trips.map(trip => {
    const user = users.find(u => u.email === trip.userEmail);
    let videoEmbed = '';
    if (trip.video) {
      const match = trip.video.match(/(?:v=|youtu.be\/)([\w-]{11})/);
      if (match) {
        videoEmbed = `<div style='margin:8px 0;'><iframe width='220' height='124' src='https://www.youtube.com/embed/${match[1]}' frameborder='0' allowfullscreen></iframe></div>`;
      }
    }
    return `<div style='margin-bottom:8px;'>
      <b>${user ? user.prenom + ' ' + user.nom : trip.userEmail}</b><br>
      ${trip.date} ${trip.time}<br>
      ${trip.from} → ${trip.to}<br>
      ${videoEmbed}
      <a href="#" class="view-profile-link" data-email="${trip.userEmail}">Voir profil</a>
    </div>`;
  }).join('');
  setTimeout(() => {
    document.querySelectorAll('.view-profile-link').forEach(link => {
      link.addEventListener('click', (ev) => {
        ev.preventDefault();
        const email = ev.target.getAttribute('data-email');
        window.renderViewProfile(email);
        map.closePopup();
      });
    });
  }, 0);
}

// Initialisation
window.addEventListener('DOMContentLoaded', () => {
    // Afficher la carte des trajets en page d'accueil, centré sur la localisation de l'utilisateur
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          renderMapView(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          // Si refus ou erreur, centrer sur Paris
          renderMapView(48.8566, 2.3522);
        }
      );
    } else {
      renderMapView(48.8566, 2.3522);
    }
});

// Pour accès global à certaines fonctions (retour boutons)
window.renderProfile = renderProfile;
window.logout = logout;
window.renderViewProfile = renderViewProfile;
