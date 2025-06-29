// script.js (Versi Final Lengkap dengan Navigasi Bar dan Perbaikan Bug)

document.addEventListener('DOMContentLoaded', () => {

    // --- KONFIGURASI ---
    const API_KEY = 'AIzaSyCXetZR21T2WrT42K3VQlrFM-CxAYYvg3U';
    const FOLDER_ID = '1SlotOnzWfK0imRA1uCETvJC076Hmcq5-';
    // --- AKHIR KONFIGURASI ---


    // --- ELEMEN DOM ---
    // Navigasi & Halaman
    const hamburger = document.querySelector('.hamburger');
    const menuWrapper = document.querySelector('.menu-wrapper');
    const navLinks = document.querySelectorAll('.nav-link');
    const navLogo = document.querySelector('.nav-logo');
    const pages = document.querySelectorAll('.page-content');
    const dropdownNav = document.querySelector('.dropdown-nav');
    const categoryDropdown = document.getElementById('category-dropdown');

    // Konten
    const bookGallery = document.getElementById('book-gallery');
    const loader = document.getElementById('loader');
    const searchInput = document.getElementById('searchInput');
    
    // Modal PDF
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
        // Menu Hamburger
        hamburger.addEventListener('click', toggleMobileMenu);

        // Navigasi Halaman
        navLinks.forEach(link => link.addEventListener('click', handlePageNavigation));
        navLogo.addEventListener('click', handlePageNavigation);

        // Klik dropdown kategori di mobile
        dropdownNav.querySelector('.nav-link').addEventListener('click', (e) => {
            if (window.innerWidth <= 992) {
                e.preventDefault();
                dropdownNav.classList.toggle('open');
            }
        });

        // Pencarian
        searchInput.addEventListener('input', handleSearch);

        // Buka Buku
        bookGallery.addEventListener('click', handleBookClick);

        // Modal Controls
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
            // Tutup menu mobile setelah navigasi
            if (menuWrapper.classList.contains('active')) {
                toggleMobileMenu();
            }
        }
    }

    function showPage(pageId) {
        pages.forEach(page => {
            page.classList.toggle('active', page.id === `${pageId}-page`);
        });
        navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.page === pageId);
        });
    }

    function handleSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        // Pencarian hanya relevan di halaman beranda
        if (!document.getElementById('home-page').classList.contains('active')) {
            showPage('home');
        }
        
        const activeCategoryLink = categoryDropdown.querySelector('a.active');
        const activeCategory = activeCategoryLink ? activeCategoryLink.dataset.category : 'Semua Kategori';
        
        let booksToSearch = allBooks;
        if (activeCategory !== 'Semua Kategori') {
            booksToSearch = allBooks.filter(book => book.category === activeCategory);
        }

        const filteredBooks = booksToSearch.filter(book => 
            book.name.toLowerCase().includes(searchTerm)
        );
        displayBooks(filteredBooks);
    }
    
    function handleBookClick(e) {
        const card = e.target.closest('.book-card');
        if (card) {
            openPdfViewer(card.dataset.fileId);
        }
    }
    
    function handleCategoryClick(e) {
        e.preventDefault();
        const selectedCategory = e.target.dataset.category;
        showPage('home'); // Pindah ke halaman beranda saat kategori dipilih
        
        // Hapus & set 'active' class
        categoryDropdown.querySelectorAll('a').forEach(a => a.classList.remove('active'));
        e.target.classList.add('active');
        
        // Tutup menu mobile jika terbuka
        if (menuWrapper.classList.contains('active')) {
            toggleMobileMenu();
        }

        searchInput.value = ''; // Reset pencarian
        
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
        gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
        }).then(fetchFoldersAndFiles);
    }

    function fetchFoldersAndFiles() {
        loader.style.display = 'block';
        bookGallery.style.display = 'none';

        gapi.client.drive.files.list({
            'q': `'${FOLDER_ID}' in parents`,
            'pageSize': 100,
            'fields': "files(id, name, mimeType)"
        }).then(response => {
            const items = response.result.files;
            const folders = items.filter(item => item.mimeType === 'application/vnd.google-apps.folder');
            const rootFiles = items.filter(item => item.mimeType === 'application/pdf');

            allBooks.push(...rootFiles.map(file => ({ ...file, category: 'Lainnya' })));
            processFolders(folders);
        });
    }

    async function processFolders(folders) {
        const promises = folders.map(folder => 
            gapi.client.drive.files.list({
                q: `'${folder.id}' in parents and mimeType='application/pdf'`,
                pageSize: 100,
                fields: "files(id, name)"
            }).then(response => 
                response.result.files.map(file => ({ ...file, category: folder.name }))
            )
        );
        
        const results = await Promise.all(promises);
        results.forEach(booksFromFolder => allBooks.push(...booksFromFolder));
        allBooks.sort((a, b) => a.name.localeCompare(b.name));
        
        displayCategories();
        displayBooks(allBooks);

        loader.style.display = 'none';
        bookGallery.style.display = 'grid';
    }

    function displayCategories() {
        const categories = ['Semua Kategori', ...new Set(allBooks.map(book => book.category))];
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

    async function displayBooks(books) {
        bookGallery.innerHTML = '<div class="loader"></div>';
        const thumbnailPromises = books.map(book => 
            gapi.client.drive.files.get({
                fileId: book.id,
                fields: 'thumbnailLink'
            }).then(response => ({...book, thumbnailLink: response.result.thumbnailLink}))
        );

        const booksWithThumbnails = await Promise.all(thumbnailPromises);
        bookGallery.innerHTML = '';
        
        if (booksWithThumbnails.length > 0) {
            booksWithThumbnails.forEach(book => {
                const card = document.createElement('div');
                card.className = 'book-card';
                card.dataset.fileId = book.id;
                card.dataset.fileName = book.name;
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
        window.addEventListener('click', (e) => {
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

    // FUNGSI INI SUDAH DIPERBAIKI
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
