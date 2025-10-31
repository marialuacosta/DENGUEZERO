const API_KEY = "9a7c42f79dbb4460dc6c4bbfbed9fb22";
 
const getNews = async () => {
  const res = await fetch(
    `https://gnews.io/api/v4/search?q=dengue&country=br&max=5&apikey=${API_KEY}`
  );
  const data = await res.json();
 
  const news = document.querySelector(".grid-noticias");
  data.articles.forEach((article) => {
    news.innerHTML += `
        <article class="card">
            <a href="${article.url}" target="_blank">
                <img src="${article.image}">
                <h3>${article.title}</h3>
                <p>${article.description}</p>
            </a>
        </article>
        `;
  });
};
 
getNews();
 
 