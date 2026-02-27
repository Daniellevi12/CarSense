// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyDfmDZO12RvN9h5Suk2v2Air6LIr4dGIE4",
    authDomain: "carsense-abb24.firebaseapp.com",
    databaseURL: "https://carsense-abb24-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "carsense-abb24",
    storageBucket: "carsense-abb24.firebasestorage.app",
    messagingSenderId: "225453696410",
    appId: "1:225453696410:web:54ff1fba95d4b02f9f8623",
    measurementId: "G-W5DP1WBC4S"
};

const GOOGLE_API_KEY = "AIzaSyAl02aiiA_eUd-uvwOVOYDIUqA7RV-Dg2w"; // <-- replace with your key
const GOOGLE_CX = "d40150ce5f8e94232"; // your CSE ID

// ----- Firebase Imports -----
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { getDatabase, ref, set, push, onChildAdded, onValue, off } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js";

// ----- Firebase Init -----
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getDatabase(app);

document.addEventListener("DOMContentLoaded", () => {
            // ----- Page Elements -----
            const loginBtn = document.getElementById("loginBtn");
            const logoutBtn = document.getElementById("logoutBtn");
            const listenBtn = document.getElementById("listenBtn");
            const resultDiv = document.getElementById("result");
            const carSection = document.getElementById("carSection");
            const carSelect = document.getElementById("carSelect");
            const addCarBtn = document.getElementById("addCarBtn");
            const carMake = document.getElementById("carMake");
            const carModel = document.getElementById("carModel");
            const carYear = document.getElementById("carYear");
            const carPlate = document.getElementById("carPlate");
            const notes = document.getElementById("notes");
            const carsList = document.getElementById("carsList"); // cars.html
            const carSelector = document.getElementById("carSelector"); // scans.html (select)
            const scansList = document.getElementById("scansList"); // scans.html

            let currentUser = null;
            let currentCarId = null;
            let scansListeners = {};

            // Helper: show a login-required overlay when unauthenticated users
            function showLoginRequiredPopup() {
              if (document.getElementById('authGuardPopup')) return;
              const overlay = document.createElement('div');
              overlay.id = 'authGuardPopup';
              overlay.style.position = 'fixed';
              overlay.style.left = 0;
              overlay.style.top = 0;
              overlay.style.right = 0;
              overlay.style.bottom = 0;
              overlay.style.background = 'rgba(0,0,0,0.6)';
              overlay.style.zIndex = 2000;
              overlay.style.display = 'flex';
              overlay.style.alignItems = 'center';
              overlay.style.justifyContent = 'center';

              const card = document.createElement('div');
              card.style.background = '#0f1720';
              card.style.color = '#fff';
              card.style.padding = '22px';
              card.style.borderRadius = '8px';
              card.style.maxWidth = '420px';
              card.style.textAlign = 'center';
              card.style.boxShadow = '0 8px 30px rgba(0,0,0,0.6)';

              card.innerHTML = `
                <h4 style="margin-top:0;margin-bottom:8px">Please log in</h4>
                <p style="color:#cbd5e1;margin-bottom:8px">You must be signed in with Google to access this page.</p>
                <p style="color:#cbd5e1;margin-bottom:16px">נא להיכנס באמצעות חשבון Google כדי לגשת לדף זה.</p>
                <div style="display:flex;gap:8px;justify-content:center">
                  <button id="authGuardLogin" style="background:#198754;border:0;color:#fff;padding:8px 12px;border-radius:6px;">Login</button>
                  <button id="authGuardHome" style="background:transparent;border:1px solid #666;color:#ddd;padding:8px 12px;border-radius:6px;">Go Home</button>
                </div>
              `;

              overlay.appendChild(card);
              document.body.appendChild(overlay);

              document.getElementById('authGuardHome').addEventListener('click', () => {
                try { document.body.removeChild(overlay); } catch (e) {}
                window.location.href = 'index.html';
              });

              document.getElementById('authGuardLogin').addEventListener('click', () => {
                signInWithPopup(auth, provider)
                  .then(() => {
                    try { document.body.removeChild(overlay); } catch (e) {}
                    window.location.reload();
                  })
                  .catch(err => {
                    alert('Sign in failed: ' + (err && err.message ? err.message : err));
                  });
              });
            }


            // ----- Google Login -----
            if (loginBtn) {
                loginBtn.addEventListener("click", () => {
                    signInWithPopup(auth, provider)
                        .then(result => alert(`שלום ${result.user.displayName}!`))
                        .catch(console.error);
                });
            }

            // ----- Logout -----
            if (logoutBtn) {
                logoutBtn.addEventListener("click", () => signOut(auth).then(() => window.location.reload()));
            }

            // ----- Auth State -----
            onAuthStateChanged(auth, user => {
                currentUser = user || null;
              // If user is not authenticated and is trying to access protected pages,
              // show a login-needed popup (prevents manual URL access without auth).
              if (!user) {
                try {
                  const p = window.location.pathname.toLowerCase();
                  if (p.endsWith('/scans.html') || p.endsWith('/listen.html') || p.endsWith('scans.html') || p.endsWith('listen.html')) {
                    showLoginRequiredPopup();
                    return;
                  }
                } catch (e) { /* ignore */ }
              }

                if (loginBtn) loginBtn.style.display = user ? "none" : "inline-block";
                if (logoutBtn) logoutBtn.style.display = user ? "inline-block" : "none";

                // ----- Cars page -----
                if (carSection) carSection.style.display = user ? "block" : "none";
                if (listenBtn) listenBtn.disabled = !user;

                if (carsList && user) loadUserCars();
                if (carSelect && user) {
                    carSelect.innerHTML = '<option disabled selected>בחר רכב</option>';
                    resultDiv && (resultDiv.innerHTML = "");
                }

                // ----- Scans page -----
                if (scansList && carSelector) {
                    scansList.innerHTML = user ? "" : "<p>נא להתחבר כדי לראות סריקות</p>";
                    if (user) loadCarsForScans();
                }
                // ----- Load Cars for Listen.html -----
                if (carSelect && currentUser) {
                    const carsRef = ref(db, `users/${currentUser.uid}/cars`);

                  onValue(carsRef, snap => {
                    // Prefer a previously selected listen car (persisted), then currentCarId, then first
                    const persisted = localStorage.getItem('listenCarId') || null;
                    let firstCarId = null;
                    carSelect.innerHTML = '<option value="">בחר רכב</option>';

                    snap.forEach(carSnap => {
                      const carId = carSnap.key;
                      const car = carSnap.val();
                      const option = document.createElement("option");
                      option.value = carId;
                      option.textContent = `${car.make} ${car.model} (${car.year}) - ${car.plate}`;
                      carSelect.appendChild(option);
                      if (!firstCarId) firstCarId = carId;
                    });

                    // Decide which car to select: persisted -> currentCarId -> firstCarId
                    const preferred = persisted || currentCarId || firstCarId || "";
                    if (preferred) {
                      carSelect.value = preferred;
                      currentCarId = preferred;
                    }

                    // Persist selection when user changes it
                    carSelect.addEventListener('change', () => {
                      const v = carSelect.value;
                      currentCarId = v || null;
                      if (v) localStorage.setItem('listenCarId', v);
                    });
                  });
                }

            });

            // ----- Add New Car (cars.html) -----
            if (addCarBtn) {
                addCarBtn.addEventListener("click", async() => {
                    const make = carMake.value.trim();
                    const model = carModel.value.trim();
                    const year = carYear.value.trim();
                    const plate = carPlate.value.trim();
                    if (!make || !model || !year || !plate) return alert("נא למלא את כל השדות");

                    const imgUrl = await getCarImage(make, model, year);
                    const newCarRef = push(ref(db, `users/${currentUser.uid}/cars`));
                    await set(newCarRef, { make, model, year, plate, img: imgUrl || "" });

                    // Reset form
                    carMake.value = carModel.value = carYear.value = carPlate.value = "";
                    loadUserCars();
                    // Notify UI that a car was added (pages can listen for this)
                    try { document.dispatchEvent(new CustomEvent('car-added')); } catch (e) { /* ignore */ }
                });
            }

            // ----- Load User Cars (cars.html) -----
            function loadUserCars() {
              if (!currentUser || !carsList) return;
              const carsRef = ref(db, `users/${currentUser.uid}/cars`);
              off(carsRef);
              carsList.innerHTML = "";

              onChildAdded(carsRef, snap => {
                const car = snap.val();
                const div = document.createElement("div");
                div.className = "card mb-3 bg-dark text-white p-3 col-12 col-md-6";
                div.innerHTML = `
                  <h4>${car.make} ${car.model} (${car.year})</h4>
                  <p>Plate: ${car.plate}</p>
                  ${car.img ? `<img src="${car.img}" alt="${car.make} ${car.model}" style="max-width:300px; display:block; margin-top:10px;">` : ""}
                `;
                carsList.appendChild(div);
              });
            }

  // ----- Car Selection (cars.html) -----
  if (carSelect) {
    carSelect.addEventListener("change", e => {
      currentCarId = e.target.value;
      loadScans();
    });
  }

  // ----- Load Scans (cars.html) -----
  function loadScans() {
    if (!currentCarId || !resultDiv) return;
    resultDiv.innerHTML = "";
    if (notes) notes.value = "";

    if (scansListeners[currentCarId]) off(scansListeners[currentCarId]);

    const scansRef = ref(db, `users/${currentUser.uid}/cars/${currentCarId}/scans`);
    scansListeners[currentCarId] = scansRef;

    onChildAdded(scansRef, snap => {
      const scan = snap.val();
      const div = document.createElement("div");
      div.className = "alert alert-info mt-2";
      div.textContent = `תקלה: ${scan.issue || "לא ידוע"} | הערות: ${scan.notes || "אין"}`;
      resultDiv.appendChild(div);
    });

    if (notes) {
      const notesRef = ref(db, `users/${currentUser.uid}/cars/${currentCarId}/notes`);
      onValue(notesRef, snap => notes.value = snap.val() || "");
    }
  }

  // ----- Save Notes (cars.html) -----
  if (notes) {
    notes.addEventListener("change", () => {
      if (!currentCarId) return;
      set(ref(db, `users/${currentUser.uid}/cars/${currentCarId}/notes`), notes.value.trim());
    });
  }

  // ----- Listen Button (simulate scan, cars.html) -----
  if (listenBtn) {
    listenBtn.addEventListener("click", () => {
      if (!currentCarId) return alert("בחר רכב קודם");
      const newScanRef = push(ref(db, `users/${currentUser.uid}/cars/${currentCarId}/scans`));
      // set(newScanRef, { issue: "רעש חריג מהמנוע", notes: notes ? notes.value.trim() : "", timestamp: Date.now() });
    });
  }

  // ----- Load Cars for Scans (scans.html) -----
  function loadCarsForScans() {
    if (!currentUser || !carSelector) return;
    const carsRef = ref(db, `users/${currentUser.uid}/cars`);

    onValue(carsRef, snap => {
      carSelector.innerHTML = '<option value="">בחר רכב</option>';
      snap.forEach(carSnap => {
        const carId = carSnap.key;
        const car = carSnap.val();
        const option = document.createElement("option");
        option.value = carId;
        option.textContent = `${car.make} ${car.model} (${car.year}) - ${car.plate}`;
        carSelector.appendChild(option);
      });
    });

    carSelector.addEventListener("change", () => {
      const carId = carSelector.value;
      if (!carId || !scansList) return;
      scansList.innerHTML = "";

      const scansRef = ref(db, `users/${currentUser.uid}/cars/${carId}/scans`);
      onValue(scansRef, scansSnap => {
        scansList.innerHTML = "";
        if (!scansSnap.exists()) {
          scansList.innerHTML = "<p>אין סריקות לרכב זה</p>";
          return;
        }

        scansSnap.forEach(scanSnap => {
          const scan = scanSnap.val();
          const div = document.createElement("div");
          div.className = "alert alert-info mt-2 text-dark";
          div.innerHTML = `
            <strong>תקלה:</strong> ${scan.issue || "לא ידוע"}<br>
            <strong>הערות:</strong> ${scan.notes || "אין"}<br>
            <small>${scan.timestamp ? new Date(scan.timestamp + 3 * 60 * 60 * 1000).toLocaleString("he-IL") : ""}</small>
          `;
          scansList.appendChild(div);
        });
      });
    });
  }

  // ----- Fetch Car Image -----
  async function getCarImage(make, model, year) {
    const carName = `${make} ${model} ${year}`.trim();
    const cacheKey = `car_img_${carName.replace(/\s+/g, "_")}`;

    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached;

    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&searchType=image&q=${encodeURIComponent(carName)}&num=1`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        const imgUrl = data.items[0].link;
        localStorage.setItem(cacheKey, imgUrl);
        return imgUrl;
      }
    } catch (err) {
      console.error("Image fetch error:", err);
    }

    return "";
  }

});

export function saveAudioHex(hexString) {
  const db = getDatabase();
  set(ref(db, "esp32/audioHex"), hexString);
}

export function pushScan(carId, label) {
  const auth = getAuth();
  const db = getDatabase();

  const user = auth.currentUser;
  if (!user) return;

  const scansRef = ref(db, `users/${user.uid}/cars/${carId}/scans`);
  const newScan = {
    label: label,
    timestamp: Date.now()
  };

  push(scansRef, newScan);
}