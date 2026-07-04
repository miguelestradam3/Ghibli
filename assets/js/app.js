const API_URL = "https://ghibliapi.vercel.app/films";

const moviesContainer = document.getElementById("movies");

const moviesPerPage = 6;

let currentPage = 1;
let movies = [];

async function getMovies() {

    try {

        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error("Could not load movies.");
        }

        movies = await response.json();

        displayMovies();

    } catch (error) {

        moviesContainer.innerHTML = `
            <div class="col-12">
                <div class="alert alert-danger text-center">
                    ${error.message}
                </div>
            </div>
        `;

    }

}

function displayMovies() {

    moviesContainer.innerHTML = "";

    const startIndex = (currentPage - 1) * moviesPerPage;
    const endIndex = startIndex + moviesPerPage;

    const currentMovies = movies.slice(startIndex, endIndex);

    moviesContainer.innerHTML = currentMovies
        .map(movie => `
        <div class="col-md-4">
            <div class="card h-100 shadow">

                <img src="${movie.image}"
                    class="card-img-top"
                    alt="${movie.title}">

                <div class="card-body">

                    <h3>${movie.title}</h3>

                    <h6><strong>Original Title: </strong>${movie.original_title}</h6>

                    <hr>

                    <button onclick="goToDetails('${movie.id}')" class="btn btn-success">See details</button>

                </div>

            </div>
        </div>
        `)
        .join("");

    createPagination();

}

function createPagination() {

    const pagination = document.getElementById("pagination");

    pagination.innerHTML = "";

    const totalPages = Math.ceil(movies.length / moviesPerPage);

    for (let i = 1; i <= totalPages; i++) {

        pagination.innerHTML += `
            <button
                class="btn btn-outline-success mx-1 ${i === currentPage ? 'active' : ''}"
                onclick="goToPage(${i})">
                ${i}
            </button>
        `;

    }

}

function goToPage(page) {

    currentPage = page;

    displayMovies();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}

function goToDetails(id) {
    window.location.href = `movie.html?id=${id}`;
}

getMovies();