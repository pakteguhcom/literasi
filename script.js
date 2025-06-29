// script.js (Versi Final dengan Fitur Kategori)

document.addEventListener('DOMContentLoaded', () => {

    // --- KONFIGURASI ---
    const API_KEY = 'AIzaSyCXetZR21T2WrT42K3VQlrFM-CxAYYvg3U';
    const FOLDER_ID = '1SlotOnzWfK0imRA1uCETvJC076Hmcq5-';
    // --- AKHIR KONFIGURASI ---


    // Elemen DOM
    const bookGallery = document.getElementById('book-gallery');
    const loader = document.getElementById('loader');
    const searchInput = document.getElementById('searchInput');
    const categoryFilters = document.getElementById('category-filters');

    // ... (Elemen DOM untuk modal tetap sama)
    const modal = document.getElementById('pdf-modal');
    const closeModalBtn = document.querySelector('.close-button');
    const pdfCanvas = document.getElementById('pdf-canvas');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageNumSpan = document.getElementById('page-num');
    const pageCountSpan = document.getElementById('page-count');
    const viewerLoader = document.getElementById('viewer-loader');
    
    let allBooks = []; // Sekarang akan berisi objek {..., category: 'Nama Kategori'}
    let pdfDoc = null;
    let pageNum = 1;
    let pageRendering = false;
    let pageNumPending = null;

    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js`;

    function loadGapi() {
        gapi.load('client', initClient);
    }

    function initClient() {
        gapi.client.init({
            'apiKey': API_KEY,
            'discoveryDocs': ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
        }).then(fetchFoldersAndFiles); // Ganti fungsi yang dipanggil
    }

    /**
     * LOGIKA BARU: Tahap 1
     * Mengambil semua item (folder dan file) dari folder utama.
     */
    function fetchFoldersAndFiles() {
        loader.style.display = 'block';
        bookGallery.style.display = 'none';

        gapi.client.drive.files.list({
            'q': `'${FOLDER_ID}' in parents`,
            'pageSize': 100,
            'fields': "files(id, name, mimeType)" // Ambil tipe mime untuk membedakan folder/file
        }).then(response => {
            const items = response.result.files;
            
            // Pisahkan antara folder (kategori) dan file PDF di folder utama
            const folders = items.filter(item => item.mimeType === 'application/vnd.google-apps.folder');
            const rootFiles = items.filter(item => item.mimeType === 'application/pdf');

            // Tambahkan file di folder utama ke daftar buku dengan kategori 'Lainnya'
            allBooks.push(...rootFiles.map(file => ({ ...file, category: 'Lainnya' })));
            
            // Proses setiap folder untuk mengambil file PDF di dalamnya
            processFolders(folders);
        });
    }

    /**
     * LOGIKA BARU: Tahap 2
     * Memproses setiap folder untuk mengambil PDF di dalamnya secara paralel.
     * @param {Array} folders - Daftar folder yang akan diproses.
     */
    async function processFolders(folders) {
        // Buat array dari promise, di mana setiap promise mengambil file dari satu folder
        const promises = folders.map(folder => 
            gapi.client.drive.files.list({
                'q': `'${folder.id}' in parents and mimeType='application/pdf'`,
                'pageSize': 100,
                'fields': "files(id, name)"
            }).then(response => {
                // Tambahkan kategori ke setiap buku yang ditemukan
                const files = response.result.files;
                return files.map(file => ({ ...file, category: folder.name }));
            })
        );
        
        // Tunggu semua promise (pengambilan file) selesai
        const results = await Promise.all(promises);

        // Gabungkan semua buku dari semua folder ke dalam `allBooks`
        results.forEach(booksFromFolder => {
            allBooks.push(...booksFromFolder);
        });

        // Setelah semua buku terkumpul, urutkan dan tampilkan
        allBooks.sort((a, b) => a.name.localeCompare(b.name));
        
        // Tampilkan semuanya
        displayCategories();
        displayBooks(allBooks);

        loader.style.display = 'none';
        bookGallery.style.display = 'grid';
    }

    /**
     * LOGIKA BARU: Menampilkan tombol-tombol filter kategori.
     */
    function displayCategories() {
        // Ambil nama kategori unik dari semua buku
        const categories = ['Semua', ...new Set(allBooks.map(book => book.category))];
        categoryFilters.innerHTML = '';
        
        categories.forEach(category => {
            const button = document.createElement('button');
            button.className = 'filter-btn';
            button.textContent = category;
            button.dataset.category = category;
            
            if (category === 'Semua') {
                button.classList.add('active');
            }
            
            button.addEventListener('click', handleCategoryClick);
            categoryFilters.appendChild(button);
        });
    }
    
    /**
     * LOGIKA BARU: Menangani klik pada tombol filter kategori.
     * @param {Event} e - Event klik.
     */
    function handleCategoryClick(e) {
        const selectedCategory = e.target.dataset.category;
        
        // Hapus class 'active' dari semua tombol, lalu tambahkan ke yang diklik
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        
        // Filter buku berdasarkan kategori yang dipilih
        if (selectedCategory === 'Semua') {
            displayBooks(allBooks);
        } else {
            const filteredBooks = allBooks.filter(book => book.category === selectedCategory);
            displayBooks(filteredBooks);
        }
    }

    /**
     * Diperbarui: Sekarang mengambil thumbnailLink karena tidak diambil di awal.
     * @param {Array} books - Array objek buku untuk ditampilkan.
     */
    async function displayBooks(books) {
        bookGallery.innerHTML = '';
        
        // Buat promise untuk mengambil thumbnail untuk setiap buku yang ditampilkan
        const thumbnailPromises = books.map(book => 
            gapi.client.drive.files.get({
                fileId: book.id,
                fields: 'thumbnailLink'
            }).then(response => ({...book, thumbnailLink: response.result.thumbnailLink}))
        );

        const booksWithThumbnails = await Promise.all(thumbnailPromises);
        
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
            bookGallery.innerHTML = "<p style='text-align:center;'>Tidak ada buku yang ditemukan di kategori ini.</p>";
        }
    }

    // Fungsi pencarian tetap sama
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        // Pastikan filter aktif tetap berlaku saat mencari
        const activeCategoryBtn = document.querySelector('.filter-btn.active');
        const activeCategory = activeCategoryBtn.dataset.category;
        
        let booksToSearch = allBooks;
        if (activeCategory !== 'Semua') {
            booksToSearch = allBooks.filter(book => book.category === activeCategory);
        }

        const filteredBooks = booksToSearch.filter(book => 
            book.name.toLowerCase().includes(searchTerm)
        );
        displayBooks(filteredBooks);
    });

    // ==========================================================
    // SISA KODE (MODAL VIEWER) TIDAK ADA PERUBAHAN
    // Cukup salin dari kode script.js Anda yang sudah ada
    // ==========================================================
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

    // Mulai semua proses
    loadGapi();
});
