fetch('news.json')
  .then(response => response.json())
  .then(newsItems => {
    const container = document.getElementById('news-container');

    newsItems.forEach(item => {
      const card = document.createElement('div');
      card.className = 'news-card';

      // Optional tag class for future color-coding (e.g. tag.Policy)
      const tagClass = item.tag ? `tag ${item.tag.replace(/\s+/g, '')}` : 'tag';

      // Create inner card structure
      card.innerHTML = `
        <div class="${tagClass}">${item.tag}</div>
        <h2>${item.title}</h2>
        <p><strong>${item.date}</strong></p>
        <p>${item.summary}</p>
        <a href="${item.link}" target="_blank" rel="noopener noreferrer">Read More →</a>
      `;

      container.appendChild(card);
    });
  })
  .catch(error => {
    console.error('Failed to load news:', error);
    document.getElementById('news-container').innerHTML = `
      <div style="padding:2rem; color:#bc4749; font-weight:bold;">
        ⚠️ Failed to load news. Please check your connection or JSON format.
      </div>`;
  });