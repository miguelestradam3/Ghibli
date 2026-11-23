const API_URL = "https://ghibliapi.vercel.app/films";

const moviesContainer = document.getElementById("movies");
const searchInput = document.getElementById("searchInput");
const directorFilter = document.getElementById("directorFilter");
const sortFilter = document.getElementById("sortFilter");

if (searchInput) searchInput.addEventListener("input", applyFilters);
if (directorFilter) directorFilter.addEventListener("change", applyFilters);
if (sortFilter) sortFilter.addEventListener("change", applyFilters);

const moviesPerPage = 8;
let currentPage = 1;
let movies = [];
let filteredMovies = [];

function showLoading() {
    if (!moviesContainer) return;
    moviesContainer.innerHTML = `
        <div class="col-12 text-center my-5 py-4">
            <div class="spinner-border text-info" style="width: 3rem; height: 3rem;" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-3 text-light fs-5">Loading Studio Ghibli movies...</p>
        </div>
    `;
}

async function getMovies() {
    try {
        showLoading();
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`Failed to load movies (${response.status})`);
        }
        movies = await response.json();
        filteredMovies = [...movies];

        populateDirectors();
        displayMovies();

    } catch (error) {
        if (!moviesContainer) return;
        moviesContainer.innerHTML = `
            <div class="col-12">
                <div class="alert alert-danger text-center p-4 rounded-3 shadow-sm">
                    <i class="bi bi-exclamation-triangle-fill fs-3 d-block mb-2"></i>
                    <strong>Error loading movies:</strong> ${escapeHtml(error.message)}
                    <div class="mt-3">
                        <button class="btn btn-outline-light btn-sm" onclick="getMovies()">
                            <i class="bi bi-arrow-clockwise me-1"></i> Try Again
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

function displayMovies() {
    if (!moviesContainer) return;

    if (filteredMovies.length === 0) {
        moviesContainer.innerHTML = `
            <div class="col-12 text-center my-5 py-5 border border-secondary border-opacity-25 rounded-4 bg-dark bg-opacity-25">
                <i class="bi bi-search display-4 text-secondary opacity-50 mb-3 d-block"></i>
                <h4 class="text-white fw-bold mb-2">No movies found</h4>
                <p class="text-secondary mb-3">Try adjusting your search terms or filters.</p>
                <button class="btn btn-sm btn-outline-light rounded-pill px-3" onclick="resetFilters()">
                    Reset All Filters
                </button>
            </div>
        `;
        const pagination = document.getElementById("pagination");
        if (pagination) pagination.innerHTML = "";
        return;
    }

    const start = (currentPage - 1) * moviesPerPage;
    const end = start + moviesPerPage;
    const moviesToShow = filteredMovies.slice(start, end);

    moviesContainer.innerHTML = moviesToShow
        .map(movie => createMovieCard(movie))
        .join("");

    createPagination();
}

function createMovieCard(movie) {
    const poster = movie.image || "assets/img/hero.jpg";
    const rtScore = parseInt(movie.rt_score, 10) || 0;
    const scoreClass = rtScore >= 85 ? "bg-success" : rtScore >= 70 ? "bg-info" : "bg-warning";
    const titleEsc = escapeHtml(movie.title);
    const origTitleEsc = escapeHtml(movie.original_title);
    const directorEsc = escapeHtml(movie.director || "Unknown");

    return `
        <div class="col-12 col-sm-6 col-lg-4 col-xl-3">
            <div class="card h-100 shadow-sm movie-card border-0 rounded-4 overflow-hidden position-relative"
                 onclick="goToDetails('${movie.id}')"
                 role="button"
                 tabindex="0"
                 onkeydown="if(event.key==='Enter') goToDetails('${movie.id}')">

                <!-- Movie Poster Image -->
                <div class="movie-card-img-wrapper position-relative overflow-hidden">
                    <img src="${poster}"
                         class="card-img-top movie-card-img"
                         alt="${titleEsc}"
                         loading="lazy"
                         onerror="this.src='assets/img/hero.jpg'">
                    <span class="badge ${scoreClass} position-absolute top-0 end-0 m-2 px-2 py-1 shadow-sm rounded-pill font-monospace small">
                        ★ ${rtScore}%
                    </span>
                    <span class="badge bg-dark bg-opacity-75 text-light position-absolute bottom-0 start-0 m-2 px-2 py-1 rounded font-monospace small border border-secondary border-opacity-50">
                        ${movie.release_date}
                    </span>
                </div>

                <div class="card-body d-flex flex-column p-3 p-xl-4">
                    <!-- Title -->
                    <h5 class="card-title fw-bold mb-1 text-truncate" title="${titleEsc}">
                        ${titleEsc}
                    </h5>

                    <p class="mb-2">
                        <span class="badge bg-secondary bg-opacity-50 text-light border border-secondary border-opacity-50 small">
                            ${origTitleEsc}
                        </span>
                    </p>

                    <!-- Info -->
                    <div class="small text-secondary mb-3">
                        <div class="d-flex justify-content-between mb-1">
                            <span><i class="bi bi-person-video me-1 text-info"></i>Director:</span>
                            <span class="text-light fw-medium text-truncate ms-2" style="max-width: 60%;">${directorEsc}</span>
                        </div>
                        <div class="d-flex justify-content-between mb-1">
                            <span><i class="bi bi-clock me-1 text-info"></i>Runtime:</span>
                            <span class="text-light fw-medium">${movie.running_time} min</span>
                        </div>
                    </div>

                    <!-- Rotten Tomatoes Rating Bar -->
                    <div class="mb-3">
                        <div class="d-flex justify-content-between small text-secondary mb-1">
                            <span>RT Score</span>
                            <span class="text-light fw-bold">${rtScore}/100</span>
                        </div>
                        <div class="progress bg-dark" style="height: 6px;">
                            <div class="progress-bar ${scoreClass}"
                                 role="progressbar"
                                 style="width: ${rtScore}%;"
                                 aria-valuenow="${rtScore}"
                                 aria-valuemin="0"
                                 aria-valuemax="100">
                            </div>
                        </div>
                    </div>

                    <!-- Footer CTA Button -->
                    <div class="mt-auto pt-2">
                        <button class="btn btn-accent w-100 rounded-pill py-2 d-flex align-items-center justify-content-center gap-2"
                                onclick="event.stopPropagation(); goToDetails('${movie.id}')">
                            <span>View Full Specs</span>
                            <i class="bi bi-arrow-right"></i>
                        </button>
                    </div>

                </div>
            </div>
        </div>
    `;
}

function populateDirectors() {
    if (!directorFilter) return;

    const directors = [...new Set(movies.map(m => m.director).filter(Boolean))].sort();

    // Reset while keeping "All Directors"
    directorFilter.innerHTML = '<option value="">All Directors</option>';
    directors.forEach(director => {
        const opt = document.createElement("option");
        opt.value = director;
        opt.textContent = director;
        directorFilter.appendChild(opt);
    });
}

function createPagination() {
    const pagination = document.getElementById("pagination");
    if (!pagination) return;
    pagination.innerHTML = "";

    const totalPages = Math.ceil(filteredMovies.length / moviesPerPage);
    if (totalPages <= 1) return;

    let paginationHtml = `<div class="d-flex flex-wrap justify-content-center align-items-center gap-2">`;

    // Prev button
    if (currentPage > 1) {
        paginationHtml += `
            <button class="btn btn-outline-light btn-sm rounded-pill px-3"
                    onclick="goToPage(${currentPage - 1})">
                <i class="bi bi-chevron-left me-1"></i> Prev
            </button>
        `;
    }

    // Numbered buttons
    for (let i = 1; i <= totalPages; i++) {
        paginationHtml += `
            <button class="btn btn-sm rounded-circle p-0 page-btn ${i === currentPage ? 'btn-accent active' : 'btn-outline-secondary text-light'}"
                    style="width: 36px; height: 36px;"
                    onclick="goToPage(${i})">
                ${i}
            </button>
        `;
    }

    // Next button
    if (currentPage < totalPages) {
        paginationHtml += `
            <button class="btn btn-outline-light btn-sm rounded-pill px-3"
                    onclick="goToPage(${currentPage + 1})">
                Next <i class="bi bi-chevron-right ms-1"></i>
            </button>
        `;
    }

    paginationHtml += `</div>`;
    pagination.innerHTML = paginationHtml;
}

function goToPage(page) {
    currentPage = page;
    displayMovies();

    const explorerEl = document.getElementById("explorer");
    if (explorerEl) {
        explorerEl.scrollIntoView({
            behavior: "smooth"
        });
    }
}

function goToDetails(id) {
    if (!id) return;
    window.location.href = `movie.html?id=${encodeURIComponent(id)}`;
}

function applyFilters() {
    const searchValue = (searchInput?.value || "").toLowerCase().trim();
    const directorValue = directorFilter?.value || "";
    const sortValue = sortFilter?.value || "";

    filteredMovies = movies.filter(movie => {
        const titleMatch = (movie.title || "").toLowerCase().includes(searchValue);
        const originalTitleMatch = (movie.original_title || "").toLowerCase().includes(searchValue);
        const romanisedMatch = (movie.original_title_romanised || "").toLowerCase().includes(searchValue);
        const matchesSearch = !searchValue || titleMatch || originalTitleMatch || romanisedMatch;

        const matchesDirector = !directorValue || movie.director === directorValue;

        return matchesSearch && matchesDirector;
    });

    // Sorting
    switch (sortValue) {
        case "year-asc":
            filteredMovies.sort((a, b) => (parseInt(a.release_date, 10) || 0) - (parseInt(b.release_date, 10) || 0));
            break;
        case "year-desc":
            filteredMovies.sort((a, b) => (parseInt(b.release_date, 10) || 0) - (parseInt(a.release_date, 10) || 0));
            break;
        case "score-desc":
            filteredMovies.sort((a, b) => (parseInt(b.rt_score, 10) || 0) - (parseInt(a.rt_score, 10) || 0));
            break;
        case "score-asc":
            filteredMovies.sort((a, b) => (parseInt(a.rt_score, 10) || 0) - (parseInt(b.rt_score, 10) || 0));
            break;
        case "title-asc":
            filteredMovies.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
            break;
        case "title-desc":
            filteredMovies.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
            break;
    }

    currentPage = 1;
    displayMovies();
}

function resetFilters() {
    if (searchInput) searchInput.value = "";
    if (directorFilter) directorFilter.value = "";
    if (sortFilter) sortFilter.value = "";
    applyFilters();
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Initial fetch
getMovies();
