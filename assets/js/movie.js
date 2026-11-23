/**
 * Studio Ghibli Explorer — Movie Details
 * Fetches and displays all film specifications from the Studio Ghibli API,
 * including connected characters, locations, species, and vehicles.
 */

const API_BASE = "https://ghibliapi.vercel.app";
const container = document.getElementById("movie-details");

// Extract Movie ID from URL params
const urlParams = new URLSearchParams(window.location.search);
const movieId = urlParams.get("id");

// Cache for API data across views in session
const cacheKey = (key) => `ghibli_cache_${key}`;

async function fetchWithCache(url, cacheName, ttlMs = 10 * 60 * 1000) {
    try {
        const cached = sessionStorage.getItem(cacheKey(cacheName));
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < ttlMs) {
                return parsed.data;
            }
        }
    } catch {
        // Ignore cache storage errors
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load ${cacheName} (${response.status})`);
    }
    const data = await response.json();

    try {
        sessionStorage.setItem(cacheKey(cacheName), JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    } catch {
        // Storage might be full or disabled, ignore
    }

    return data;
}

/**
 * Main function to load movie and all related specifications
 */
async function loadMovieDetails() {
    if (!movieId) {
        renderNoIdError();
        return;
    }

    try {
        // Fetch film details and all relational collections in parallel
        const [movie, allPeople, allLocations, allSpecies, allVehicles] = await Promise.all([
            fetch(`${API_BASE}/films/${movieId}`).then(r => {
                if (!r.ok) throw new Error("Film not found with ID: " + movieId);
                return r.json();
            }),
            fetchWithCache(`${API_BASE}/people`, "people").catch(() => []),
            fetchWithCache(`${API_BASE}/locations`, "locations").catch(() => []),
            fetchWithCache(`${API_BASE}/species`, "species").catch(() => []),
            fetchWithCache(`${API_BASE}/vehicles`, "vehicles").catch(() => [])
        ]);

        // Process and cross-reference specifications
        const enrichedData = processMovieSpecs(movie, allPeople, allLocations, allSpecies, allVehicles);

        // Update document title
        document.title = `${movie.title} (${movie.release_date}) — Movie Specs`;

        // Render the complete details view
        renderMovieDetails(enrichedData);

    } catch (error) {
        console.error("Error loading movie specs:", error);
        renderError(error.message || "An unexpected error occurred while loading movie details.");
    }
}

/**
 * Filter and cross-reference all relational specifications
 */
function processMovieSpecs(movie, allPeople, allLocations, allSpecies, allVehicles) {
    const filmId = movie.id;
    const filmUrl = movie.url || `${API_BASE}/films/${filmId}`;

    // Helper: checks whether an item's films array references this movie
    const belongsToMovie = (item) => {
        if (!item || !item.films) return false;
        return item.films.some(f => typeof f === "string" && (f.includes(filmId) || f === filmUrl));
    };

    // Helper: checks if movie's own array holds this item's URL or ID
    const matchesMovieArray = (arr, item) => {
        if (!Array.isArray(arr) || !item) return false;
        return arr.some(entry => typeof entry === "string" && (entry.includes(item.id) || entry === item.url));
    };

    // 1. Process Species Map for quick lookup
    const speciesMap = new Map();
    allSpecies.forEach(s => {
        if (s.id) speciesMap.set(s.id, s);
        if (s.url) speciesMap.set(s.url, s);
    });

    // 2. Filter Characters (People)
    const matchedPeople = allPeople.filter(p => belongsToMovie(p) || matchesMovieArray(movie.people, p));

    // Resolve species name for each person
    const characters = matchedPeople.map(p => {
        let speciesName = "Unknown Species";
        if (p.species) {
            const spec = speciesMap.get(p.species);
            if (spec) speciesName = spec.name;
        }
        return {
            ...p,
            speciesName: speciesName || "Unknown"
        };
    });

    // Create People Map for lookup
    const peopleMap = new Map();
    allPeople.forEach(p => {
        if (p.id) peopleMap.set(p.id, p);
        if (p.url) peopleMap.set(p.url, p);
    });

    // 3. Filter Locations
    const matchedLocations = allLocations.filter(loc => belongsToMovie(loc) || matchesMovieArray(movie.locations, loc));
    const locations = matchedLocations.map(loc => {
        // Resolve residents
        let residentNames = [];
        if (Array.isArray(loc.residents)) {
            residentNames = loc.residents
                .map(resUrl => {
                    const person = peopleMap.get(resUrl);
                    return person ? person.name : null;
                })
                .filter(Boolean);
        }
        return {
            ...loc,
            residentNames
        };
    });

    // 4. Filter Species
    const matchedSpecies = allSpecies.filter(spec => belongsToMovie(spec) || matchesMovieArray(movie.species, spec));

    // 5. Filter Vehicles
    const matchedVehicles = allVehicles.filter(veh => belongsToMovie(veh) || matchesMovieArray(movie.vehicles, veh));
    const vehicles = matchedVehicles.map(veh => {
        let pilotName = "None / Unknown";
        if (veh.pilot) {
            const pilot = peopleMap.get(veh.pilot);
            if (pilot) pilotName = pilot.name;
        }
        return {
            ...veh,
            pilotName
        };
    });

    // Format runtime (e.g. 124 min -> 2h 04m)
    const runtimeMin = parseInt(movie.running_time, 10) || 0;
    const hours = Math.floor(runtimeMin / 60);
    const mins = runtimeMin % 60;
    const runtimeFormatted = hours > 0 ? `${hours}h ${mins.toString().padStart(2, "0")}m` : `${mins}m`;

    return {
        movie,
        runtimeFormatted,
        characters,
        locations,
        species: matchedSpecies,
        vehicles
    };
}

/**
 * Render the full movie specifications page
 */
function renderMovieDetails({ movie, runtimeFormatted, characters, locations, species, vehicles }) {
    const rtScore = parseInt(movie.rt_score, 10) || 0;
    const scoreColorClass = rtScore >= 85 ? "bg-success" : rtScore >= 70 ? "bg-info" : "bg-warning";
    const bannerImage = movie.movie_banner || movie.image;
    const posterImage = movie.image || "assets/img/hero.jpg";

    container.innerHTML = `
        <!-- Movie Hero Backdrop Section -->
        <section class="movie-backdrop-hero position-relative">
            <div class="backdrop-image-wrapper">
                <img src="${bannerImage}"
                     alt="${movie.title} Backdrop"
                     class="backdrop-img"
                     onerror="this.src='${posterImage}'">
                <div class="backdrop-overlay"></div>
            </div>

            <div class="container backdrop-content">
                <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                    <a href="index.html#explorer" class="btn btn-outline-light btn-sm rounded-pill px-3 shadow-sm back-nav-btn">
                        <i class="bi bi-arrow-left me-1"></i> Back to Explorer
                    </a>
                    <div class="d-flex align-items-center gap-2">
                        <span class="badge bg-dark bg-opacity-75 text-light border border-secondary px-3 py-2 rounded-pill">
                            <i class="bi bi-calendar3 me-1 text-info"></i> ${movie.release_date}
                        </span>
                        <span class="badge bg-dark bg-opacity-75 text-light border border-secondary px-3 py-2 rounded-pill">
                            <i class="bi bi-clock me-1 text-warning"></i> ${movie.running_time} min (${runtimeFormatted})
                        </span>
                    </div>
                </div>

                <div class="hero-titles">
                    <span class="badge bg-primary bg-opacity-50 text-light px-3 py-1 mb-2 fs-6 border border-info border-opacity-50">
                        ${movie.original_title}
                    </span>
                    <h1 class="display-4 fw-bold text-white mb-1 movie-main-title">${movie.title}</h1>
                    <p class="lead text-light fst-italic text-opacity-75 mb-0">${movie.original_title_romanised}</p>
                </div>
            </div>
        </section>

        <!-- Main Specifications Body -->
        <section class="py-4 py-md-5">
            <div class="container">
                <div class="row g-4 g-lg-5">

                    <!-- Left Column: Poster & Quick Specs -->
                    <div class="col-12 col-lg-4">
                        <div class="card spec-card shadow-lg border-0 rounded-4 overflow-hidden mb-4 sticky-lg-top" style="top: 90px;">
                            <div class="poster-container position-relative">
                                <img src="${posterImage}"
                                     class="card-img-top img-fluid movie-poster-img"
                                     alt="${movie.title} Poster"
                                     onerror="this.src='assets/img/hero.jpg'">
                                <div class="score-badge-floating shadow ${scoreColorClass}">
                                    <span class="score-num">${rtScore}</span>
                                    <span class="score-label">/100</span>
                                </div>
                            </div>

                            <div class="card-body p-4">
                                <h4 class="card-title fw-bold text-white mb-3">Film Specifications</h4>

                                <div class="specs-list">
                                    <div class="spec-row py-2 border-bottom border-dark-subtle d-flex justify-content-between align-items-center">
                                        <span class="text-secondary"><i class="bi bi-person-video me-2 text-info"></i>Director</span>
                                        <span class="fw-semibold text-light text-end">${movie.director}</span>
                                    </div>

                                    <div class="spec-row py-2 border-bottom border-dark-subtle d-flex justify-content-between align-items-center">
                                        <span class="text-secondary"><i class="bi bi-briefcase me-2 text-info"></i>Producer</span>
                                        <span class="fw-semibold text-light text-end">${movie.producer}</span>
                                    </div>

                                    <div class="spec-row py-2 border-bottom border-dark-subtle d-flex justify-content-between align-items-center">
                                        <span class="text-secondary"><i class="bi bi-calendar-event me-2 text-info"></i>Release Year</span>
                                        <span class="fw-semibold text-light">${movie.release_date}</span>
                                    </div>

                                    <div class="spec-row py-2 border-bottom border-dark-subtle d-flex justify-content-between align-items-center">
                                        <span class="text-secondary"><i class="bi bi-hourglass-split me-2 text-info"></i>Duration</span>
                                        <span class="fw-semibold text-light">${movie.running_time} min (${runtimeFormatted})</span>
                                    </div>

                                    <div class="spec-row py-2">
                                        <div class="d-flex justify-content-between mb-1">
                                            <span class="text-secondary"><i class="bi bi-star-fill me-2 text-warning"></i>Rotten Tomatoes</span>
                                            <span class="fw-semibold text-light">${rtScore}%</span>
                                        </div>
                                        <div class="progress bg-dark" style="height: 8px;">
                                            <div class="progress-bar ${scoreColorClass}" role="progressbar" style="width: ${rtScore}%;" aria-valuenow="${rtScore}" aria-valuemin="0" aria-valuemax="100"></div>
                                        </div>
                                    </div>
                                </div>

                                <div class="mt-4 pt-3 border-top border-dark-subtle d-grid gap-2">
                                    <a href="index.html#explorer" class="btn btn-accent rounded-pill py-2">
                                        <i class="bi bi-film me-2"></i> Explore More Movies
                                    </a>
                                    <br/>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: Storyline & Specification Tabs -->
                    <div class="col-12 col-lg-8">
                        <!-- Synopsis Card -->
                        <div class="card spec-card shadow-sm border-0 rounded-4 p-4 mb-4">
                            <h3 class="fw-bold text-white mb-3 d-flex align-items-center">
                                <i class="bi bi-book-half me-2 text-accent"></i> Storyline & Synopsis
                            </h3>
                            <p class="lead text-light mb-0 fs-6 lh-lg">${movie.description}</p>
                        </div>

                        <!-- Entity Counts Stat Badges -->
                        <div class="row g-3 mb-4">
                            <div class="col-6 col-sm-3">
                                <div class="stat-box p-3 rounded-4 text-center border border-secondary border-opacity-25 h-100">
                                    <div class="stat-icon mb-1 text-info fs-4"><i class="bi bi-people-fill"></i></div>
                                    <div class="stat-count fs-3 fw-bold text-white">${characters.length}</div>
                                    <div class="stat-label small text-secondary">Characters</div>
                                </div>
                            </div>
                            <div class="col-6 col-sm-3">
                                <div class="stat-box p-3 rounded-4 text-center border border-secondary border-opacity-25 h-100">
                                    <div class="stat-icon mb-1 text-success fs-4"><i class="bi bi-geo-alt-fill"></i></div>
                                    <div class="stat-count fs-3 fw-bold text-white">${locations.length}</div>
                                    <div class="stat-label small text-secondary">Locations</div>
                                </div>
                            </div>
                            <div class="col-6 col-sm-3">
                                <div class="stat-box p-3 rounded-4 text-center border border-secondary border-opacity-25 h-100">
                                    <div class="stat-icon mb-1 text-warning fs-4"><i class="bi bi-heart-pulse-fill"></i></div>
                                    <div class="stat-count fs-3 fw-bold text-white">${species.length}</div>
                                    <div class="stat-label small text-secondary">Species</div>
                                </div>
                            </div>
                            <div class="col-6 col-sm-3">
                                <div class="stat-box p-3 rounded-4 text-center border border-secondary border-opacity-25 h-100">
                                    <div class="stat-icon mb-1 text-danger fs-4"><i class="bi bi-airplane-fill"></i></div>
                                    <div class="stat-count fs-3 fw-bold text-white">${vehicles.length}</div>
                                    <div class="stat-label small text-secondary">Vehicles</div>
                                </div>
                            </div>
                        </div>

                        <!-- Interactive Specification Tabs -->
                        <div class="card spec-card shadow-sm border-0 rounded-4 overflow-hidden mb-4">
                            <div class="card-header bg-dark bg-opacity-50 border-bottom border-dark-subtle p-3">
                                <ul class="nav nav-pills flex-wrap gap-2" id="specTabs" role="tablist">
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link active rounded-pill px-3 py-2" id="characters-tab" data-bs-toggle="pill" data-bs-target="#tab-characters" type="button" role="tab" aria-controls="tab-characters" aria-selected="true">
                                            <i class="bi bi-people me-1"></i> Characters (${characters.length})
                                        </button>
                                    </li>
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link rounded-pill px-3 py-2" id="locations-tab" data-bs-toggle="pill" data-bs-target="#tab-locations" type="button" role="tab" aria-controls="tab-locations" aria-selected="false">
                                            <i class="bi bi-geo-alt me-1"></i> Locations (${locations.length})
                                        </button>
                                    </li>
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link rounded-pill px-3 py-2" id="species-tab" data-bs-toggle="pill" data-bs-target="#tab-species" type="button" role="tab" aria-controls="tab-species" aria-selected="false">
                                            <i class="bi bi-flower1 me-1"></i> Species (${species.length})
                                        </button>
                                    </li>
                                    <li class="nav-item" role="presentation">
                                        <button class="nav-link rounded-pill px-3 py-2" id="vehicles-tab" data-bs-toggle="pill" data-bs-target="#tab-vehicles" type="button" role="tab" aria-controls="tab-vehicles" aria-selected="false">
                                            <i class="bi bi-airplane me-1"></i> Vehicles (${vehicles.length})
                                        </button>
                                    </li>
                                </ul>
                            </div>

                            <div class="card-body p-4 tab-content" id="specTabsContent">

                                <!-- TAB 1: Characters -->
                                <div class="tab-pane fade show active" id="tab-characters" role="tabpanel" aria-labelledby="characters-tab">
                                    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                                        <h5 class="text-white mb-0 fw-bold">Film Characters (${characters.length})</h5>
                                        ${characters.length > 3 ? `
                                            <div class="search-box position-relative" style="min-width: 200px;">
                                                <input type="text"
                                                       class="form-control form-control-sm rounded-pill bg-dark text-light border-secondary"
                                                       placeholder="Filter characters..."
                                                       id="characterSearchInput"
                                                       oninput="filterCharacterCards(this.value)">
                                            </div>
                                        ` : ""}
                                    </div>

                                    ${characters.length > 0 ? `
                                        <div class="row g-3" id="charactersListGrid">
                                            ${characters.map(char => renderCharacterCard(char)).join("")}
                                        </div>
                                    ` : renderEmptyState("people", "No specific characters are documented in the API for this film.")}
                                </div>

                                <!-- TAB 2: Locations -->
                                <div class="tab-pane fade" id="tab-locations" role="tabpanel" aria-labelledby="locations-tab">
                                    <h5 class="text-white mb-4 fw-bold">Film Locations (${locations.length})</h5>
                                    ${locations.length > 0 ? `
                                        <div class="row g-3">
                                            ${locations.map(loc => renderLocationCard(loc)).join("")}
                                        </div>
                                    ` : renderEmptyState("geo-alt", "No specific locations are documented in the API for this film.")}
                                </div>

                                <!-- TAB 3: Species -->
                                <div class="tab-pane fade" id="tab-species" role="tabpanel" aria-labelledby="species-tab">
                                    <h5 class="text-white mb-4 fw-bold">Film Species (${species.length})</h5>
                                    ${species.length > 0 ? `
                                        <div class="row g-3">
                                            ${species.map(spec => renderSpeciesCard(spec)).join("")}
                                        </div>
                                    ` : renderEmptyState("flower1", "No specific species are documented in the API for this film.")}
                                </div>

                                <!-- TAB 4: Vehicles -->
                                <div class="tab-pane fade" id="tab-vehicles" role="tabpanel" aria-labelledby="vehicles-tab">
                                    <h5 class="text-white mb-4 fw-bold">Film Vehicles (${vehicles.length})</h5>
                                    ${vehicles.length > 0 ? `
                                        <div class="row g-3">
                                            ${vehicles.map(veh => renderVehicleCard(veh)).join("")}
                                        </div>
                                    ` : renderEmptyState("airplane", "No vehicles are documented in the API for this film.")}
                                </div>

                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    `;
}

/**
 * Render individual character card
 */
function renderCharacterCard(char) {
    const ageDisplay = char.age && char.age !== "NA" ? char.age : "Unknown";
    const genderIcon = char.gender === "Female" ? "bi-gender-female text-danger" :
                       char.gender === "Male" ? "bi-gender-male text-primary" : "bi-gender-ambiguous text-warning";

    return `
        <div class="col-12 col-sm-6 col-xl-4 character-card-item" data-name="${(char.name || '').toLowerCase()}">
            <div class="card h-100 bg-dark border-secondary border-opacity-25 rounded-3 shadow-sm hover-elevate">
                <div class="card-body p-3">
                    <div class="d-flex align-items-start justify-content-between gap-2 mb-2">
                        <h6 class="fw-bold text-white mb-0 text-truncate" title="${escapeHtml(char.name)}">${escapeHtml(char.name)}</h6>
                        <span class="badge bg-secondary bg-opacity-50 small rounded-pill">
                            <i class="bi ${genderIcon}"></i> ${escapeHtml(char.gender || "N/A")}
                        </span>
                    </div>

                    <div class="specs-mini small text-secondary">
                        <div class="d-flex justify-content-between py-1 border-bottom border-dark">
                            <span><i class="bi bi-hourglass-bottom me-1 text-info"></i>Age:</span>
                            <span class="text-light fw-medium">${escapeHtml(ageDisplay)}</span>
                        </div>
                        <div class="d-flex justify-content-between py-1 border-bottom border-dark">
                            <span><i class="bi bi-eye me-1 text-info"></i>Eye Color:</span>
                            <span class="text-light fw-medium">${escapeHtml(char.eye_color || "Unknown")}</span>
                        </div>
                        <div class="d-flex justify-content-between py-1 border-bottom border-dark">
                            <span><i class="bi bi-scissors me-1 text-info"></i>Hair Color:</span>
                            <span class="text-light fw-medium">${escapeHtml(char.hair_color || "Unknown")}</span>
                        </div>
                        <div class="d-flex justify-content-between py-1">
                            <span><i class="bi bi-tag me-1 text-info"></i>Species:</span>
                            <span class="text-info fw-medium">${escapeHtml(char.speciesName || "Unknown")}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render individual location card
 */
function renderLocationCard(loc) {
    const surfaceWater = loc.surface_water && loc.surface_water !== "TODO" ? `${loc.surface_water}%` : "Unknown";
    const residentsCount = loc.residentNames && loc.residentNames.length > 0 ?
        loc.residentNames.join(", ") : "None documented in API";

    return `
        <div class="col-12 col-sm-6">
            <div class="card h-100 bg-dark border-secondary border-opacity-25 rounded-3 shadow-sm hover-elevate">
                <div class="card-body p-3">
                    <div class="d-flex align-items-center justify-content-between mb-2">
                        <h6 class="fw-bold text-white mb-0"><i class="bi bi-pin-map text-success me-2"></i>${escapeHtml(loc.name)}</h6>
                    </div>

                    <div class="specs-mini small text-secondary">
                        <div class="d-flex justify-content-between py-1 border-bottom border-dark">
                            <span><i class="bi bi-cloud-sun me-1 text-info"></i>Climate:</span>
                            <span class="text-light fw-medium">${escapeHtml(loc.climate || "Unknown")}</span>
                        </div>
                        <div class="d-flex justify-content-between py-1 border-bottom border-dark">
                            <span><i class="bi bi-mountain me-1 text-info"></i>Terrain:</span>
                            <span class="text-light fw-medium">${escapeHtml(loc.terrain || "Unknown")}</span>
                        </div>
                        <div class="d-flex justify-content-between py-1 border-bottom border-dark">
                            <span><i class="bi bi-droplet me-1 text-info"></i>Surface Water:</span>
                            <span class="text-light fw-medium">${escapeHtml(surfaceWater)}</span>
                        </div>
                        <div class="py-1">
                            <span class="d-block mb-1"><i class="bi bi-people me-1 text-info"></i>Residents:</span>
                            <span class="text-light fw-medium small">${escapeHtml(residentsCount)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render individual species card
 */
function renderSpeciesCard(spec) {
    return `
        <div class="col-12 col-sm-6">
            <div class="card h-100 bg-dark border-secondary border-opacity-25 rounded-3 shadow-sm hover-elevate">
                <div class="card-body p-3">
                    <div class="d-flex align-items-center justify-content-between mb-2">
                        <h6 class="fw-bold text-white mb-0"><i class="bi bi-flower1 text-warning me-2"></i>${escapeHtml(spec.name)}</h6>
                        <span class="badge bg-secondary bg-opacity-50 small rounded-pill">${escapeHtml(spec.classification || "Species")}</span>
                    </div>

                    <div class="specs-mini small text-secondary">
                        <div class="d-flex justify-content-between py-1 border-bottom border-dark">
                            <span><i class="bi bi-diagram-3 me-1 text-info"></i>Classification:</span>
                            <span class="text-light fw-medium">${escapeHtml(spec.classification || "Unknown")}</span>
                        </div>
                        <div class="py-1 border-bottom border-dark">
                            <span class="d-block"><i class="bi bi-eye me-1 text-info"></i>Eye Colors:</span>
                            <span class="text-light fw-medium small text-truncate d-block">${escapeHtml(spec.eye_colors || "Unknown")}</span>
                        </div>
                        <div class="py-1">
                            <span class="d-block"><i class="bi bi-palette me-1 text-info"></i>Hair Colors:</span>
                            <span class="text-light fw-medium small text-truncate d-block">${escapeHtml(spec.hair_colors || "Unknown")}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render individual vehicle card
 */
function renderVehicleCard(veh) {
    return `
        <div class="col-12">
            <div class="card bg-dark border-secondary border-opacity-25 rounded-3 shadow-sm hover-elevate">
                <div class="card-body p-4">
                    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                        <h5 class="fw-bold text-white mb-0"><i class="bi bi-airplane text-danger me-2"></i>${escapeHtml(veh.name)}</h5>
                        <span class="badge bg-danger bg-opacity-75 rounded-pill px-3 py-1">Class: ${escapeHtml(veh.vehicle_class || "Machine")}</span>
                    </div>

                    <p class="text-light small mb-3 lh-base">${escapeHtml(veh.description || "No description provided.")}</p>

                    <div class="row g-2 small text-secondary">
                        <div class="col-sm-6">
                            <div class="p-2 bg-black bg-opacity-25 rounded border border-dark">
                                <span class="text-secondary d-block">Length:</span>
                                <span class="text-light fw-bold">${escapeHtml(veh.length || "Unknown")}</span>
                            </div>
                        </div>
                        <div class="col-sm-6">
                            <div class="p-2 bg-black bg-opacity-25 rounded border border-dark">
                                <span class="text-secondary d-block">Pilot:</span>
                                <span class="text-light fw-bold">${escapeHtml(veh.pilotName || "Unknown")}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Empty state container when an entity list is empty
 */
function renderEmptyState(icon, message) {
    return `
        <div class="text-center py-5 px-3 border border-secondary border-opacity-25 rounded-3 bg-dark bg-opacity-25">
            <i class="bi bi-${icon} display-5 text-secondary opacity-50 mb-3 d-block"></i>
            <p class="text-light mb-1 fw-medium">${message}</p>
            <p class="text-secondary small mb-0">This film either has no specific ${icon} records in the dataset or it was left blank in the API source.</p>
        </div>
    `;
}

/**
 * Filter characters dynamically on input
 */
function filterCharacterCards(term) {
    const q = (term || "").toLowerCase().trim();
    const items = document.querySelectorAll(".character-card-item");
    items.forEach(el => {
        const name = el.getAttribute("data-name") || "";
        el.style.display = name.includes(q) ? "" : "none";
    });
}

/**
 * Utility: Copy string to clipboard with visual feedback
 */
function copyToClipboard(text, btnElement) {
    if (!navigator.clipboard) {
        prompt("Copy ID:", text);
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        const originalHtml = btnElement.innerHTML;
        btnElement.innerHTML = `<i class="bi bi-check2 text-success"></i> Copied!`;
        btnElement.classList.add("border-success");
        setTimeout(() => {
            btnElement.innerHTML = originalHtml;
            btnElement.classList.remove("border-success");
        }, 2000);
    }).catch(() => {
        prompt("Copy ID:", text);
    });
}

/**
 * Utility: Escape HTML to prevent injection
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Error state when movie ID is missing from URL
 */
function renderNoIdError() {
    container.innerHTML = `
        <div class="container py-5 my-5">
            <div class="card spec-card border-0 rounded-4 shadow-lg p-5 text-center mx-auto" style="max-width: 600px;">
                <i class="bi bi-film display-3 text-warning mb-3"></i>
                <h3 class="fw-bold text-white mb-2">No Movie Selected</h3>
                <p class="text-secondary mb-4">Please select a movie from the Explorer catalog to inspect its complete specifications.</p>
                <div>
                    <a href="index.html#explorer" class="btn btn-accent rounded-pill px-4 py-2">
                        <i class="bi bi-arrow-left me-1"></i> Go to Movie Explorer
                    </a>
                </div>
            </div>
        </div>
    `;
}

/**
 * Error state when fetch fails
 */
function renderError(message) {
    container.innerHTML = `
        <div class="container py-5 my-5">
            <div class="card spec-card border-0 rounded-4 shadow-lg p-5 text-center mx-auto" style="max-width: 600px;">
                <i class="bi bi-exclamation-triangle-fill display-3 text-danger mb-3"></i>
                <h3 class="fw-bold text-white mb-2">Error Loading Specifications</h3>
                <p class="text-secondary mb-4">${escapeHtml(message)}</p>
                <div class="d-flex justify-content-center gap-3">
                    <button class="btn btn-outline-light rounded-pill px-4 py-2" onclick="location.reload()">
                        <i class="bi bi-arrow-clockwise me-1"></i> Retry
                    </button>
                    <a href="index.html#explorer" class="btn btn-accent rounded-pill px-4 py-2">
                        <i class="bi bi-arrow-left me-1"></i> Explorer
                    </a>
                </div>
            </div>
        </div>
    `;
}

// Kick off movie details fetching
loadMovieDetails();
