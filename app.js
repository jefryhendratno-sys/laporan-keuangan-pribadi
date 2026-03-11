// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    onSnapshot, 
    serverTimestamp,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCiE6bYxSFV3ZNKWC74mqTT3DUixeTRCVQ",
  authDomain: "tes-baru-f99bf.firebaseapp.com",
  projectId: "tes-baru-f99bf",
  storageBucket: "tes-baru-f99bf.firebasestorage.app",
  messagingSenderId: "1044114943785",
  appId: "1:1044114943785:web:cf9f069fb0be68ca589138",
  measurementId: "G-05YM06CZD9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// --- DOM Elements ---
// Views
const authView = document.getElementById('auth-view');
const dashboardView = document.getElementById('dashboard-view');

// Auth elements
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const btnGoogle = document.getElementById('btn-google');
const userEmailDisplay = document.getElementById('user-email');
const btnLogout = document.getElementById('btn-logout');

// Form elements
const entryForm = document.getElementById('entry-form');
const typeRadios = document.getElementsByName('entry_type');
const amountInput = document.getElementById('amount');
const dateInput = document.getElementById('date');
const descInput = document.getElementById('description');
const imageInput = document.getElementById('invoice-image');
const imagePreviewContainer = document.getElementById('image-preview');
const previewImg = document.getElementById('preview-img');
const btnRemoveImage = document.getElementById('btn-remove-image');
const btnSaveEntry = document.getElementById('btn-save-entry');

// List and Summary
const entryList = document.getElementById('entry-list');
const totIncomeEl = document.getElementById('tot-income');
const totExpenseEl = document.getElementById('tot-expense');
const totBalanceEl = document.getElementById('tot-balance');

// Notification
const notification = document.getElementById('notification');

// State
let currentUser = null;
let currentImageFile = null;
let unsubscribeSnapshot = null;

// --- Helper Functions ---

// 1. Format Currency (IDR)
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
};

// 2. Format Date
const formatDate = (dateStr) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('id-ID', options);
};

// 3. Show Notification
const showNotification = (message, type = 'success') => {
    notification.textContent = message;
    notification.className = `notification ${type}`;
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
};

// --- Authentication Logic ---

// Set auth state observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User logged in
        currentUser = user;
        showDashboard();
        userEmailDisplay.textContent = user.email;
        // Fetch data
        subscribeToData(user.uid);
    } else {
        // User logged out
        currentUser = null;
        if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
            unsubscribeSnapshot = null;
        }
        showAuthView();
    }
});

function showDashboard() {
    authView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
}

function showAuthView() {
    dashboardView.classList.add('hidden');
    authView.classList.remove('hidden');
    entryList.innerHTML = '<li class="empty-state">Belum ada transaksi.</li>';
    resetSummary();
    authForm.reset();
}

// Login Event
btnLogin.addEventListener('click', async (e) => {
    e.preventDefault();
    if(!authForm.checkValidity()) {
        authForm.reportValidity();
        return;
    }
    
    const email = emailInput.value;
    const password = passwordInput.value;
    
    try {
        btnLogin.disabled = true;
        btnLogin.textContent = "Memproses...";
        await signInWithEmailAndPassword(auth, email, password);
        showNotification("Berhasil masuk!");
    } catch (error) {
        showNotification(getFirebaseErrorMessage(error.code), "error");
    } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = "Masuk";
    }
});

// Register Event
btnRegister.addEventListener('click', async () => {
    if(!emailInput.value || !passwordInput.value) {
        showNotification("Harap isi email dan password untuk mendaftar", "error");
        return;
    }
    
    try {
        btnRegister.disabled = true;
        btnRegister.textContent = "Mendaftarkan...";
        await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
        showNotification("Akun berhasil dibuat!");
    } catch (error) {
        showNotification(getFirebaseErrorMessage(error.code), "error");
    } finally {
        btnRegister.disabled = false;
        btnRegister.textContent = "Daftar Akun Baru";
    }
});

// Google Sign-In Event
const googleProvider = new GoogleAuthProvider();
btnGoogle.addEventListener('click', async () => {
    try {
        btnGoogle.disabled = true;
        btnGoogle.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
        await signInWithPopup(auth, googleProvider);
        showNotification("Berhasil masuk dengan Google!");
    } catch (error) {
        showNotification(getFirebaseErrorMessage(error.code), "error");
    } finally {
        btnGoogle.disabled = false;
        btnGoogle.innerHTML = '<img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" width="18" height="18"> Masuk dengan Google';
    }
});

// Logout Event
btnLogout.addEventListener('click', () => {
    signOut(auth);
});

// User Friendly Error Messages
function getFirebaseErrorMessage(code) {
    switch(code) {
        case 'auth/invalid-email': return "Format email tidak valid.";
        case 'auth/user-not-found': return "Akun tidak ditemukan.";
        case 'auth/wrong-password': return "Password salah.";
        case 'auth/email-already-in-use': return "Email sudah terdaftar.";
        case 'auth/weak-password': return "Password minimal 6 karakter.";
        default: return "Terjadi kesalahan: " + code;
    }
}


// --- Form & Image Logic ---

// Image Preview
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        if (!file.type.match('image.*')) {
            showNotification("Hanya file gambar yang diperbolehkan", "error");
            return;
        }
        
        // Max 5MB
        if (file.size > 5 * 1024 * 1024) {
            showNotification("Ukuran gambar maksimal 5MB", "error");
            return;
        }

        currentImageFile = file;
        const reader = new FileReader();
        
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            imagePreviewContainer.classList.remove('hidden');
        }
        
        reader.readAsDataURL(file);
    }
});

btnRemoveImage.addEventListener('click', () => {
    currentImageFile = null;
    imageInput.value = '';
    imagePreviewContainer.classList.add('hidden');
    previewImg.src = '';
});

