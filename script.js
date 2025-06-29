// script.js (Versi Final dengan Fitur Dropdown Kategori)

document.addEventListener('DOMContentLoaded', () => {

    // --- KONFIGURASI ---
    const API_KEY = 'AIzaSyCXetZR21T2WrT42K3VQlrFM-CxAYYvg3U';
    const FOLDER_ID = '1SlotOnzWfK0imRA1uCETvJC076Hmcq5-';
    // --- AKHIR KONFIGURASI ---


    // Elemen DOM
    const bookGallery = document.getElementById('book-gallery');
    const loader = document.getElementById('loader');
    const searchInput = document.getElementById('searchInput');
    // Elemen baru untuk dropdown
    const dropdownWrapper = document.querySelector('.dropdown-wrapper');
    const dropdownBtn = document.getElementById('dropdown-btn');
    const dropdownContent = document.getElementById('category-dropdown');
    const dropdownBtnText = dropdownBtn.querySelector('span');
    
    // Elemen DOM untuk modal
    const modal = document.getElementById('pdf-modal');
    const closeModalBtn = document.querySelector('.close-button');
    const pdfCanvas = document.getElementById('pdf-canvas');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageNumSpan = document.getElementById('page-num');
    const pageCountSpan = document.getElementById('page-count');
    const viewerLoader = document.getElementById('viewer-loader');
    
    let allBooks = [];
    let pdfDoc = null;
    let pageNum = 1;
    let pageRendering = false;
    let pageNumPending = null;

    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js`;

    // --- LOGIKA DROPDOWN BARU ---
    dropdownBtn.addEventListener('click', () => {
        dropdownWrapper.classList.toggle('open');
    });

    window.addEventListener('click', (e) => {
        if (!dropdownWrapper.contains(e.target)) {
            dropdownWrapper.classList.remove('open');
        }
    });
    // --- AKHIR LOGIKA DROPDOWN ---

    function loadGapi() {
        gapi.load('client', initClient);
    }

    function initClient() {
        gapi.client.init({
            'apiKey': API_KEY,
            'discoveryDocs': ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
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
                'q': `'${folder.id}' in parents and mimeType='application/pdf'`,
                'pageSize': 100,
                'fields': "files(id, name)"
            }).then(response => {
                const files = response.result.files;
                return files.map(file => ({ ...file, category: folder.name }));
            })
        );
        
        const results = await Promise.all(promises);
        results.forEach(booksFromFolder => {
            allBooks.push(...booksFromFolder);
        });

        allBooks.sort((a, b) => a.name.localeCompare(b.name));
        
        displayCategories();
        displayBooks(allBooks);

        loader.style.display = 'none';
        bookGallery.style.display = 'grid';
    }

    /**
     * LOGIKA BARU: Mengisi item ke dalam dropdown menu.
     */
    function displayCategories() {
        const categories = ['Semua Kategori', ...new Set(allBooks.map(book => book.category))];
        dropdownContent.innerHTML = '';
        
        categories.forEach(category => {
            const link = document.createElement('a');
            link.textContent = category;
            link.dataset.category = category;
            
            if (category === 'Semua Kategori') {
                link.classList.add('active');
            }
            
            link.addEventListener('click', handleCategoryClick);
            dropdownContent.appendChild(link);
        });
    }
    
    /**
     * LOGIKA BARU: Menangani klik pada item dropdown.
     */
    function handleCategoryClick(e) {
        e.preventDefault(); // Mencegah link melakukan navigasi
        const selectedCategory = e.target.dataset.category;
        
        // Update teks tombol utama
        dropdownBtnText.textContent = selectedCategory;

        // Tutup dropdown
        dropdownWrapper.classList.remove('open');
        
        // Hapus class 'active' dari semua link, lalu tambahkan ke yang diklik
        document.querySelectorAll('.dropdown-content a').forEach(a => a.classList.remove('active'));
        e.target.classList.add('active');
        
        // Kosongkan pencarian
        searchInput.value = '';

        // Filter buku berdasarkan kategori
        if (selectedCategory === 'Semua Kategori') {
            displayBooks(allBooks);
        } else {
            const filteredBooks = allBooks.filter(book => book.category === selectedCategory);
            displayBooks(filteredBooks);
        }
    }

    async function displayBooks(books) {
        bookGallery.innerHTML = '<div class="loader"></div>'; // Tampilkan loader sementara
        
        const thumbnailPromises = books.map(book => 
            gapi.client.drive.files.get({
                fileId: book.id,
                fields: 'thumbnailLink'
            }).then(response => ({...book, thumbnailLink: response.result.thumbnailLink}))
        );

        const booksWithThumbnails = await Promise.all(thumbnailPromises);
        bookGallery.innerHTML = ''; // Hapus loader
        
        if (booksWithThumbnails.length > 0) {
            booksWithThumbnails.forEach(book => {
                const card = document.createElement('div');
                card.className = 'book-card';
                card.dataset.fileId = book.id;
                card.dataset.fileName = book.name;

                const cover = document.createElement('div');
                cover.className = 'book-cover';
                if (book.thumbnailLink) {
                    const highResThumb = book.thumbnailLink.replace('s220', 's400');
                    cover.innerHTML = `<img src="${highResThumb}" alt="Sampul ${book.name}" loading="lazy">`;
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

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const activeCategoryLink = document.querySelector('.dropdown-content a.active');
        const activeCategory = activeCategoryLink.dataset.category;
        
        let booksToSearch = allBooks;
        if (activeCategory !== 'Semua Kategori') {
            booksToSearch = allBooks.filter(book => book.category === activeCategory);
        }

        const filteredBooks = booksToSearch.filter(book => 
            book.name.toLowerCase().includes(searchTerm)
        );
        displayBooks(filteredBooks);
    });

    // ===================================
    // KODE MODAL VIEWER TIDAK BERUBAH
    // ===================================
    bookGallery.addEventListener('click', (e) => {
        const card = e.target.closest('.book-card');
        if (card) {
            const fileId = card.dataset.fileId;
            openPdfViewer(fileId);
        }
    });

    function openPdfViewer(fileId) {
        modal.classList.add('visible');
        viewerLoader.style.display = 'block';
        pdfCanvas.style.display = 'none';

        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${API_KEY}`;
        
        const loadingTask = pdfjsLib.getDocument({ 
            url: url,
            cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/cmaps/`,
            cMapPacked: true,
        });

        loadingTask.promise.then(pdf => {
            pdfDoc = pdf;
            pageCountSpan.textContent = pdf.numPages;
            pageNum = 1;
            renderPage(pageNum);
        }).catch(err => {
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
            const pdfViewerContainer = document.getElementById('pdf-viewer-container');
            const containerWidth = pdfViewerContainer.clientWidth;
            const viewportDefault = page.getViewport({ scale: 1 });
            const scale = containerWidth / viewportDefault.width;
            const viewport = page.getViewport({ scale: scale });

            const context = pdfCanvas.getContext('2d');
            pdfCanvas.height = viewport.height;
            pdfCanvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            const renderTask = page.render(renderContext);
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
        if (pageRendering) {
            pageNumPending = num;
        } else {
            renderPage(num);
        }
    }

    function updateNavButtons() {
        prevPageBtn.disabled = (pageNum <= 1);
        nextPageBtn.disabled = (pageNum >= pdfDoc.numPages);
    }
    
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

    loadGapi();
});
