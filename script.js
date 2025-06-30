// script.js (Versi Final yang Menggunakan Proxy Serverless)

document.addEventListener('DOMContentLoaded', () => {

    // --- KONFIGURASI ---
    // ALAMAT "ASISTEN" ANDA (URL DARI CLOUDFLARE WORKER)
    const PROXY_URL = 'https://perpustakaan-proxy.wispy-sea-8a40.workers.dev/'; // <<< GANTI DENGAN URL WORKER ANDA
    // --- AKHIR KONFIGURASI ---


    // --- ELEMEN DOM --- (Tidak ada perubahan)
    const hamburger = document.querySelector('.hamburger');
    const menuWrapper = document.querySelector('.menu-wrapper');
    const navLinks = document.querySelectorAll('.nav-link');
    const navLogo = document.querySelector('.nav-logo');
    const pages = document.querySelectorAll('.page-content');
    const dropdownNav = document.querySelector('.dropdown-nav');
    const categoryDropdown = document.getElementById('category-dropdown');
    const bookGallery = document.getElementById('book-gallery');
    const searchInput = document.getElementById('searchInput');
    const modal = document.getElementById('pdf-modal');
    const closeModalBtn = document.querySelector('.close-button');
    const pdfCanvas = document.getElementById('pdf-canvas');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageNumSpan = document.getElementById('page-num');
    const pageCountSpan = document.getElementById('page-count');
    const viewerLoader = document.getElementById('viewer-loader');
    
    // --- STATE ---
    let allBooks = [];
    let pdfDoc = null;
    let pageNum = 1;
    let pageRendering = false;
    let pageNumPending = null;

    // --- INISIALISASI ---
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js`;
    // Tidak perlu lagi gapi.load(), langsung panggil fungsi utama
    loadBooks(); 
    setupEventListeners();

    // --- EVENT LISTENERS SETUP --- (Tidak ada perubahan)
    function setupEventListeners() {
        hamburger.addEventListener('click', toggleMobileMenu);
        navLinks.forEach(link => link.addEventListener('click', handlePageNavigation));
        navLogo.addEventListener('click', handlePageNavigation);
        dropdownNav.querySelector('.nav-link').addEventListener('click', (e) => {
            if (window.innerWidth <= 992) {
                e.preventDefault();
                dropdownNav.classList.toggle('open');
            }
        });
        searchInput.addEventListener('input', handleSearch);
        bookGallery.addEventListener('click', handleBookClick);
        setupModalControls();
    }


    // --- HANDLER FUNCTIONS --- (Tidak ada perubahan)
    function toggleMobileMenu(){hamburger.classList.toggle('active');menuWrapper.classList.toggle('active')}function handlePageNavigation(e){e.preventDefault();const t=e.currentTarget.dataset.page;t&&(showPage(t),menuWrapper.classList.contains("active")&&toggleMobileMenu())}function showPage(e){pages.forEach(t=>t.classList.toggle('active',t.id===`${e}-page`));navLinks.forEach(t=>t.classList.toggle("active",t.dataset.page===e))}function handleSearch(e){const t=e.target.value.toLowerCase();document.getElementById("home-page").classList.contains("active")||showPage("home");const a=categoryDropdown.querySelector("a.active")?categoryDropdown.querySelector("a.active").dataset.category:"Semua Kategori";let o=allBooks;"Semua Kategori"!==a&&(o=allBooks.filter(e=>e.category===a));const i=o.filter(e=>e.name.toLowerCase().includes(t));displayBooks(i)}function handleBookClick(e){const t=e.target.closest(".book-card");t&&openPdfViewer(t.dataset.fileId)}function handleCategoryClick(e){e.preventDefault();const t=e.target.dataset.category;showPage("home"),categoryDropdown.querySelectorAll("a").forEach(e=>e.classList.remove("active")),e.target.classList.add("active"),menuWrapper.classList.contains("active")&&toggleMobileMenu(),searchInput.value="","Semua Kategori"===t?displayBooks(allBooks):displayBooks(allBooks.filter(e=>e.category===t))}

    // --- LOGIKA UTAMA (API, DISPLAY, DLL) ---
    function loadBooks() {
        displaySkeletonLoading();
        // Ambil data dari proxy, bukan lagi dari Google API secara langsung
        fetch(`${PROXY_URL}?action=list`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                allBooks = data;
                displayCategories();
                displayBooks(allBooks);
            })
            .catch(err => {
                console.error("Gagal mengambil data dari Proxy Worker:", err);
                bookGallery.innerHTML = `<p style='text-align:center; color: red;'>Gagal memuat daftar buku dari server. Silakan coba lagi nanti.</p>`;
            });
    }
    
    function displaySkeletonLoading() {
        bookGallery.style.display = 'grid';
        bookGallery.innerHTML = '';
        for (let i = 0; i < 12; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'skeleton-card';
            bookGallery.appendChild(skeleton);
        }
    }

    function displayCategories() {
        const categories = ['Semua Kategori', ...new Set(allBooks.map(book => book.category || 'Lainnya'))];
        categoryDropdown.innerHTML = '';
        
        categories.forEach(category => {
            const link = document.createElement('a');
            link.href = "#";
            link.textContent = category;
            link.dataset.category = category;
            if (category === 'Semua Kategori') link.classList.add('active');
            link.addEventListener('click', handleCategoryClick);
            categoryDropdown.appendChild(link);
        });
    }

    function displayBooks(books) {
        bookGallery.innerHTML = '';
        if (books.length > 0) {
            books.forEach((book, index) => {
                const card = document.createElement('div');
                card.className = 'book-card';
                card.dataset.fileId = book.id;
                card.style.animationDelay = `${index * 50}ms`;
                const cover = document.createElement('div');
                cover.className = 'book-cover';
                if (book.thumbnailLink) {
                    cover.innerHTML = `<img src="${book.thumbnailLink.replace('s220', 's400')}" alt="Sampul ${book.name}" loading="lazy">`;
                } else {
                    cover.textContent = 'Tidak Ada Sampul';
                }
                const title = document.createElement('div');
                title.className = 'book-title';
                title.textContent = book.name.replace(/\.pdf$/i, '');
                card.appendChild(cover);
                card.appendChild(title);
                bookGallery.appendChild(card);
            });
        } else {
            bookGallery.innerHTML = "<p style='text-align:center;'>Tidak ada buku yang ditemukan.</p>";
        }
    }

    // --- LOGIKA MODAL PDF ---
    function setupModalControls() {
        closeModalBtn.addEventListener('click', () => {
            modal.classList.remove('visible');
            pdfDoc = null;
        });
        window.addEventListener('click', e => {
            if (e.target == modal) {
                modal.classList.remove('visible');
                pdfDoc = null;
            }
        });
        prevPageBtn.addEventListener('click', () => {
            if (pageNum <= 1) return;
            pageNum--;
            queueRenderPage(pageNum);
        });
        nextPageBtn.addEventListener('click', () => {
            if (pageNum >= pdfDoc.numPages) return;
            pageNum++;
            queueRenderPage(pageNum);
        });
    }

    function openPdfViewer(fileId) {
        modal.classList.add('visible');
        viewerLoader.style.display = 'block';
        pdfCanvas.style.display = 'none';

        // Ambil konten PDF juga melalui proxy
        const url = `${PROXY_URL}?action=get&fileId=${fileId}`;
        const loadingTask = pdfjsLib.getDocument({ url });

        loadingTask.promise.then(pdf => {
            pdfDoc = pdf;
            pageCountSpan.textContent = pdf.numPages;
            pageNum = 1;
            renderPage(pageNum);
        }, err => {
            console.error("Error loading PDF:", err);
            viewerLoader.style.display = 'none';
            document.getElementById('pdf-viewer-container').innerHTML = "<p style='color:red;'>Gagal memuat PDF.</p>";
        });
    }

    function renderPage(num){pageRendering=!0,viewerLoader.style.display="block",pdfCanvas.style.display="none",pdfDoc.getPage(num).then(e=>{const t=document.getElementById("pdf-viewer-container").clientWidth,a=e.getViewport({scale:1}),o=e.getViewport({scale:t/a.width}),i=pdfCanvas.getContext("2d");pdfCanvas.height=o.height,pdfCanvas.width=o.width;const n={canvasContext:i,viewport:o};e.render(n).promise.then(()=>{pageRendering=!1,viewerLoader.style.display="none",pdfCanvas.style.display="block",null!==pageNumPending&&(renderPage(pageNumPending),pageNumPending=null)})}),pageNumSpan.textContent=num,updateNavButtons()}function queueRenderPage(e){pageRendering?pageNumPending=e:renderPage(e)}function updateNavButtons(){prevPageBtn.disabled=pageNum<=1,nextPageBtn.disabled=pageNum>=pdfDoc.numPages}

});
