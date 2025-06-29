// script.js (Versi Final yang Lebih Cepat dan Stabil)

document.addEventListener('DOMContentLoaded', () => {

    // --- KONFIGURASI ---
    const API_KEY = 'AIzaSyCXetZR21T2WrT42K3VQlrFM-CxAYYvg3U';
    const FOLDER_ID = '1SlotOnzWfK0imRA1uCETvJC076Hmcq5-';
    // --- AKHIR KONFIGURASI ---


    // --- ELEMEN DOM ---
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
    loadGapi();
    setupEventListeners();


    // --- EVENT LISTENERS SETUP ---
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


    // --- HANDLER FUNCTIONS ---
    function toggleMobileMenu() {
        hamburger.classList.toggle('active');
        menuWrapper.classList.toggle('active');
    }

    function handlePageNavigation(e) {
        e.preventDefault();
        const pageId = e.currentTarget.dataset.page;
        if (pageId) {
            showPage(pageId);
            if (menuWrapper.classList.contains('active')) toggleMobileMenu();
        }
    }

    function showPage(pageId) {
        pages.forEach(page => page.classList.toggle('active', page.id === `${pageId}-page`));
        navLinks.forEach(link => link.classList.toggle('active', link.dataset.page === pageId));
    }

    function handleSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        if (!document.getElementById('home-page').classList.contains('active')) showPage('home');
        
        const activeCategoryLink = categoryDropdown.querySelector('a.active');
        const activeCategory = activeCategoryLink ? activeCategoryLink.dataset.category : 'Semua Kategori';
        
        let booksToSearch = allBooks;
        if (activeCategory !== 'Semua Kategori') {
            booksToSearch = allBooks.filter(book => book.category === activeCategory);
        }

        const filteredBooks = booksToSearch.filter(book => book.name.toLowerCase().includes(searchTerm));
        displayBooks(filteredBooks);
    }
    
    function handleBookClick(e) {
        const card = e.target.closest('.book-card');
        if (card) openPdfViewer(card.dataset.fileId);
    }
    
    function handleCategoryClick(e) {
        e.preventDefault();
        const selectedCategory = e.target.dataset.category;
        showPage('home');
        categoryDropdown.querySelectorAll('a').forEach(a => a.classList.remove('active'));
        e.target.classList.add('active');
        if (menuWrapper.classList.contains('active')) toggleMobileMenu();
        searchInput.value = '';
        
        if (selectedCategory === 'Semua Kategori') {
            displayBooks(allBooks);
        } else {
            const filteredBooks = allBooks.filter(book => book.category === selectedCategory);
            displayBooks(filteredBooks);
        }
    }


    // --- LOGIKA UTAMA (API, DISPLAY, DLL) ---
    function loadGapi() {
        gapi.load('client', initClient);
    }

    function initClient() {
        // Tampilkan skeleton SEGERA setelah gapi siap
        displaySkeletonLoading();
        gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
        }).then(fetchFoldersAndFiles);
    }
    
    // Fungsi untuk menampilkan kerangka loading
    function displaySkeletonLoading() {
        bookGallery.style.display = 'grid';
        bookGallery.innerHTML = '';
        for (let i = 0; i < 12; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'skeleton-card';
            bookGallery.appendChild(skeleton);
        }
    }

    // Fungsi yang disederhanakan dan dioptimalkan untuk mengambil data
    function fetchFoldersAndFiles() {
        // OPTIMASI: Minta thumbnailLink dari awal untuk mengurangi panggilan API
        const fields = "files(id, name, mimeType, thumbnailLink)"; 
        
        gapi.client.drive.files.list({
            'q': `'${FOLDER_ID}' in parents`,
            'pageSize': 100,
            'fields': fields
        }).then(response => {
            const items = response.result.files;
            const folders = items.filter(item => item.mimeType === 'application/vnd.google-apps.folder');
            const rootFiles = items.filter(item => item.mimeType === 'application/pdf');

            let fetchedBooks = rootFiles.map(file => ({ ...file, category: 'Lainnya' }));
            
            const folderPromises = folders.map(folder =>
                gapi.client.drive.files.list({
                    q: `'${folder.id}' in parents and mimeType='application/pdf'`,
                    pageSize: 100,
                    fields: fields // Minta thumbnailLink juga untuk file di dalam folder
                }).then(res => res.result.files.map(file => ({ ...file, category: folder.name })))
            );

            Promise.all(folderPromises).then(results => {
                results.forEach(booksFromFolder => fetchedBooks.push(...booksFromFolder));
                allBooks = fetchedBooks.sort((a, b) => a.name.localeCompare(b.name));
                
                // Setelah semua data siap, tampilkan kategori dan buku
                displayCategories();
                displayBooks(allBooks);
            });
        }).catch(err => {
            console.error("Gagal mengambil data dari Google Drive:", err);
            bookGallery.innerHTML = `<p style='text-align:center; color: red;'>Gagal memuat buku. Silakan coba muat ulang halaman.</p>`;
        });
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

    // Fungsi ini sekarang jauh lebih cepat karena tidak ada lagi panggilan API di dalamnya
    function displayBooks(books) {
        bookGallery.innerHTML = '';
        if (books.length > 0) {
            books.forEach((book, index) => {
                const card = document.createElement('div');
                card.className = 'book-card';
                card.dataset.fileId = book.id;
                card.style.animationDelay = `${index * 50}ms`; // Delay untuk animasi staggered

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


    // --- LOGIKA MODAL PDF (Tidak berubah) ---
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

        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${API_KEY}`;
        const loadingTask = pdfjsLib.getDocument({ url, cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/cmaps/`, cMapPacked: true });

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

    function renderPage(num) {
        pageRendering = true;
        viewerLoader.style.display = 'block';
        pdfCanvas.style.display = 'none';
        
        pdfDoc.getPage(num).then(page => {
            const containerWidth = document.getElementById('pdf-viewer-container').clientWidth;
            const viewport = page.getViewport({ scale: containerWidth / page.getViewport({ scale: 1 }).width });
            const context = pdfCanvas.getContext('2d');
            pdfCanvas.height = viewport.height;
            pdfCanvas.width = viewport.width;
            
            const renderTask = page.render({ canvasContext: context, viewport: viewport });

            renderTask.promise.then(() => {
                pageRendering = false;
                viewerLoader.style.display = 'none';
                pdfCanvas.style.display = 'block';

                if (pageNumPending !== null) {
                    renderPage(pageNumPending);
                    pageNumPending = null;
                }
            });
        });
        pageNumSpan.textContent = num;
        updateNavButtons();
    }

    function queueRenderPage(num) {
        if (pageRendering) pageNumPending = num;
        else renderPage(num);
    }

    function updateNavButtons() {
        prevPageBtn.disabled = (pageNum <= 1);
        nextPageBtn.disabled = (pageNum >= pdfDoc.numPages);
    }
});