// Save Entry Event
entryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    let selectedType = 'pengeluaran';
    for (const radio of typeRadios) {
        if (radio.checked) {
            selectedType = radio.value;
            break;
        }
    }

    const amount = Number(amountInput.value);
    const date = dateInput.value;
    const desc = descInput.value;

    if (!amount || amount <= 0 || !date || !desc) {
        showNotification("Mohon lengkapi semua data wajib", "error");
        return;
    }

    try {
        btnSaveEntry.disabled = true;
        btnSaveEntry.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

        let photoUrl = null;

        // 1. Upload Image if exists
        if (currentImageFile) {
            // Generate unique filename
            const fileName = `invoices/${currentUser.uid}/${Date.now()}_${currentImageFile.name}`;
            const storageRef = ref(storage, fileName);
            
            const snapshot = await uploadBytes(storageRef, currentImageFile);
            photoUrl = await getDownloadURL(snapshot.ref);
        }

        // 2. Save Document to Firestore
        const entryData = {
            uid: currentUser.uid,
            type: selectedType, // 'pemasukan' or 'pengeluaran'
            amount: amount,
            date: date,
            description: desc,
            photoUrl: photoUrl,
            timestamp: serverTimestamp() // For exact ordering
        };

        await addDoc(collection(db, "transactions"), entryData);
        
        showNotification("Transaksi berhasil disimpan!");
        resetForm();

    } catch (error) {
        console.error("Error saving entry: ", error);
        showNotification("Gagal menyimpan data.", "error");
    } finally {
        btnSaveEntry.disabled = false;
        btnSaveEntry.textContent = "Simpan Transaksi";
    }
});

function resetForm() {
    amountInput.value = '';
    descInput.value = '';
    
    // Keep the date as is (user might want to enter multiple on same date)
    
    // Reset image
    btnRemoveImage.click();
}

// --- Data Fetching & Rendering ---

function subscribeToData(uid) {
    // Only query data belonging to the current user
    // We order by Date (string format YYYY-MM-DD allows correct string sorting)
    const q = query(
        collection(db, "transactions"), 
        where("uid", "==", uid),
        orderBy("date", "desc") // Recent first
    );

    unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const transactions = [];
        let totalIncome = 0;
        let totalExpense = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            data.id = doc.id;
            transactions.push(data);
            
            // Calculate totals
            if (data.type === 'pemasukan') {
                totalIncome += data.amount;
            } else {
                totalExpense += data.amount;
            }
        });

        renderList(transactions);
        updateSummary(totalIncome, totalExpense);

    }, (error) => {
        console.error("Firebase listen error:", error);
        if(error.code === 'failed-precondition') {
            showNotification("Membutuhkan index Database. Periksa console.", "error");
        }
    });
}

function renderList(transactions) {
    entryList.innerHTML = '';
    
    if (transactions.length === 0) {
        entryList.innerHTML = '<li class="empty-state">Belum ada transaksi.</li>';
        return;
    }

    transactions.forEach(t => {
        const li = document.createElement('li');
        li.className = `entry-item type-${t.type}`;
        
        const isPemasukan = t.type === 'pemasukan';
        const icon = isPemasukan ? '<i class="fas fa-arrow-down" style="color:var(--success-color)"></i>' : '<i class="fas fa-arrow-up" style="color:var(--danger-color)"></i>';
        
        // Handle optional photo
        const photoBtn = t.photoUrl 
            ? `<button class="entry-photo-btn" onclick="openModal('${t.photoUrl}')"><i class="fas fa-image"></i> Lihat Foto</button>` 
            : ``;

        li.innerHTML = `
            <div class="entry-info">
                <div class="entry-title">${t.description}</div>
                <div class="entry-date">${formatDate(t.date)}</div>
            </div>
            <div class="entry-amount-container">
                <div class="entry-amount">${icon} ${formatCurrency(t.amount)}</div>
                ${photoBtn}
            </div>
        `;
        
        entryList.appendChild(li);
    });
}

function updateSummary(income, expense) {
    const balance = income - expense;
    
    totIncomeEl.textContent = formatCurrency(income);
    totExpenseEl.textContent = formatCurrency(expense);
    totBalanceEl.textContent = formatCurrency(balance);
    
    // Colorize balance
    if (balance > 0) {
        totBalanceEl.style.color = 'var(--success-color)';
    } else if (balance < 0) {
        totBalanceEl.style.color = 'var(--danger-color)';
    } else {
        totBalanceEl.style.color = 'var(--text-primary)';
    }
}

function resetSummary() {
    totIncomeEl.textContent = "Rp 0";
    totExpenseEl.textContent = "Rp 0";
    totBalanceEl.textContent = "Rp 0";
    totBalanceEl.style.color = 'var(--text-primary)';
}

// --- Global UI Helpers ---
window.openModal = function(url) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    // Close on background click
    modal.onclick = function(e) {
        if(e.target === modal) {
            document.body.removeChild(modal);
        }
    };

    modal.innerHTML = `
        <div class="invoice-modal">
            <div class="invoice-modal-header">
                <h3>Foto Bukti/Invoice</h3>
                <button class="btn-remove" onclick="document.body.removeChild(this.closest('.modal-overlay'))" style="position:relative; width:30px; top:0; right:0;"><i class="fas fa-times"></i></button>
            </div>
            <img src="${url}" alt="Invoice" onerror="this.onerror=null; this.src=''; this.alt='Gagal memuat gambar';">
            <a href="${url}" target="_blank" class="btn btn-secondary mt-2"><i class="fas fa-external-link-alt"></i> Buka Resolusi Penuh</a>
        </div>
    `;
    
    document.body.appendChild(modal);
}
