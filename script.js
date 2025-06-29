// script.js (Versi Final Lengkap)

document.addEventListener('DOMContentLoaded', () => {

    // --- KONFIGURASI ---
    // PENTING: Kunci API ini terlihat oleh publik. Untuk keamanan, batasi kunci ini
    // di Google Cloud Console agar hanya dapat digunakan oleh domain website Anda.
    const API_KEY = 'AIzaSyCXetZR21T2WrT42K3VQlrFM-CxAYYvg3U';
    
    // ID Folder Google Drive Anda
    // Diambil dari URL: https://drive.google.com/drive/folders/ID_FOLDER_ANDA
    const FOLDER_ID = '1SlotOnzWfK0imRA1uCETvJC076Hmcq5-';
    // --- AKHIR KONFIGURASI ---


    // Elemen DOM
    const bookGallery = document.getElementById('book-gallery');
    const loader = document.getElementById('loader');
    const searchInput = document.getElementById('searchInput');
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

    function loadGapi() {
        gapi.load('client', initClient);
    }

    function initClient() {
        gapi.client.init({
            'apiKey': API_KEY,
            'discoveryDocs': ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
        }).then(fetchBooks);
    }

    function fetchBooks() {
        loader.style.display = 'block';
        bookGallery.style.display = 'none';

        gapi.client.drive.files.list({
            'q': `'${FOLDER_ID}' in parents and mimeType='application/pdf'`,
            'pageSize': 100,
            'fields': "files(id, name, thumbnailLink)"
        }).then(response => {
            const files = response.result.files;
            allBooks = files.sort((a, b) => a.name.localeCompare(b.name));
            displayBooks(allBooks);
            loader.style.display = 'none';
            bookGallery.style.display = 'grid';
        }).catch(err => {
            console.error("Error fetching files:", err);
            loader.style.display = 'none';
            bookGallery.innerHTML = "<p style='text-align:center; color: red;'>Gagal memuat data buku.</p>";
            bookGallery.style.display = 'block';
        });
    }

    function displayBooks(books) {
        bookGallery.innerHTML = '';
        if (books && books.length > 0) {
            books.forEach(book => {
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
        const filteredBooks = allBooks.filter(book => 
            book.name.toLowerCase().includes(searchTerm)
        );
        displayBooks(filteredBooks);
    });

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

    /**
     * Merender halaman PDF dengan skala dinamis agar pas di layar
     * @param {number} num - Nomor halaman yang akan dirender
     */
    function renderPage(num) {
        pageRendering = true;
        viewerLoader.style.display = 'block';
        pdfCanvas.style.display = 'none';
        
        pdfDoc.getPage(num).then(page => {
            // --- LOGIKA SKALA DINAMIS ---
            const pdfViewerContainer = document.getElementById('pdf-viewer-container');
            // Dapatkan lebar kontainer (dikurangi padding jika ada)
            const containerWidth = pdfViewerContainer.clientWidth;
            // Dapatkan viewport PDF dengan skala 1 untuk mengetahui ukuran asli
            const viewportDefault = page.getViewport({ scale: 1 });
            // Hitung skala yang dibutuhkan agar lebar PDF pas dengan lebar kontainer
            const scale = containerWidth / viewportDefault.width;
            // Buat viewport baru dengan skala yang sudah dihitung
            const viewport = page.getViewport({ scale: scale });
            // --- AKHIR LOGIKA SKALA DINAMIS ---

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

    // Mulai proses dengan memuat Google API
    loadGapi();
});
