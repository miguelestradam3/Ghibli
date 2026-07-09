const API_BASE = "https://ghibliapi.vercel.app/films";

const container = document.getElementById("movie-details");
let characters = [];

// Get ID from URL
const params = new URLSearchParams(window.location.search);
const movieId = params.get("id");

async function getMovieDetails() {

    try {

        const response = await fetch(`${API_BASE}/${movieId}`);

        if (!response.ok) {
            throw new Error("Movie not found");
        }

        const movie = await response.json();

        renderMovie(movie);

    } catch (error) {

        container.innerHTML = `
            <div class="alert alert-danger text-center">
                ${error.message}
            </div>
        `;

    }
}

async function renderMovie(movie) {

    characters = await Promise.all(
        movie.people.map(async (url) => {
            const response = await fetch(url);
            const person = await response.json();

            return {
                name: person.name,
                age: person.age,
                eye_color: person.eye_color,
                hair_color: person.hair_color,
                gender: person.gender
            };
        })
    );

    const validCharacters = characters.filter(character =>
        character &&
        character.name &&
        character.name !== "undefined"
    );

    const charactersHTML = validCharacters.map(character => `
        <div class="card mb-3">
            <div class="card-body">
                <h5 class="text-black">${character.name}</h5>
                <p><strong>Age:</strong> ${character.age || "Unknown"}</p>
                <p><strong>Gender:</strong> ${character.gender || "Unknown"}</p>
                <p><strong>Eye Color:</strong> ${character.eye_color || "Unknown"}</p>
                <p><strong>Hair Color:</strong> ${character.hair_color || "Unknown"}</p>
            </div>
        </div>
    `).join("");

    container.innerHTML = `
        <div class="card shadow">

            <img src="${movie.movie_banner}"
                 class="card-img-top"
                 alt="${movie.title}">

            <div class="card-body">

                <h1 class="text-black">${movie.title}</h1>
                <h4 class="text-black">${movie.original_title}</h4>
                <p class="text-black"><em>${movie.original_title_romanised}</em></p>

                <hr>

                <p><strong>Director:</strong> ${movie.director}</p>
                <p><strong>Producer:</strong> ${movie.producer}</p>
                <p><strong>Release:</strong> ${movie.release_date}</p>
                <p><strong>Running Time:</strong> ${movie.running_time} min</p>
                <p><strong>Score:</strong> ${movie.rt_score}</p>

                <hr>

                <p>${movie.description}</p>

                ${charactersHTML ? `
                    <hr>

                    <button
                        class="btn btn-dark mb-3"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#charactersSection"
                        aria-expanded="false"
                        aria-controls="charactersSection">

                        Show characters
                    </button>

                    <div class="collapse" id="charactersSection">
                        ${charactersHTML}
                    </div>
                ` : ""}

                <hr>

                <a href="index.html" class="btn">
                    ← Back to Explorer
                </a>

            </div>

        </div>
    `;
}

getMovieDetails();