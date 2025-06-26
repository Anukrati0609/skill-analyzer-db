// 1️⃣ Run when the page is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  // Run when Enter is pressed in the input box
  document.getElementById("skill-input").addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      handleSearch();
    }
  });

  // Run when the search icon is clicked
  document.querySelector(".search-icon").addEventListener("click", handleSearch);
});

// 2️⃣ Define the function that fetches data from your backend
function handleSearch() {
  const skill = document.getElementById("skill-input").value.trim();

  if (!skill) {
    alert("Please enter a skill to search for.");
    return;
  }

  fetch(`/get-videos?skill=${encodeURIComponent(skill)}`)
    .then(response => response.json())
    .then(data => {
      const container = document.getElementById("results-container");
      container.style.display = "block"; // show container if hidden
      container.innerHTML = ""; // clear previous results

      if (data.length === 0) {
        container.innerHTML = "<p>No videos found for this skill.</p>";
        return;
      }

      data.forEach(video => {
        container.innerHTML += `
          <div class="video-card">
            <h3>${video.title}</h3>
            <p>${video.description || "No description available."}</p>
          </div>
        `;
      });
    })
    .catch(err => {
      console.error("Error fetching from DB:", err);
    });
}
